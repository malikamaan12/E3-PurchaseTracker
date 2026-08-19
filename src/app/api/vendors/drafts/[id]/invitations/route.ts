import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendors/drafts/[id]/invitations
 * Generates a replacement 24-hour invitation link and revokes all previous active links.
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
    const draftId = parseInt(id, 10);
    if (isNaN(draftId)) return NextResponse.json({ error: "Invalid draft ID" }, { status: 400 });

    const baseUrl = req.nextUrl.origin;
    const result = await vendorOnboardingService.regenerateInvitation({
      draftId,
      userId: user.id,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      message: "New 24-hour invitation link generated. All previous links invalidated.",
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_REGEN_INVITATION_ERROR:${correlationId}]`, error);
      return NextResponse.json(
        {
          error: `Unable to regenerate the vendor invitation. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to regenerate invitation" }, { status });
  }
}

/**
 * DELETE /api/vendors/drafts/[id]/invitations
 * Revokes the active invitation link for this draft.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const draftId = parseInt(id, 10);
    if (isNaN(draftId)) return NextResponse.json({ error: "Invalid draft ID" }, { status: 400 });

    await vendorOnboardingService.revokeInvitation({
      draftId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Invitation link revoked successfully.",
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_REVOKE_INVITATION_ERROR:${correlationId}]`, error);
      return NextResponse.json(
        {
          error: `Unable to revoke invitation. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to revoke invitation" }, { status });
  }
}
