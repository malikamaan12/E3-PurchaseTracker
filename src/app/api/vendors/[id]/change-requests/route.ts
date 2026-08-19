import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorChangeRequests, vendors } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendors/[id]/change-requests
 * Fetches all change requests for a vendor.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const requests = await db
      .select()
      .from(vendorChangeRequests)
      .where(eq(vendorChangeRequests.vendorId, vendorId))
      .orderBy(desc(vendorChangeRequests.createdAt));

    return NextResponse.json({ success: true, changeRequests: requests });
  } catch (error: any) {
    const correlationId = crypto.randomUUID();
    console.error(`[VENDOR_CHANGE_REQUESTS_GET_ERROR:${correlationId}]`, error);
    return NextResponse.json(
      { error: `Unable to fetch change requests. Reference: ${correlationId}`, correlationId },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/[id]/change-requests
 * Generates an update invitation link for an already-approved vendor.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const baseUrl = req.nextUrl.origin;
    const result = await vendorOnboardingService.regenerateInvitation({
      vendorId,
      userId: user.id,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Vendor update invitation generated successfully.",
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_UPDATE_INVITATION_ERROR:${correlationId}]`, error);
      return NextResponse.json(
        {
          error: `Unable to create update invitation. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to generate update link" }, { status });
  }
}
