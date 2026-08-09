import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, approvals, auditLogs, paymentInstallments } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
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
    const { status, comments } = body;

    if (!['approved', 'rejected', 'changes_requested'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // High-Value Approval Safeguard (> 50,000 QAR)
    if (status === 'approved') {
      const [reqCheck] = await db
        .select({ baseAmountQar: purchaseRequests.baseAmountQar, totalEstimatedCost: purchaseRequests.totalEstimatedCost })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);
      
      const requestCost = reqCheck?.baseAmountQar ?? reqCheck?.totalEstimatedCost ?? 0;
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

    // 2. Resolve target approval record for this user's department
    let targetApproval = (await db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.requestId, requestId),
          eq(approvals.department, user.department || '')
        )
      )
      .limit(1))[0];

    if (!targetApproval) {
      // Fuzzy match or fallback for Admins
      const allApprovalsForReq = await db
        .select()
        .from(approvals)
        .where(eq(approvals.requestId, requestId))
        .orderBy(approvals.id);

      targetApproval = allApprovalsForReq.find(a => 
        (user.department && a.department.toLowerCase().includes(user.department.toLowerCase())) ||
        (user.department && user.department.toLowerCase().includes(a.department.toLowerCase()))
      ) as typeof targetApproval;

      // If still not found, and user is an admin acting as an approver, default to the FIRST pending approval
      if (!targetApproval && user.role === 'admin') {
        targetApproval = allApprovalsForReq.find(a => a.status === 'pending') as typeof targetApproval;
      }
    }

    if (!targetApproval && user.role !== 'admin') {
      return NextResponse.json({ error: "No pending approval for your department." }, { status: 403 });
    }

    // ── FIX 1: RBAC Gate ────────────────────────────────────────────────────
    // A mandatory gatekeeper step may only be satisfied by role='approver'
    // or role='admin'. Regular users (e.g. Accountants) are rejected here.
    if (targetApproval?.isMandatory && user.role === 'user') {
      return NextResponse.json(
        {
          error: "Insufficient authority. Only designated department approvers or admins can satisfy mandatory gatekeeper steps.",
          hint: "Your role does not have approval authority for this step. Contact your Finance Head to proceed."
        },
        { status: 403 }
      );
    }

    // 3. SEQUENTIAL UPDATES — update only the specific approval record
    const approvalId = targetApproval?.id;

    if (approvalId) {
      await db
        .update(approvals)
        .set({
          status,
          comments: comments || null,
          approverId: user.id,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvals.id, approvalId));
    }

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
      // Until then it stays in 'partially_approved'.
      if (allMandatoryApproved && allAdditionalApproved) {
        nextRequestStatus = "approved";
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
          dept: user.department,
          role: user.role,
          status: status,
          finalStatus: finalRequest.status,
          processedBy: user.username,
          isMandatoryStep: targetApproval?.isMandatory ?? false,
          isAdminBypass: user.role === 'admin',
        },
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.warn("[Lifecycle] Audit Log failure (Async):", logErr);
    }

    // B. Notifications
    try {
      let type = 'purchase_request_updated';
      if (status === 'approved') type = 'purchase_request_approved';
      if (status === 'rejected') type = 'purchase_request_rejected';

      await notificationService.createNotification({
        userId: updatedRequest.requesterId,
        title: `Request ${status === 'approved' ? 'Approved' : 'Status Updated'}`,
        message: `Your request "${updatedRequest.title}" is now ${status.replace(/_/g, ' ')}.`,
        type,
        requestId,
        priority: status === 'rejected' ? 'high' : 'normal',
      });
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
