import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/vendors/[id]/status
 * Update vendor status (active, blocked, frozen).
 * Access: Admin or users with canManageVendors permission.
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

    const vendorId = parseInt(paramId);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const { status } = await req.json();

    if (!status || !["active", "blocked", "frozen"].includes(status)) {
      return NextResponse.json({
        message: "Invalid status value",
        errors: { status: ["Status must be one of: active, blocked, frozen"] },
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
      .set({ status, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();

    return NextResponse.json(updatedVendor);
  } catch (error: any) {
    console.error("[Native API] Vendor Status PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
