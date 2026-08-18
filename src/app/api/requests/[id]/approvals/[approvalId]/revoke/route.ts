import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, approvals, auditLogs, users } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

export const dynamic = "force-dynamic";

/**
 * POST /api/requests/[id]/approvals/[approvalId]/revoke
 *
 * Admin-only endpoint to revoke a previously-approved approval slot.
 * Resets the slot to pending and drops the PR status back to partially_approved.
 * Writes an audit log and notifies the original approver and requester.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  try {
    const { id: paramId, approvalId: paramApprovalId } = await params;
    const requestId = parseInt(paramId);
    const approvalId = parseInt(paramApprovalId);

    if (isNaN(requestId) || isNaN(approvalId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // ── AUTH: super_admin only ────────────────────────────────────────────────
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Access denied. Only Super Admin has governance authority to revoke approvals." },
        { status: 403 }
      );
    }

    // ── BODY VALIDATION ───────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "A reason for revocation is required (minimum 10 characters)." },
        { status: 400 }
      );
    }

    // ── LOAD THE APPROVAL ROW ─────────────────────────────────────────────────
    const [targetApproval] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, approvalId), eq(approvals.requestId, requestId)))
      .limit(1);

    if (!targetApproval) {
      return NextResponse.json(
        { error: "Approval record not found for this request." },
        { status: 404 }
      );
    }

    // ── GUARD: must currently be approved ────────────────────────────────────
    if (targetApproval.status !== "approved") {
      return NextResponse.json(
        {
          error: `Cannot revoke — this approval slot is currently '${targetApproval.status}', not 'approved'.`,
        },
        { status: 409 }
      );
    }

    // ── LOAD THE PURCHASE REQUEST ─────────────────────────────────────────────
    const [prRecord] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!prRecord) {
      return NextResponse.json({ error: "Purchase request not found." }, { status: 404 });
    }

    // ── GUARD: cannot revoke on terminal states ───────────────────────────────
    if (["fully_paid", "archived"].includes(prRecord.status)) {
      return NextResponse.json(
        { error: `Cannot revoke an approval on a '${prRecord.status}' request.` },
        { status: 409 }
      );
    }

    // ── Capture original values for audit ────────────────────────────────────
    const originalApproverId = targetApproval.approverId;
    const originalProcessedAt = targetApproval.processedAt;
    const originalComments = targetApproval.comments;

    // ── 1. RESET the approval slot to pending ─────────────────────────────────
    await db
      .update(approvals)
      .set({
        status: "pending",
        approverId: null,
        processedAt: null,
        comments: null,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId));

    // ── 2. RECALCULATE PR STATUS ──────────────────────────────────────────────
    // After reset, if any mandatory approval is still pending → partially_approved
    const allApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    const anyPending = allApprovals.some((a) => a.status === "pending");
    const newPrStatus = anyPending ? "partially_approved" : prRecord.status;

    await db
      .update(purchaseRequests)
      .set({
        status: newPrStatus as any,
        isLocked: true,
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, requestId));

    // ── 3. AUDIT LOG ──────────────────────────────────────────────────────────
    await db.insert(auditLogs).values({
      resourceId: requestId,
      resourceType: "purchase_request",
      action: "APPROVAL_REVOKED",
      userId: user.id,
      details: {
        approvalId,
        department: targetApproval.department,
        revokedBy: user.username,
        revokedByDept: user.department,
        reason: reason.trim(),
        originalApproverId,
        originalProcessedAt,
        originalComments,
        previousPrStatus: prRecord.status,
        newPrStatus,
      },
      timestamp: new Date(),
    });

    // ── 4. NOTIFICATIONS (fault-tolerant) ─────────────────────────────────────
    try {
      // Notify the original approver whose sign-off was removed
      if (originalApproverId) {
        await notificationService.createNotification({
          userId: originalApproverId,
          title: "Your Approval Was Revoked",
          message: `Your ${targetApproval.department} approval on "${prRecord.title}" was revoked by ${user.username}. Reason: ${reason.trim()}`,
          type: "purchase_request_updated",
          requestId,
          priority: "high",
        });
      }

      // Notify the requester
      if (prRecord.requesterId !== originalApproverId) {
        await notificationService.createNotification({
          userId: prRecord.requesterId,
          title: "Approval Stage Revoked",
          message: `The ${targetApproval.department} approval on your request "${prRecord.title}" was revoked by an admin. The request is now back to partially approved status.`,
          type: "purchase_request_updated",
          requestId,
          priority: "normal",
        });
      }
    } catch (notifErr) {
      console.warn("[Revoke] Notification failure (non-fatal):", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `${targetApproval.department} approval revoked successfully. The slot is now pending.`,
      approvalId,
      newPrStatus,
    });
  } catch (error: any) {
    console.error("[Revoke] Critical failure:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
