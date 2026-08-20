import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, approvals, auditLogs } from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getAuthenticatedUser, canApproveInDepartment } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (user.role === 'supervisor' || user.role === 'user') {
      return NextResponse.json({ 
        error: "Insufficient Authority", 
        message: "Supervisors and regular users do not have approval power." 
      }, { status: 403 });
    }

    const { requestIds = [], comments = "" } = await req.json().catch(() => ({}));
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: "No request IDs provided" }, { status: 400 });
    }

    const approvedList: number[] = [];

    for (const reqId of requestIds) {
      const id = Number(reqId);
      if (isNaN(id)) continue;

      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, id))
        .limit(1);

      if (!request) continue;

      // Prevent self-approval
      if (request.requesterId === user.id && user.role !== 'super_admin') continue;

      const allApprovals = await db
        .select()
        .from(approvals)
        .where(eq(approvals.requestId, id))
        .orderBy(approvals.id);

      let targetApproval: any = null;
      if (user.role === 'super_admin') {
        targetApproval = allApprovals.find(a => a.status === 'pending') || allApprovals[0];
      } else {
        targetApproval = allApprovals.find(a => a.status === 'pending' && canApproveInDepartment(user, a.department));
      }

      if (!targetApproval || targetApproval.status !== 'pending') continue;

      // Update approval
      await db
        .update(approvals)
        .set({
          status: 'approved',
          comments: comments || "Bulk approved",
          approverId: user.id,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvals.id, targetApproval.id));

      // Recalculate overall purchase request status
      const updatedApprovals = await db
        .select()
        .from(approvals)
        .where(eq(approvals.requestId, id));

      const mandatoryApprovals = updatedApprovals.filter(a => a.isMandatory);
      const additionalApprovals = updatedApprovals.filter(a => !a.isMandatory);

      const allMandatoryApproved = mandatoryApprovals.every(a => a.status === 'approved');
      const allAdditionalApproved = additionalApprovals.every(a => a.status === 'approved');

      let nextRequestStatus = "partially_approved";
      if (allMandatoryApproved && allAdditionalApproved) {
        nextRequestStatus = "approved";
      } else if (request.status === 'pending_dept_head') {
        nextRequestStatus = "pending";
      }

      let finalizedProposedCost = undefined;
      if (nextRequestStatus === "approved" && request.proposedRevisedCost) {
        finalizedProposedCost = request.proposedRevisedCost;
      }

      const exchangeRate = request.exchangeRate;
      let baseAmountQar = request.baseAmountQar;
      if (nextRequestStatus === "approved") {
        const activeCost = finalizedProposedCost ?? request.revisedTotalCost ?? request.totalEstimatedCost ?? 0;
        baseAmountQar = Math.round(activeCost * Number(exchangeRate || 1.0));
      }

      await db
        .update(purchaseRequests)
        .set({
          status: nextRequestStatus as any,
          isLocked: true,
          totalEstimatedCost: finalizedProposedCost ?? request.totalEstimatedCost,
          baseAmountQar,
          proposedRevisedCost: nextRequestStatus === "approved" ? null : request.proposedRevisedCost,
          updatedAt: new Date(),
        })
        .where(eq(purchaseRequests.id, id));

      // Audit log
      await db.insert(auditLogs).values({
        resourceId: id,
        resourceType: "purchase_request",
        action: "APPROVED",
        userId: user.id,
        details: {
          approvalId: targetApproval.id,
          department: targetApproval.department,
          processedBy: user.username,
          finalStatus: nextRequestStatus,
          bulk: true,
        },
        timestamp: new Date(),
      });

      // Clear pending action notification for this approver
      try {
        await notificationService.markPendingActionsCompleted(id, user.id);

        // Notify requester
        await notificationService.createNotification({
          userId: request.requesterId,
          title: nextRequestStatus === "approved" ? "Request Fully Approved" : "Request Approved",
          message: nextRequestStatus === "approved"
            ? `Your request "${request.title}" has been fully approved by all required departments.`
            : `Your request "${request.title}" was approved by ${user.username} (${targetApproval.department || 'Management'}).`,
          type: nextRequestStatus === "approved" ? "purchase_request_fully_approved" : "purchase_request_approved",
          requestId: id,
          priority: "normal",
        });
      } catch (notifErr) {
        console.warn("[Bulk Approve] Notification error:", notifErr);
      }

      approvedList.push(id);
    }

    return NextResponse.json({ 
      message: `Successfully approved ${approvedList.length} request(s)`,
      approvedIds: approvedList
    });
  } catch (error: any) {
    console.error("[Bulk Approve API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
