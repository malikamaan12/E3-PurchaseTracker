import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors, auditLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { ComplianceService } from "@/lib/services/ComplianceService";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/vendors/[id]/status
 * Admin-level endpoint for updating vendor operational and compliance status.
 * Access: Admin or Super Admin or users with canManageVendors permission.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const isAuthorized = user.role === 'admin' || user.role === 'super_admin' || user.canManageVendors === true;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Access denied. Admin or Vendor Management rights required." }, { status: 403 });
    }

    const vendorId = parseInt(paramId, 10);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { status } = body;

    const validStatuses = ["active", "blocked", "frozen", "pending"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({
        message: "Invalid status value",
        errors: { status: [`Status must be one of: ${validStatuses.join(", ")}`] },
      }, { status: 400 });
    }

    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!existingVendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const [updatedVendor] = await db
      .update(vendors)
      .set({ 
        status, 
        onboardingStatus: status === "active" ? "approved" : existingVendor.onboardingStatus,
        updatedAt: new Date() 
      })
      .where(eq(vendors.id, vendorId))
      .returning();

    // Trigger compliance evaluation if approved/activated
    if (status === "active") {
      try {
        await ComplianceService.getInstance().scanVendorDocuments(vendorId);
      } catch (err) {
        console.warn(`[Admin Vendor Status] Heuristic scan warning for vendor ${vendorId}:`, err);
      }
    }

    // Record audit log
    await db.insert(auditLogs).values({
      action: "VENDOR_STATUS_UPDATED",
      resourceType: "vendor",
      resourceId: vendorId,
      userId: user.id,
      details: {
        previousStatus: existingVendor.status,
        newStatus: status,
        vendorName: existingVendor.companyName,
      },
    });

    return NextResponse.json(updatedVendor);
  } catch (error: any) {
    console.error("[Admin API] Vendor Status PATCH Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
