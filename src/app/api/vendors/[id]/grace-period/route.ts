import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors, auditLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

/**
 * POST /api/vendors/[id]/grace-period
 * Extend vendor grace period. Strictly restricted to Super Admin.
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

    if (user.role !== "super_admin") {
      return NextResponse.json({ 
        error: "Access Denied. Extending compliance grace periods is strictly restricted to Super Admin." 
      }, { status: 403 });
    }

    const { id: vendorIdStr } = await params;
    const vendorId = parseInt(vendorIdStr);
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });
    }

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await req.json();
    const { days, reason } = body;

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      return NextResponse.json({ error: "Grace period extension must be between 1 and 365 days." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json({ error: "A detailed justification reason (minimum 10 characters) is required." }, { status: 400 });
    }

    const now = new Date();
    const currentDeadline = vendor.gracePeriodDeadline && new Date(vendor.gracePeriodDeadline).getTime() > now.getTime()
      ? new Date(vendor.gracePeriodDeadline)
      : now;

    const newDeadline = new Date(currentDeadline.getTime() + daysNum * 24 * 60 * 60 * 1000);

    // Update vendor grace period and status
    const [updated] = await db
      .update(vendors)
      .set({
        complianceStatus: "grace_period",
        gracePeriodDeadline: newDeadline,
        gracePeriodReason: reason.trim(),
        gracePeriodExtendedBy: user.id,
        updatedAt: now,
      })
      .where(eq(vendors.id, vendorId))
      .returning();

    // Record Immutable Audit Log
    await db.insert(auditLogs).values({
      resourceType: "vendor",
      resourceId: vendorId,
      action: "GRACE_PERIOD_EXTENDED",
      userId: user.id,
      details: {
        previousStatus: vendor.complianceStatus,
        previousDeadline: vendor.gracePeriodDeadline?.toISOString() || null,
        newDeadline: newDeadline.toISOString(),
        extensionDays: daysNum,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      vendor: updated,
      message: `Grace period extended by ${daysNum} days (Active until ${newDeadline.toLocaleDateString()}).`,
    });
  } catch (error: any) {
    console.error("[POST /api/vendors/[id]/grace-period] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to extend grace period" }, { status: 500 });
  }
}
