import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/utils/errors";
import { db } from "@db";
import { safeParseItems } from "@/lib/utils/safe-parse";
import { 
  purchaseRequests, 
  users, 
  vendors, 
  subPurposes, 
  approvals, 
  fileAttachments, 
  auditLogs,
  approvalAuditLogs,
  departments,
  paymentInstallments
} from "@db/schema";
import { eq, and, or, inArray, desc, count } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { updateRequestSchema } from "@/lib/validation";
import { notificationService } from "@/lib/services/NotificationService";

export const dynamic = 'force-dynamic';

// GET /api/requests/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await params;
  const requestId = parseInt(paramId);
  let authenticatedUser: any = null;

  try {
    authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // Fetch related data in parallel for better performance
    // Implement 8s safety timeout for the parallel fetch
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Database synchronization timeout")), 8000)
    );

    const dataFetchPromise = Promise.all([
      db.select().from(users).where(eq(users.id, request.requesterId)).limit(1),
      db.select().from(vendors).where(eq(vendors.id, request.vendorId)).limit(1),
      request.subPurposeId 
        ? db.select().from(subPurposes).where(eq(subPurposes.id, request.subPurposeId)).limit(1)
        : Promise.resolve([null]),
      db.select({
        id: approvals.id,
        status: approvals.status,
        comments: approvals.comments,
        department: approvals.department,
        createdAt: approvals.createdAt,
        approver: {
          id: users.id,
          username: users.username,
        }
      })
      .from(approvals)
      .leftJoin(users, eq(users.id, approvals.approverId))
      .where(eq(approvals.requestId, requestId)),
      db.select().from(fileAttachments).where(eq(fileAttachments.requestId, requestId)),
      db.select().from(paymentInstallments).where(eq(paymentInstallments.requestId, requestId)),
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        timestamp: auditLogs.timestamp,
        details: auditLogs.details,
        user: {
          username: users.username,
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(
        and(
          eq(auditLogs.resourceId, requestId),
          or(
            eq(auditLogs.resourceType, "purchase_request"),
            eq(auditLogs.resourceType, "purchase_requests")
          )
        )
      )
      .orderBy(desc(auditLogs.timestamp))
    ]);

    const [
      [requester],
      [vendor],
      [subPurpose],
      requestApprovals,
      attachments,
      installments,
      requestAuditLogs
    ] = await Promise.race([dataFetchPromise, timeoutPromise]) as any;

    // --- DATA ASSEMBLY & HARDENING ---
    try {
      const safeApprovals = Array.isArray(requestApprovals) ? requestApprovals : [];
      const depts: string[] = Array.from(new Set(safeApprovals.map((a: any) => a.department as string).filter(Boolean))) as string[];
      
      const deptStakeholders = depts.length > 0 
        ? await db
            .select({
              id: users.id,
              username: users.username,
              department: users.department,
            })
            .from(users)
            .where(
              and(
                inArray(users.department, depts),
                eq(users.role, 'approver')
              )
            )
        : [];

      // Map stakeholders to each approval step
      const approvalsWithStakeholders = safeApprovals.map((approval: any) => ({
        ...approval,
        stakeholders: deptStakeholders.filter((s: any) => s.department === approval.department)
      }));

      // Parse JSON fields (Items & Additional Approvers are text columns in DB)
      const parseJsonArray = (data: any, label: string) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data !== "string") return [];
        try {
          const parsed = JSON.parse(data);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e: any) {
          console.warn(`[API] Failed to parse ${label} for request ${requestId}:`, e.message);
          return [];
        }
      };

      const parsedItems = safeParseItems(request.items);
      const parsedApprovers = parseJsonArray(request.additionalApprovers, "additionalApprovers");

      return NextResponse.json({
        ...request,
        items: parsedItems,
        additionalApprovers: parsedApprovers,
        requester: requester || null,
        vendor: vendor || null,
        subPurpose: subPurpose || null,
        approvals: approvalsWithStakeholders,
        attachments: Array.isArray(attachments) ? attachments : [],
        paymentInstallments: Array.isArray(installments) ? installments : [],
        auditLogs: Array.isArray(requestAuditLogs) ? requestAuditLogs : []
      });
    } catch (assemblyError: any) {
      console.error("[Native API] Data Assembly Failure:", {
        message: assemblyError.message,
        requestId,
        userId: authenticatedUser?.id
      });
      throw assemblyError; // Re-throw to be caught by the outer catch block
    }
  } catch (error: any) {
    console.error("[Native API] GET Request Detail Error:", {
      message: error.message,
      stack: error.stack,
      requestId,
      userId: authenticatedUser?.id
    });
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error.message,
      code: "SYSTEM_RUNTIME_ERR_001"
    }, { status: 500 });
  }
}

// PATCH /api/requests/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const rawBody = await req.json();
    const validation = updateRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: "Validation Failed", details: validation.error.format() }, { status: 400 });
    }
    const updateData = validation.data;

    const [existing] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // ─── AUTHENTICATION & AUTHORITY GATEKEEPING ────────────────────────────────
    const isAdmin = user.role === 'admin';
    const isFinance = user.department?.toLowerCase() === 'finance';
    const isOwner = existing.requesterId === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // Check for existing approvals to determine locking
    const [approvedCountRecord] = await db
      .select({ countValue: count() })
      .from(approvals)
      .where(and(eq(approvals.requestId, requestId), eq(approvals.status, "approved")));
    const approvedCount = Number(approvedCountRecord?.countValue || 0);

    // Lock Check: 
    // - Admins can ALWAYS edit unless 'fully_paid' or 'archived' (future proofing)
    // - Requesters can edit if status is 'draft', 'rejected', 'changes_requested'
    // - Requesters can edit 'pending' ONLY if approvedCount is 0
    const isLockedStatus = !["draft", "rejected", "changes_requested", "pending"].includes(existing.status);
    const isLockedForRequester = existing.status === "pending" && approvedCount > 0;

    if (!isAdmin && (isLockedStatus || isLockedForRequester)) {
      return NextResponse.json({ 
        error: "Request Locked", 
        message: isLockedForRequester 
          ? "This request has already received departmental approvals and is locked for editing. Please contact an Admin for force-updates."
          : `This request is currently "${existing.status}" and cannot be modified.` 
      }, { status: 403 });
    }

    // ─── FINANCE VARIATION BYPASS ──────────────────────────────────────────────
    const isVariationOnly = updateData.revisedTotalCost !== undefined && Object.keys(updateData).length === 1;

    if ((isAdmin || isFinance) && isVariationOnly) {
      const newTotal = Math.round(Number(updateData.revisedTotalCost));
      const [updated] = await db.update(purchaseRequests)
        .set({ revisedTotalCost: newTotal, updatedAt: new Date() })
        .where(eq(purchaseRequests.id, requestId))
        .returning();
      return NextResponse.json(updated);
    }

    // Sanitize update data
    const { requester, vendor, subPurpose, approvals: _a, attachments: _att, attachmentIds, id: _id, revisedTotalCost: _rvc, ...cleanData } = rawBody;

    // Financial Integer Safety
    if (cleanData.totalEstimatedCost) cleanData.totalEstimatedCost = Math.round(Number(cleanData.totalEstimatedCost));
    if (cleanData.freightAmount) cleanData.freightAmount = Math.round(Number(cleanData.freightAmount));

    // Handle array primitives converting to DB text columns for storage
    const itemsJson = cleanData.items && Array.isArray(cleanData.items) ? JSON.stringify(cleanData.items) : null;
    const approversJson = cleanData.additionalApprovers && Array.isArray(cleanData.additionalApprovers) ? JSON.stringify(cleanData.additionalApprovers) : null;

    if (itemsJson) cleanData.items = itemsJson as any;
    if (approversJson) cleanData.additionalApprovers = approversJson as any;

    if (cleanData.createdAt) cleanData.createdAt = new Date(cleanData.createdAt);
    if (cleanData.updatedAt) cleanData.updatedAt = new Date(cleanData.updatedAt);

    // ─── INTELLIGENT WORKFLOW RESET (Diffing) ──────────────────────────────────
    // We reset the workflow IF line items, total cost, or vendor changes.
    // Minor text changes (title, description, priority) preserve signatures.
    const hasFinancialChange = 
      (cleanData.totalEstimatedCost !== undefined && cleanData.totalEstimatedCost !== existing.totalEstimatedCost) ||
      (cleanData.vendorId !== undefined && cleanData.vendorId !== existing.vendorId) ||
      (itemsJson !== null && itemsJson !== JSON.stringify(existing.items));

    const isWithdrawal = existing.status === "pending" && cleanData.status === "draft";
    const forceReset = isWithdrawal || hasFinancialChange || existing.status === "changes_requested";

    if (forceReset && approvedCount > 0) {
      // Wipe approvals: The signatures are no longer valid for the new terms.
      await db.delete(approvals).where(eq(approvals.requestId, requestId));
      
      // Log the reset
      await db.insert(auditLogs).values({
        resourceId: requestId,
        resourceType: "purchase_request",
        action: hasFinancialChange ? "MODIFIED_RESET" : "WITHDRAWN",
        userId: user.id,
        details: { reason: "Financial/Scope change detected. Signatures invalidated.", changedFields: hasFinancialChange ? "Financials" : "Manual Withdrawal" },
        timestamp: new Date(),
      });
    }

    const [updated] = await db
      .update(purchaseRequests)
      .set({ 
        ...cleanData, 
        updatedAt: new Date(),
        // Re-lock if it's still pending or being submitted
        isLocked: cleanData.status === "pending" || (existing.status === "pending" && !forceReset)
      })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

    // Link any newly uploaded attachments
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      await db.update(fileAttachments)
        .set({ requestId: requestId })
        .where(inArray(fileAttachments.id, attachmentIds));
    }

    // Transition to pending: Create approval records and send notifications
    if (updateData.status === "pending" && (existing.status === "draft" || existing.status === "changes_requested")) {
      // 1. Three mandatory departments are ALWAYS required, regardless of DB config or request value.
      //    These are the non-negotiable gatekeeper sign-offs in the procurement workflow.
      const mandatoryDepts = ["Finance", "CEO Office", "Management"];

      // 3. Combine with Additional Approvers (non-mandatory)
      let additionalDepts: string[] = [];
      try {
        if (typeof updated.additionalApprovers === 'string') {
          additionalDepts = JSON.parse(updated.additionalApprovers);
        } else if (Array.isArray(updated.additionalApprovers)) {
          additionalDepts = updated.additionalApprovers;
        }
        } catch (e: any) {}

      // Additional approvers must not overlap with mandatory departments
      const filteredAdditional = additionalDepts.filter(d => !mandatoryDepts.includes(d));
      const allRequiredDepts = [...mandatoryDepts, ...filteredAdditional];

      // 4. Create Approval Records
      //    IMPORTANT: Mandatory gatekeeper rows (Finance, CEO Office, Directors) are
      //    NEVER auto-approved, even if the requester is an admin. They must always
      //    receive an explicit sign-off from a qualified person in that department.
      for (const dept of allRequiredDepts) {
        const [existingApproval] = await db
          .select()
          .from(approvals)
          .where(and(eq(approvals.requestId, requestId), eq(approvals.department, dept)))
          .limit(1);

        if (!existingApproval) {
          const isMandatory = mandatoryDepts.includes(dept);

          // Auto-approval is ONLY allowed for non-mandatory (additional) approver steps
          // where the requester has authority in that specific department.
          const canAutoApprove =
            !isMandatory &&
            user.department === dept &&
            (user.role === 'approver' || user.role === 'admin');

          const [newApproval] = await db.insert(approvals).values({
            requestId,
            approverId: canAutoApprove ? user.id : null,
            department: dept,
            status: canAutoApprove ? "approved" : "pending",
            isMandatory,
            comments: canAutoApprove ? "Auto-approved: Request submitted by authorized department authority" : null,
            processedAt: canAutoApprove ? new Date() : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();

          if (canAutoApprove) {
            await db.insert(auditLogs).values({
              resourceId: requestId,
              resourceType: "purchase_request",
              action: "approver_deduplicated",
              userId: user.id,
              details: {
                department: dept,
                reason: "Non-mandatory step: requester has authority for this stage",
                approvalId: newApproval.id
              },
              timestamp: new Date(),
            });
          }
        }
      }

      // 4. Notifications
      const deptApprovers = await db.select().from(users).where(and(inArray(users.department, allRequiredDepts), eq(users.isActive, true)));
      const adminUsers = await db.select().from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      const targetUserIds = new Set<number>();
      deptApprovers.forEach((a: any) => targetUserIds.add(a.id));
      adminUsers.forEach((a: any) => targetUserIds.add(a.id));
      targetUserIds.delete(user.id);

      await Promise.all(Array.from(targetUserIds).map((userId: any) => 
        notificationService.createNotification({
          userId,
          title: "New Purchase Request Pending",
          message: `"${updated.title}" requires your approval`,
          type: "approval_required",
          requestId: updated.id,
          priority: "high",
          actionType: "approve",
        })
      ));

      await db.update(purchaseRequests).set({ isLocked: true, updatedAt: new Date() }).where(eq(purchaseRequests.id, requestId));
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Native API] PUT Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/requests/[id]
 * Deletes a purchase request if it has no approvals.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // Permissions: Owner or Admin
    const isOwner = request.requesterId === user.id;
    const isAdmin = user.role?.toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied. Only owner or admin can delete." }, { status: 403 });
    }

    // Restriction: Cannot delete if any approval is "approved"
    // Requirement: Admins are also restricted by the "no approvals yet" rule.
    const [approvedCountRecord] = await db
      .select({ countValue: count() })
      .from(approvals)
      .where(and(eq(approvals.requestId, requestId), eq(approvals.status, "approved")));
    
    const approvedCount = Number(approvedCountRecord?.countValue || 0);

    if (approvedCount > 0) {
      return NextResponse.json({ error: "Compliance Rule: Once a signature is on a document, it cannot be deleted." }, { status: 403 });
    }

    // Action: Insert Tombstone Audit Log (Must do before deleting the request if it references it, but we keep audit logs)
    await db.insert(auditLogs).values({
      resourceId: requestId,
      resourceType: "purchase_request",
      action: "DELETED",
      userId: user.id,
      details: {
        requestNumber: request.requestNumber,
        title: request.title,
        deletedBy: user.username,
        reason: "User/Admin requested deletion of unapproved PR"
      },
      timestamp: new Date(),
    });

    // Final Action: Delete Request (Cascading starts here for approvals, items, attachments)
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, requestId));

    return NextResponse.json({ message: "Request deleted successfully" });
  } catch (error: any) {
    console.error("[Native API] DELETE Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
