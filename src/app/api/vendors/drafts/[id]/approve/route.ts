import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendors/drafts/[id]/approve
 * Approves a submitted vendor onboarding draft, creates the active vendor record,
 * promotes documents, and performs initial compliance evaluation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) return NextResponse.json({ error: "Unauthorized to approve vendors" }, { status: 403 });

    const { id } = await params;
    const draftId = parseInt(id, 10);
    if (isNaN(draftId)) return NextResponse.json({ error: "Invalid draft ID" }, { status: 400 });

    const isForce = req.nextUrl.searchParams.get("force") === "true";
    const result = await vendorOnboardingService.approveAndPromoteDraft({
      draftId,
      userId: user.id,
      forceStaleRetry: isForce,
    });

    if (!result.success || !result.vendor) {
      return NextResponse.json(
        {
          error: (result as any).message || "An approval is already in progress for this vendor draft.",
          reason: (result as any).reason,
          isStale: (result as any).isStale,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: `Vendor "${result.vendor.companyName}" successfully approved and activated.`,
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || (error.name === "ValidationError" ? 400 : error.name === "NotFoundError" ? 404 : error.name === "ConflictError" ? 409 : 500);
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_APPROVE_ERROR:${correlationId}]`, error);
      return NextResponse.json(
        {
          error: error.message && !error.message.includes("Cannot read properties")
            ? error.message
            : `Unable to approve vendor draft. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to approve vendor" }, { status });
  }
}
