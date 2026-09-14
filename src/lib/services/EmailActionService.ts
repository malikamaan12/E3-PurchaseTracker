import { jwtVerify, SignJWT } from "jose";
import { JWT_SECRET } from "@/lib/utils/config";
import { db } from "@db";
import {
  purchaseRequests,
  approvals,
  users,
  vendors,
  auditLogs,
  paymentInstallments,
  type User
} from "@db/schema";
import { eq, and } from "drizzle-orm";
import { notificationService } from "./NotificationService";

export interface EmailActionTokenPayload {
  requestId: number;
  approverId: number;
  approvalId?: number;
  purpose: "email_approval_action";
  [key: string]: any;
}

export interface EmailActionContext {
  valid: boolean;
  error?: string;
  isAlreadyProcessed?: boolean;
  currentStatus?: string;
  requestId: number;
  requestNumber: string;
  title: string;
  description: string;
  department: string;
  requesterName: string;
  requesterEmail: string;
  vendorName?: string;
  currency: string;
  totalEstimatedCost: number;
  paymentStructure: string;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
    remarks?: string;
  }>;
  approver: {
    id: number;
    username: string;
    email: string;
    department: string;
    role: string;
  };
  approvalSlot?: {
    id: number;
    department: string;
    status: string;
    isMandatory: boolean;
    comments?: string | null;
  };
}

export class EmailActionService {
  private static instance: EmailActionService;
  private appUrl: string;

  private constructor() {
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  public static getInstance(): EmailActionService {
    if (!EmailActionService.instance) {
      EmailActionService.instance = new EmailActionService();
    }
    return EmailActionService.instance;
  }

  private getSecretKey(): Uint8Array {
    return new TextEncoder().encode(JWT_SECRET);
  }

  /**
   * Generate signed action tokens and deep-links for an approver
   */
  public async generateActionUrls(params: {
    requestId: number;
    approverId: number;
    approvalId?: number;
  }): Promise<{
    approveUrl: string;
    rejectUrl: string;
    changesUrl: string;
    token: string;
  }> {
    const payload: EmailActionTokenPayload = {
      requestId: params.requestId,
      approverId: params.approverId,
      approvalId: params.approvalId,
      purpose: "email_approval_action",
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.getSecretKey());

    const baseUrl = `${this.appUrl}/requests/${params.requestId}/email-action`;

    return {
      approveUrl: `${baseUrl}?token=${encodeURIComponent(token)}&action=approved`,
      rejectUrl: `${baseUrl}?token=${encodeURIComponent(token)}&action=rejected`,
      changesUrl: `${baseUrl}?token=${encodeURIComponent(token)}&action=changes_requested`,
      token,
    };
  }

  /**
   * Verify an action token cryptographically
   */
  public async verifyToken(token: string): Promise<EmailActionTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.getSecretKey());
      if (payload?.purpose !== "email_approval_action" || !payload?.requestId || !payload?.approverId) {
        return null;
      }
      return payload as unknown as EmailActionTokenPayload;
    } catch (err) {
      return null;
    }
  }

  /**
   * Safe, non-mutating context lookup for the email action landing portal (safe for web crawlers)
   */
  public async getActionContext(token: string): Promise<EmailActionContext | null> {
    const payload = await this.verifyToken(token);
    if (!payload) return null;

    const { requestId, approverId, approvalId } = payload;

    // 1. Fetch approver user
    const [approver] = await db
      .select()
      .from(users)
      .where(eq(users.id, approverId))
      .limit(1);

    if (!approver || !approver.isActive) return null;

    // 2. Fetch purchase request header & requester
    const [request] = await db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        title: purchaseRequests.title,
        description: purchaseRequests.description,
        department: purchaseRequests.department,
        items: purchaseRequests.items,
        totalEstimatedCost: purchaseRequests.totalEstimatedCost,
        currency: purchaseRequests.currency,
        paymentStructure: purchaseRequests.paymentStructure,
        status: purchaseRequests.status,
        requesterId: purchaseRequests.requesterId,
        vendorId: purchaseRequests.vendorId,
      })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return null;

    const [requester] = await db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(eq(users.id, request.requesterId))
      .limit(1);

    let vendorName: string | undefined;
    if (request.vendorId) {
      const [vendor] = await db
        .select({ companyName: vendors.companyName })
        .from(vendors)
        .where(eq(vendors.id, request.vendorId))
        .limit(1);
      if (vendor) vendorName = vendor.companyName;
    }

    // 3. Find the approver's target approval slot
    const allApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    let targetApproval = approvalId ? allApprovals.find((a) => a.id === approvalId) : undefined;
    if (!targetApproval) {
      targetApproval = allApprovals.find(
        (a) => a.approverId === approverId || a.department.toLowerCase() === approver.department.toLowerCase()
      );
    }
    if (!targetApproval && approver.role === "super_admin") {
      targetApproval = allApprovals.find((a) => a.status === "pending") || allApprovals[0];
    }

    // Parse items safely
    let parsedItems: any[] = [];
    try {
      if (Array.isArray(request.items)) {
        parsedItems = request.items;
      } else if (typeof request.items === "string") {
        const parsed = JSON.parse(request.items);
        parsedItems = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      parsedItems = [];
    }

    const isAlreadyProcessed = targetApproval ? targetApproval.status !== "pending" : false;

    return {
      valid: true,
      isAlreadyProcessed,
      currentStatus: targetApproval?.status || request.status,
      requestId: request.id,
      requestNumber: request.requestNumber,
      title: request.title,
      description: request.description,
      department: request.department || "General",
      requesterName: requester?.username || "Requester",
      requesterEmail: requester?.email || "",
      vendorName,
      currency: request.currency || "QAR",
      totalEstimatedCost: request.totalEstimatedCost || 0,
      paymentStructure: request.paymentStructure || "Standard",
      items: Array.isArray(parsedItems) ? parsedItems : [],
      approver: {
        id: approver.id,
        username: approver.username,
        email: approver.email,
        department: approver.department,
        role: approver.role,
      },
      approvalSlot: targetApproval
        ? {
            id: targetApproval.id,
            department: targetApproval.department,
            status: targetApproval.status,
            isMandatory: targetApproval.isMandatory,
            comments: targetApproval.comments,
          }
        : undefined,
    };
  }

  /**
   * Execute approval/rejection/revision action securely using verified token
   */
  public async executeAction(params: {
    token: string;
    action: "approved" | "rejected" | "changes_requested";
    comments?: string;
  }): Promise<{ success: boolean; message: string; requestStatus?: string }> {
    const payload = await this.verifyToken(params.token);
    if (!payload) {
      throw new Error("Invalid or expired action link. Please log into PurchaseTracker to take action.");
    }

    const { requestId, approverId, approvalId } = payload;
    const { action, comments } = params;

    // 1. Fetch user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, approverId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error("Approver account is inactive or not found.");
    }

    if (user.role === "user" || user.role === "supervisor") {
      throw new Error("Insufficient privileges to approve requests.");
    }

    // 2. Fetch purchase request header
    const [reqHeader] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!reqHeader) {
      throw new Error("Purchase request not found.");
    }

    if (["rejected", "cancelled", "draft"].includes((reqHeader.status || "").toLowerCase())) {
      throw new Error(`Cannot process approval. This request is already closed (${reqHeader.status}).`);
    }

    if (reqHeader.requesterId === user.id && user.role !== "super_admin") {
      throw new Error("Self-approval is not permitted.");
    }

    // High-Value Approval Safeguard (> 50,000 QAR)
    if (action === "approved") {
      const requestCost = reqHeader.baseAmountQar ?? reqHeader.totalEstimatedCost ?? 0;
      if (requestCost >= 50000 && (!comments || comments.trim().length < 5)) {
        throw new Error("High-Value Approval: A brief approval rationale is required for requests exceeding 50,000 QAR.");
      }
    }

    // 3. Find target approval slot
    const allApprovalsForReq = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId))
      .orderBy(approvals.id);

    let targetApproval: any = undefined;
    if (approvalId) {
      targetApproval = allApprovalsForReq.find((a) => a.id === approvalId);
    }
    if (!targetApproval) {
      targetApproval = allApprovalsForReq.find(
        (a) => a.department.toLowerCase() === user.department.toLowerCase() && a.status === "pending"
      ) || allApprovalsForReq.find(
        (a) => a.department.toLowerCase() === user.department.toLowerCase()
      );
    }
    if (!targetApproval && user.role === "super_admin") {
      targetApproval = allApprovalsForReq.find((a) => a.status === "pending") || allApprovalsForReq[0];
    }

    if (!targetApproval) {
      throw new Error(`No approval slot found for department "${user.department}" on this request.`);
    }

    if (targetApproval.status !== "pending") {
      return {
        success: true,
        message: `This stage was already marked as ${targetApproval.status}. No further action needed.`,
        requestStatus: reqHeader.status,
      };
    }

    // 4. Update the specific approval row
    await db
      .update(approvals)
      .set({
        status: action,
        comments: comments?.trim() || null,
        approverId: user.id,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, targetApproval.id));

    // 5. Re-evaluate overall purchase request state
    const updatedApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    let nextRequestStatus = "pending";
    let isLocked = true;

    if (action === "rejected") {
      nextRequestStatus = "rejected";
      isLocked = true;
    } else if (action === "changes_requested") {
      nextRequestStatus = "changes_requested";
      isLocked = false;
    } else {
      const mandatoryApprovals = updatedApprovals.filter((a) => a.isMandatory);
      const additionalApprovals = updatedApprovals.filter((a) => !a.isMandatory);

      const allMandatoryApproved = mandatoryApprovals.every((a) => a.status === "approved");
      const allAdditionalApproved = additionalApprovals.every((a) => a.status === "approved");

      if (allMandatoryApproved && allAdditionalApproved) {
        nextRequestStatus = "approved";
      } else if (reqHeader.status === "pending_dept_head") {
        nextRequestStatus = "pending";
      } else {
        nextRequestStatus = "partially_approved";
      }
    }

    // Update Purchase Request Header
    await db
      .update(purchaseRequests)
      .set({
        status: nextRequestStatus as any,
        isLocked,
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, requestId));

    // 6. Secondary actions: Audit Log & Notifications (non-blocking)
    try {
      await db.insert(auditLogs).values({
        resourceId: requestId,
        resourceType: "purchase_request",
        action: `email_${action}`,
        userId: user.id,
        details: {
          dept: targetApproval.department,
          role: user.role,
          status: action,
          processedBy: user.username,
          source: "email_one_click_action",
          comments: comments || null,
        },
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.warn("[EmailActionService] Non-fatal audit log error:", logErr);
    }

    try {
      // Clear pending notification for this approver
      await notificationService.markPendingActionsCompleted(requestId, user.id);
      if (action === "rejected" || action === "changes_requested" || nextRequestStatus === "approved") {
        await notificationService.markPendingActionsCompleted(requestId);
      }

      // Notify requester
      let type = "purchase_request_updated";
      let notifTitle = "Request Status Updated";
      let notifMessage = `Your request "${reqHeader.title}" is now ${action.replace(/_/g, " ")}.`;

      if (action === "approved") {
        type = "purchase_request_approved";
        notifTitle = "Request Approved";
        notifMessage = `Your request "${reqHeader.title}" was approved by ${user.username} via email sign-off.`;
      } else if (action === "rejected") {
        type = "purchase_request_rejected";
        notifTitle = "Request Rejected";
        notifMessage = `Your request "${reqHeader.title}" was rejected by ${user.username}.${comments ? ` Reason: ${comments}` : ""}`;
      } else if (action === "changes_requested") {
        type = "purchase_request_changes_requested";
        notifTitle = "Changes Requested";
        notifMessage = `Modifications requested on "${reqHeader.title}" by ${user.username}.${comments ? ` Notes: ${comments}` : ""}`;
      }

      await notificationService.createNotification({
        userId: reqHeader.requesterId,
        title: notifTitle,
        message: notifMessage,
        type,
        requestId,
      });
    } catch (notifErr) {
      console.warn("[EmailActionService] Non-fatal notification error:", notifErr);
    }

    return {
      success: true,
      message: `Request ${action === "approved" ? "successfully approved" : action === "rejected" ? "rejected" : "returned for modifications"}!`,
      requestStatus: nextRequestStatus,
    };
  }
}

export const emailActionService = EmailActionService.getInstance();
