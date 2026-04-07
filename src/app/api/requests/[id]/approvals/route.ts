import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, approvals, auditLogs } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

export const dynamic = "force-dynamic";

/**
 * Mandatory approval sequence. Each department must fully approve
 * before the next one in the chain is permitted to act.
 * Directors / GM sit at the same sequential level (either can satisfy).
 */
const MANDATORY_SEQUENCE: string[] = ["Finance", "CEO Office", "General Manager"];

/**
 * Neon-HTTP Compatible Approval Lifecycle (Phase 16 — State Machine Fix)
 *
 * Fix 1 — RBAC Gate:
 *   Users with role='user' (e.g. Accountants) cannot satisfy a mandatory
 *   gatekeeper approval step. Only role='approver' or role='admin' may do so.
 *
 * Fix 2 — Strict Array Validation:
 *   The request only transitions to 'approved' when ALL approval rows
 *   (both mandatory and additionalApprovers) are resolved as 'approved'.
 *
 * Fix 3 — Sequential Stepping:
 *   Enforces Finance → CEO Office → Directors ordering. A department
 *   cannot approve until every earlier mandatory step is 'approved'.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: any = null;
  try {
    const { id: paramId } = await params;
    const requestId = parseInt(paramId);

    // 1. Auth & Context Validation
    user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { status, comments } = body;

    if (!['approved', 'rejected', 'changes_requested'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // 2. Resolve target approval record for this user's department
    const [targetApproval] = await db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.requestId, requestId),
          eq(approvals.department, user.department || '')
        )
      )
      .limit(1);

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

    // ── FIX 3: Sequential Stepping ──────────────────────────────────────────
    // Fetch all current approvals for sequencing check before any update.
    const currentApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    const mySequenceIndex = MANDATORY_SEQUENCE.indexOf(user.department);
    if (mySequenceIndex > 0 && targetApproval?.isMandatory) {
      // Every department that appears BEFORE this one in the sequence must
      // already be 'approved' before this user can act.
      const priorDepts = MANDATORY_SEQUENCE.slice(0, mySequenceIndex);
      const priorMandatory = currentApprovals.filter(
        a => a.isMandatory && priorDepts.includes(a.department)
      );
      const priorAllApproved = priorMandatory.every(a => a.status === 'approved');

      if (!priorAllApproved) {
        const pendingDepts = priorMandatory
          .filter(a => a.status !== 'approved')
          .map(a => a.department)
          .join(', ');
        return NextResponse.json(
          {
            error: `Sequential approval requirement not met.`,
            hint: `The following mandatory steps must be completed before your department can approve: ${pendingDepts}.`
          },
          { status: 409 }
        );
      }
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
      .update(purchaseRequests)
      .set({
        status: nextRequestStatus as any,
        isLocked,
        updatedAt: new Date()
      })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

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
          finalStatus: updatedRequest.status,
          processedBy: user.username,
          isMandatoryStep: targetApproval?.isMandatory ?? false,
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
      requestStatus: updatedRequest.status
    });

  } catch (error: any) {
    console.error("CRITICAL: Final Approval Lifecycle Crash:", error);
    return NextResponse.json({
      error: "Critical failure during status update.",
      message: error.message
    }, { status: 500 });
  }
}
