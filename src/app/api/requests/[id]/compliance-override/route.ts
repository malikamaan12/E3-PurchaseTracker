import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorComplianceOverrides, purchaseRequests, vendors } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { ComplianceOverrideService } from "@/lib/services/ComplianceOverrideService";

export const dynamic = "force-dynamic";

/**
 * GET /api/requests/[id]/compliance-override
 * Get active or recent compliance override for this PR.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: requestIdStr } = await params;
    const requestId = parseInt(requestIdStr);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const [override] = await db
      .select()
      .from(vendorComplianceOverrides)
      .where(eq(vendorComplianceOverrides.requestId, requestId))
      .orderBy(desc(vendorComplianceOverrides.createdAt))
      .limit(1);

    return NextResponse.json({ success: true, override: override || null });
  } catch (error: any) {
    console.error("[GET /api/requests/[id]/compliance-override] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch override" }, { status: 500 });
  }
}

/**
 * POST /api/requests/[id]/compliance-override
 * Request a compliance override for this PR draft.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: requestIdStr } = await params;
    const requestId = parseInt(requestIdStr);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await req.json();
    const { vendorId, justification } = body;

    if (!vendorId) {
      return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });
    }

    const override = await ComplianceOverrideService.requestOverride({
      requestId,
      vendorId: Number(vendorId),
      justification,
      requestedBy: user.id,
    });

    return NextResponse.json({
      success: true,
      override,
      message: "Compliance override request submitted for Super Admin review.",
    });
  } catch (error: any) {
    console.error("[POST /api/requests/[id]/compliance-override] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to request override" }, { status: 500 });
  }
}

/**
 * PATCH /api/requests/[id]/compliance-override
 * Review (Approve or Reject) compliance override. Super Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "super_admin") {
      return NextResponse.json({ 
        error: "Access Denied. Only Super Admin can approve or reject compliance overrides." 
      }, { status: 403 });
    }

    const { id: requestIdStr } = await params;
    const requestId = parseInt(requestIdStr);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await req.json();
    const { overrideId, action, rejectionReason } = body;

    if (!overrideId || !action || !["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid review parameters (overrideId and action required)." }, { status: 400 });
    }

    const updated = await ComplianceOverrideService.reviewOverride({
      overrideId: Number(overrideId),
      action,
      reviewerId: user.id,
      rejectionReason,
    });

    return NextResponse.json({
      success: true,
      override: updated,
      message: `Compliance override ${action} successfully.`,
    });
  } catch (error: any) {
    console.error("[PATCH /api/requests/[id]/compliance-override] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to review override" }, { status: 500 });
  }
}
