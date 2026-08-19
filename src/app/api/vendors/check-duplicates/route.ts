import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized to manage vendors" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { companyName, email, contactNumber, taxNumber, registrationNumber, excludeDraftId, excludeVendorId } = body;

    if (!companyName && !email && !contactNumber) {
      return NextResponse.json({ hasDuplicate: false, matches: [] });
    }

    const result = await vendorOnboardingService.checkDuplicates({
      companyName: companyName || "",
      email: email || "",
      contactNumber: contactNumber || "",
      taxNumber: taxNumber || null,
      registrationNumber: registrationNumber || null,
      excludeDraftId: excludeDraftId ? Number(excludeDraftId) : null,
      excludeVendorId: excludeVendorId ? Number(excludeVendorId) : null,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to check duplicates" }, { status: 500 });
  }
}
