import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { 
  purchaseRequests, 
  approvals, 
  approvalAuditLogs, 
  users 
} from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";
import { AppError } from "@/lib/utils/errors";

export const dynamic = 'force-dynamic';

// POST /api/requests/[id]/approvals
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    const { status, comments } = await req.json();

    if (!["approved", "rejected", "changes_requested"].includes(status)) {
      return NextResponse.json({ error: "Invalid approval status" }, { status: 400 });
    }

    // 1. Fetch the parent request
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.status !== "pending") {
      return NextResponse.json({ error: `Cannot act on a request with status: "${request.status}"` }, { status: 400 });
    }

    // 2. Check if this user's department has a pending approval record
    const [deptApproval] = await db
      .select()
      .from(approvals)
      .where(and(
        eq(approvals.requestId, requestId),
        eq(approvals.department, user.department)
      ))
      .limit(1);

    const isAdmin = user.role === 'admin';

    if (!deptApproval && !isAdmin) {
      return NextResponse.json({ error: "Your department is not in the approval chain for this request." }, { status: 403 });
    }
    if (deptApproval?.status === "approved" && !isAdmin) {
      return NextResponse.json({ error: "Your department has already approved this request." }, { status: 400 });
    }

    // 3. Update the existing approval record (or create one for admin if needed, though they usually act on existing ones)
    let updatedApproval;
    if (deptApproval) {
      const [result] = await db
        .update(approvals)
        .set({
          approverId: user.id,
          status,
          comments: comments || null,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvals.id, deptApproval.id))
        .returning();
      updatedApproval = result;

      // 4. Write audit log
      await db.insert(approvalAuditLogs).values({
        approvalId: deptApproval.id,
        userId: user.id,
        action: status,
        previousStatus: deptApproval.status,
        newStatus: status,
        comments: comments || null,
        metadata: {
          department: user.department,
        },
        createdAt: new Date(),
      });
    }

    // 5. Cascade Logic: Check all approvals to determine next request state
    const allApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    let newRequestStatus: string | null = null;
    let notifTitle = "";
    let notifMessage = "";

    if (status === "rejected") {
      newRequestStatus = "rejected";
      notifTitle = "Purchase Request Rejected";
      notifMessage = `"${request.title}" was rejected by ${user.username} (${user.department})${comments ? `: "${comments}"` : ""}`;
    } else if (status === "changes_requested") {
      newRequestStatus = "changes_requested";
      notifTitle = "Changes Requested on Your Purchase Request";
      notifMessage = `${user.username} (${user.department}) has requested changes on "${request.title}"${comments ? `: "${comments}"` : ""}`;
    } else if (status === "approved") {
      const pendingOrRejected = allApprovals.filter(a => a.status !== "approved");
      if (pendingOrRejected.length === 0) {
        newRequestStatus = "approved";
        notifTitle = "Purchase Request Fully Approved! 🎉";
        notifMessage = `"${request.title}" has been approved by all required departments.`;
      }
    }

    // 6. Update request status if needed
    if (newRequestStatus) {
      await db
        .update(purchaseRequests)
        .set({
          status: newRequestStatus,
          isLocked: newRequestStatus === "approved" ? true : false,
          updatedAt: new Date(),
        })
        .where(eq(purchaseRequests.id, requestId));

      // 7. Send notification to the original requester
      await notificationService.createNotification({
        userId: request.requesterId,
        title: notifTitle,
        message: notifMessage,
        type: newRequestStatus === "approved" ? "approval_complete" : newRequestStatus === "rejected" ? "rejection" : "changes_requested",
        requestId,
        priority: newRequestStatus === "rejected" ? "high" : "normal",
      });
    }

    return NextResponse.json({
      approval: updatedApproval,
      requestStatus: newRequestStatus || request.status,
      message: status === "approved" && !newRequestStatus
        ? "Approved. Waiting for remaining department sign-offs."
        : `Request has been ${status.replace("_", " ")}.`
    });
  } catch (error: any) {
    console.error("[Native API] Approvals POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
