import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendors/[id]/change-requests/[reqId]/review
 * Approves or rejects a staged vendor change request.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id, reqId } = await params;
    const vendorId = parseInt(id, 10);
    const requestId = parseInt(reqId, 10);

    if (isNaN(vendorId) || isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid vendor or request ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, reviewNotes } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const result = await vendorOnboardingService.reviewChangeRequest({
      requestId,
      userId: user.id,
      action,
      reviewNotes,
    });

    return NextResponse.json({
      message: `Change request successfully ${action}d.`,
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_REVIEW_CHANGE_REQ_ERROR:${correlationId}]`, error);
      return NextResponse.json(
        {
          error: `Unable to review change request. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to review change request" }, { status });
  }
}
