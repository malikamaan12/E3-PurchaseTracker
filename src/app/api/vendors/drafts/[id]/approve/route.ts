import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";

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

    const result = await vendorOnboardingService.approveAndPromoteDraft({
      draftId,
      userId: user.id,
    });

    return NextResponse.json({
      message: `Vendor "${result.vendor.companyName}" successfully approved and activated.`,
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || "Failed to approve vendor" }, { status });
  }
}
