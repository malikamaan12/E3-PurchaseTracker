import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, approvals, auditLogs } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

/**
 * POST /api/requests/[id]/approvals/[approvalId]/clarification
 *
 * Allows the original approver or a Super Admin to append a timestamped
 * clarification or condition to an already-approved sign-off note.
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

    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // ── 2. BODY VALIDATION ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { clarification, mode = "append" } = body;

    if (!clarification || typeof clarification !== "string" || clarification.trim().length < 3) {
      return NextResponse.json(
        { error: "Clarification note is required (minimum 3 characters)." },
        { status: 400 }
      );
    }

    // ── 3. LOAD APPROVAL RECORD ────────────────────────────────────────────
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

    if (targetApproval.status !== "approved") {
      return NextResponse.json(
        { error: `Clarification can only be added to approved stages. Current status is '${targetApproval.status}'.` },
        { status: 409 }
      );
    }

    // ── 4. AUTHORIZATION CHECK ─────────────────────────────────────────────
    // Allowed if: user is the original approver OR user is super_admin
    const isOriginalApprover = targetApproval.approverId === user.id;
    const isSuperAdmin = user.role === "super_admin";

    if (!isOriginalApprover && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Access denied. Only the original approver or Super Admin can add clarification remarks." },
        { status: 403 }
      );
    }

    // ── 5. FORMAT UPDATED COMMENTS ─────────────────────────────────────────
    const dateFormatted = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const timestampPrefix = `[Clarification by ${user.username} (${user.department}) on ${dateFormatted}]:`;
    const previousComments = targetApproval.comments || "";
    
    let newComments = "";
    if (mode === "replace" && isSuperAdmin) {
      newComments = clarification.trim();
    } else {
      newComments = previousComments
        ? `${previousComments}\n\n${timestampPrefix}\n${clarification.trim()}`
        : `${timestampPrefix}\n${clarification.trim()}`;
    }

    // ── 6. UPDATE DB ───────────────────────────────────────────────────────
    await db
      .update(approvals)
      .set({
        comments: newComments,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId));

    // ── 7. AUDIT LOG ───────────────────────────────────────────────────────
    try {
      await db.insert(auditLogs).values({
        resourceId: requestId,
        resourceType: "purchase_request",
        action: "APPROVAL_CLARIFICATION_ADDED",
        userId: user.id,
        details: {
          approvalId,
          department: targetApproval.department,
          author: user.username,
          authorRole: user.role,
          authorDept: user.department,
          addedClarification: clarification.trim(),
          previousComments,
          newComments,
        },
        timestamp: new Date(),
      });
    } catch (auditErr) {
      console.warn("[Clarification] Audit log error (non-fatal):", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Clarification remarks recorded successfully.",
      approvalId,
      comments: newComments,
    });
  } catch (error: any) {
    console.error("[Clarification] Critical failure:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
