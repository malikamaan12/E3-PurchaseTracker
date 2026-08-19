import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendors/drafts/[id]/request-changes
 * Requests corrections from the vendor and generates a fresh 24-hour invitation link.
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

    const body = await req.json().catch(() => ({}));
    const { notes } = body;

    if (!notes || notes.trim().length < 5) {
      return NextResponse.json(
        { error: "Please enter specific correction notes for the vendor." },
        { status: 400 }
      );
    }

    const baseUrl = req.nextUrl.origin;
    const result = await vendorOnboardingService.requestChanges({
      draftId,
      userId: user.id,
      notes,
      baseUrl,
    });

    return NextResponse.json({
      message: "Correction request registered. New 24-hour link created for the vendor.",
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_REQUEST_CHANGES_ERROR:${correlationId}]`, error);
      return NextResponse.json(
        {
          error: `Unable to request changes. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to request changes" }, { status });
  }
}
