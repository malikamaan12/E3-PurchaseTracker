import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, approvals, auditLogs, paymentInstallments, users } from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getAuthenticatedUser, canApproveInDepartment, isDepartmentFrozen } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";
import { getExchangeRateToQAR } from "@/lib/utils/currency";

export const dynamic = "force-dynamic";

/**
 * Mandatory approval sequence. Each department must fully approve
 * before the next one in the chain is permitted to act.
 * Directors / GM sit at the same sequential level (either can satisfy).
 */
const MANDATORY_SEQUENCE: string[] = ["Management", "Finance", "CEO Office"];

/**
 * Neon-HTTP Compatible Approval Lifecycle (Phase 16 — State Machine Fix)
 *
 * Fix 1 — RBAC Gate:
 *   Users with role='user' (e.g. Accountants) cannot satisfy a mandatory
 *   gatekeeper approval step. Only role='approver' or role='admin' may do so.
 *
 * Fix 2 — Flexible / Out-of-Order Approval:
 *   Any authorized approver (Additional Approver, Management, Finance, CEO)
 *   can review and approve their stage at any time ("any approver can approve first").
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: any = null;
  try {
    const { id: paramId } = await params;
    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    // 1. Auth & Context Validation
    user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { status, comments, approvalId: requestedApprovalId, department: requestedDept } = body;

    if (!['approved', 'rejected', 'changes_requested'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // ── SELF-APPROVAL GUARD ──────────────────────────────────────────────────
    // A user cannot approve their own purchase request (unless super_admin executive override).
    const [reqHeader] = await db
      .select({ 
        requesterId: purchaseRequests.requesterId, 
        status: purchaseRequests.status, 
        title: purchaseRequests.title, 
        baseAmountQar: purchaseRequests.baseAmountQar, 
        totalEstimatedCost: purchaseRequests.totalEstimatedCost 
      })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!reqHeader) return NextResponse.json({ error: "Purchase request not found." }, { status: 404 });

    if (['rejected', 'cancelled', 'draft'].includes((reqHeader.status || '').toLowerCase())) {
      return NextResponse.json(
        { error: `Cannot process approval. This purchase request is in '${reqHeader.status}' status and closed.` },
        { status: 400 }
      );
    }

    if (reqHeader.requesterId === user.id && user.role !== 'super_admin') {
      return NextResponse.json(
        { error: "Self-approval is not permitted. You cannot approve a request you submitted." },
        { status: 403 }
      );
    }

    // High-Value Approval Safeguard (> 50,000 QAR)
    if (status === 'approved') {
      const requestCost = reqHeader.baseAmountQar ?? reqHeader.totalEstimatedCost ?? 0;
      if (requestCost >= 50000 && (!comments || comments.trim().length < 5)) {
        return NextResponse.json(
          {
            error: "High-Value Approval Rationale Required",
            hint: "This request exceeds 50,000 QAR. Please provide a brief approval comment explaining the financial sign-off rationale."
          },
          { status: 400 }
        );
      }
    }

    // ── 2. DEPARTMENT APPROVAL LOOKUP ────────────────────────────────────────
    // For super_admin: can approve any department slot (by requestedApprovalId, requestedDept, or first pending).
    // For admin & approver: strict exact case-insensitive match on user.department ONLY.
    let targetApproval: any = null;
    const allApprovalsForReq = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId))
      .orderBy(approvals.id);

    if (user.role === 'super_admin') {
      if (requestedApprovalId) {
        targetApproval = allApprovalsForReq.find(a => a.id === Number(requestedApprovalId));
      } else if (requestedDept) {
        targetApproval = allApprovalsForReq.find(a => a.department.toLowerCase().trim() === requestedDept.toLowerCase().trim());
      } else {
        // Match user's own department first, otherwise pick the first pending approval slot
        const userDept = (user.department || '').toLowerCase().trim();
        targetApproval = allApprovalsForReq.find(a => a.department.toLowerCase().trim() === userDept && a.status === 'pending')
          || allApprovalsForReq.find(a => a.department.toLowerCase().trim() === userDept)
          || allApprovalsForReq.find(a => a.status === 'pending')
          || allApprovalsForReq[0];
      }
    } else {
      if (requestedApprovalId) {
        targetApproval = allApprovalsForReq.find(a => a.id === Number(requestedApprovalId) && canApproveInDepartment(user, a.department));
      } else if (requestedDept) {
        targetApproval = allApprovalsForReq.find(a => a.department.toLowerCase().trim() === requestedDept.toLowerCase().trim() && canApproveInDepartment(user, a.department));
      } else {
        // Find first pending slot where user has active approval authority
        targetApproval = allApprovalsForReq.find(a => canApproveInDepartment(user, a.department) && a.status === 'pending')
          || allApprovalsForReq.find(a => canApproveInDepartment(user, a.department));
      }
    }

    if (!targetApproval) {
      if (requestedDept && isDepartmentFrozen(user, requestedDept)) {
        return NextResponse.json(
          { error: `Your approval authority for department "${requestedDept}" is currently frozen.` },
          { status: 403 }
        );
      }
      const approvableDepts = (user.departments || [user.department]).filter((d: string) => canApproveInDepartment(user, d));
      const deptListStr = approvableDepts.length > 0 ? approvableDepts.join(', ') : 'none';
      return NextResponse.json(
        { error: `No approval slot exists for your authorized department(s) (${deptListStr}) on this request. You cannot approve on behalf of another department.` },
        { status: 403 }
      );
    }

    // ── STAGE 1 GATEKEEPER FOR SUPERVISOR REQUESTS ────────────────────────────
    // If request is pending_dept_head, mandatory approvers cannot approve until Stage 1 (Dept Head) is approved.
    if (reqHeader.status === 'pending_dept_head' && targetApproval.isMandatory && user.role !== 'super_admin') {
      return NextResponse.json(
        { 
          error: "Stage 1 Locked", 
          message: "This request was submitted by a supervisor and is awaiting Stage 1 Department Head sign-off before mandatory review is unlocked." 
        }, 
        { status: 403 }
      );
    }

    // ── RBAC GATE ────────────────────────────────────────────────────────────
    // Only role='super_admin', role='admin', or role='approver' may approve.
    // Supervisors and regular users NEVER have approval power.
    if (user.role === 'supervisor' || user.role === 'user') {
      return NextResponse.json(
        {
          error: "Insufficient Authority",
          message: "Supervisors and regular users do not have approval power. Approvals must be performed by authorized department approvers or super admins."
        },
        { status: 403 }
      );
    }

    if (targetApproval.isMandatory && user.role === 'user') {
      return NextResponse.json(
        {
          error: "Insufficient authority. Only designated department approvers, admins, or super admins can satisfy mandatory gatekeeper steps.",
          hint: "Your role does not have approval authority for this step. Contact your department head to proceed."
        },
        { status: 403 }
      );
    }

    // ── ALREADY-PROCESSED GUARD ──────────────────────────────────────────────
    // Prevent double-approving. If the slot is not pending, block the action.
    if (targetApproval.status !== 'pending') {
      return NextResponse.json(
        {
          error: `This approval stage is already ${targetApproval.status}.`,
          hint: targetApproval.status === 'approved'
            ? "Contact an admin to revoke this approval if it was made in error."
            : "The request may have been rejected or changes were requested."
        },
        { status: 409 }
      );
    }

    // 3. SEQUENTIAL UPDATES — update only the specific approval record
    await db
      .update(approvals)
      .set({
        status,
        comments: comments || null,
        approverId: user.id,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, targetApproval.id));

    // ── FIX 2: Strict Array Validation ──────────────────────────────────────
    // Re-fetch the latest state of ALL approval rows (mandatory + additional)
    // after the above update has been applied.
    const updatedApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    let nextRequestStatus = "pending";
    let isLocked = true;

    if (status === "rejected") {
      // Any rejection immediately rejects the whole request.
      nextRequestStatus = "rejected";
      isLocked = true;
    } else if (status === "changes_requested") {
      // Any changes_requested unlocks the request for the requester to edit.
      nextRequestStatus = "changes_requested";
      isLocked = false;
    } else {
      // 'approved' path — evaluate the full picture:
      const mandatoryApprovals = updatedApprovals.filter(a => a.isMandatory);
      const additionalApprovals = updatedApprovals.filter(a => !a.isMandatory);

      const allMandatoryApproved = mandatoryApprovals.every(a => a.status === 'approved');
      const allAdditionalApproved = additionalApprovals.every(a => a.status === 'approved');

      // The request is ONLY fully approved when every single row is resolved.
      // If advancing from pending_dept_head, it becomes active 'pending' (unveiled to mandatory approvers).
      if (allMandatoryApproved && allAdditionalApproved) {
        nextRequestStatus = "approved";
      } else if (reqHeader.status === 'pending_dept_head') {
        nextRequestStatus = "pending";
      } else {
        nextRequestStatus = "partially_approved";
      }
    }

    // 4. Update Purchase Request Header
    const [updatedRequest] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!updatedRequest) throw new Error("Request data lost during lifecycle update.");

    let finalizedProposedCost = undefined;
    if (nextRequestStatus === "approved" && updatedRequest.proposedRevisedCost) {
      finalizedProposedCost = updatedRequest.proposedRevisedCost;
    }

    // Maintain Creation-Time Currency Lock-In
    const exchangeRate = updatedRequest.exchangeRate;
    let baseAmountQar = updatedRequest.baseAmountQar;
    
    if (nextRequestStatus === "approved") {
      const activeCost = finalizedProposedCost ?? updatedRequest.revisedTotalCost ?? updatedRequest.totalEstimatedCost ?? 0;
      baseAmountQar = Math.round(activeCost * Number(exchangeRate || 1.0));
    }

    const [finalRequest] = await db
      .update(purchaseRequests)
      .set({
        status: nextRequestStatus as any,
        isLocked,
        revisedTotalCost: finalizedProposedCost ?? updatedRequest.revisedTotalCost,
        proposedRevisedCost: finalizedProposedCost ? null : updatedRequest.proposedRevisedCost, // Clear staging if approved
        exchangeRate,
        baseAmountQar,
        updatedAt: new Date()
      })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

    // ── VARIATION MATERIALIZATION ───────────────────────────────────────────
    // If a budget variation was just approved, generate the actual financial
    // installment row for the delta.
    if (finalizedProposedCost && nextRequestStatus === "approved") {
      const previousValidBudget = updatedRequest.revisedTotalCost ?? updatedRequest.totalEstimatedCost ?? 0;
      const deltaAmount = Math.round(finalizedProposedCost - previousValidBudget);

      if (deltaAmount > 0) {
        const dueDatePlaceholder = new Date();
        dueDatePlaceholder.setDate(dueDatePlaceholder.getDate() + 30);

        await db.insert(paymentInstallments).values({
          requestId,
          vendorId: updatedRequest.vendorId as number,
          installmentName: `Approved Variation Delta Δ +${deltaAmount.toLocaleString()} QAR`,
          dueDate: dueDatePlaceholder,
          valueType: "FIXED_AMOUNT",
          amountValue: deltaAmount,
          calculatedAmount: deltaAmount,
          calculatedAmountQar: Math.round(deltaAmount * Number(exchangeRate || 1.0)),
          exchangeRate: exchangeRate,
          currency: updatedRequest.currency ?? "QAR",
          status: "pending", // Now officially part of the payment queue
          financeNotes: `Materialized upon final sign-off of variation ${previousValidBudget.toLocaleString()} → ${finalizedProposedCost.toLocaleString()} QAR.`,
          createdBy: user.id,
        });
      }
    }

    // 5. SECONDARY ACTIONS (Fault-Tolerant)

    // A. Audit Logging
    try {
      await db.insert(auditLogs).values({
        resourceId: requestId,
        resourceType: "purchase_request",
        action: `approval_${status}`,
        userId: user.id,
        details: {
          dept: targetApproval.department || user.department,
          role: user.role,
          status: status,
          finalStatus: finalRequest.status,
          processedBy: user.username,
          isMandatoryStep: targetApproval.isMandatory ?? false,
          approvalId: targetApproval.id,
        },
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.warn("[Lifecycle] Audit Log failure (Async):", logErr);
    }

    // B. Notifications
    try {
      // 1. Automatically clear the approver's pending task notification from their bell icon
      await notificationService.markPendingActionsCompleted(requestId, user.id);

      // If request reached terminal/unlock state, clear all remaining pending action notifications for this request
      if (status === 'rejected' || status === 'changes_requested' || finalRequest.status === 'approved') {
        await notificationService.markPendingActionsCompleted(requestId);
      }

      // 2. Notify the requester with specific status details
      let type = 'purchase_request_updated';
      let notifTitle = `Request Status Updated`;
      let notifMessage = `Your request "${updatedRequest.title}" is now ${status.replace(/_/g, ' ')}.`;
      let notifPriority: 'normal' | 'high' = 'normal';

      if (status === 'approved') {
        type = 'purchase_request_approved';
        notifTitle = `Request Approved`;
        notifMessage = `Your request "${updatedRequest.title}" was approved by ${user.username} (${targetApproval.department || user.department}).`;
      } else if (status === 'rejected') {
        type = 'purchase_request_rejected';
        notifTitle = `Request Rejected`;
        notifMessage = `Your request "${updatedRequest.title}" was rejected by ${user.username}.${comments ? ` Reason: ${comments}` : ''}`;
        notifPriority = 'high';
      } else if (status === 'changes_requested') {
        type = 'purchase_request_changes_requested';
        notifTitle = `Changes Requested`;
        notifMessage = `Modifications requested on "${updatedRequest.title}" by ${user.username}.${comments ? ` Notes: ${comments}` : ''}`;
        notifPriority = 'high';
      }

      await notificationService.createNotification({
        userId: updatedRequest.requesterId,
        title: notifTitle,
        message: notifMessage,
        type,
        requestId,
        priority: notifPriority,
      });

      // If advancing from Stage 1 (pending_dept_head) to Stage 2, unveil to Mandatory Approvers
      if (reqHeader.status === 'pending_dept_head' && status === 'approved') {
        try {
          const mandatoryIds = await notificationService.getAuthorizedApproverUserIds({
            targetDepartments: MANDATORY_SEQUENCE,
            excludeUserId: user.id,
          });
          if (mandatoryIds.length > 0) {
            await notificationService.createPendingApprovalNotification({
              requestId,
              requestTitle: updatedRequest.title,
              requesterName: `${user.username} (Dept Head Sign-off)`,
              requesterDepartment: user.department || "Procurement",
              approverIds: mandatoryIds,
              targetDepartments: MANDATORY_SEQUENCE,
            });
          }
        } catch (unveilErr) {
          console.warn("[Supervisor Unveil Notification Failed]:", unveilErr);
        }
      }
    } catch (notifErr) {
      console.warn("[Lifecycle] Notification failure (Async):", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${status} status.`,
      requestStatus: finalRequest.status
    });

  } catch (error: any) {
    console.error("CRITICAL: Final Approval Lifecycle Crash:", error);
    return NextResponse.json({
      error: "Critical failure during status update.",
      message: error.message
    }, { status: 500 });
  }
}
