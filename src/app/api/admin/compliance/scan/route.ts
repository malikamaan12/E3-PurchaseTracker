import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors } from "@db/schema";
import { complianceService } from "@/lib/services/ComplianceService";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Guard (Super Admin, Admin, Approver)
    const user = await getAuthenticatedUser(req);

    if (!user || (user.role !== "admin" && user.role !== "super_admin" && user.role !== "approver")) {
      return NextResponse.json({ error: "Unauthorized access to compliance vault" }, { status: 403 });
    }

    // 2. Fetch all active vendors
    const allVendors = await db.select({ id: vendors.id }).from(vendors);

    // 3. Trigger scan for each vendor sequentially (to avoid connection pool exhaustion)
    let updatedCount = 0;
    for (const vendor of allVendors) {
      try {
        await complianceService.scanVendorDocuments(vendor.id);
        updatedCount++;
      } catch (err) {
        console.error(`Failed to scan vendor ${vendor.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully scanned ${updatedCount} out of ${allVendors.length} vendors.`
    });

  } catch (error: any) {
    console.error("[COMPLIANCE_API] Scan Error:", error);
    return NextResponse.json({ 
      error: "Failed to run compliance scan",
      details: error.message 
    }, { status: 500 });
  }
}
