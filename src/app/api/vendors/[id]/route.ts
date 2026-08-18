import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors, insertVendorSchema } from "@db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { maskVendorBanking } from "@/lib/utils/masking";

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendors/[id]
 * Fetch specific vendor details by ID.
 * Access: Authenticated users.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const vendorId = parseInt(paramId);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    return NextResponse.json(maskVendorBanking(vendor));
  } catch (error: any) {
    console.error("[Native API] Vendor GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/vendors/[id]
 * Update vendor details.
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

    const body = await req.json();
    const validationResult = insertVendorSchema.partial().safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    // Check if vendor exists
    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!existingVendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Check for name conflict
    if (validationResult.data.companyName && validationResult.data.companyName !== existingVendor.companyName) {
      const [nameConflict] = await db
        .select()
        .from(vendors)
        .where(and(
          eq(vendors.companyName, validationResult.data.companyName), 
          ne(vendors.id, vendorId)
        ))
        .limit(1);

      if (nameConflict) {
        return NextResponse.json({
          message: "A vendor with this company name already exists",
        }, { status: 400 });
      }
    }

    const updateFields: any = { ...validationResult.data };
    delete updateFields.id;
    updateFields.updatedAt = new Date();

    const [updatedVendor] = await db
      .update(vendors)
      .set(updateFields)
      .where(eq(vendors.id, vendorId))
      .returning();

    return NextResponse.json(updatedVendor);
  } catch (error: any) {
    console.error("[Native API] Vendor PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/vendors/[id]
 * Delete a vendor (with Deletion Shield).
 * Access: Admin only (for extra safety on deletion).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json({ error: "Strictly Admin only deletion permitted." }, { status: 403 });
    }

    const vendorId = parseInt(paramId);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    // DELETION SHIELD check
    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!existingVendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    // Check for historical dependencies using concurrent queries for speed
    const [requestCount, paymentCount, performanceCount] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) AS count FROM purchase_requests WHERE vendor_id = ${vendorId}`),
      db.execute(sql`SELECT COUNT(*) AS count FROM vendor_payments WHERE vendor_id = ${vendorId}`),
      db.execute(sql`SELECT COUNT(*) AS count FROM vendor_performance WHERE vendor_id = ${vendorId}`)
    ]);

    const reqCount = parseInt((requestCount.rows[0] as any).count);
    const payCount = parseInt((paymentCount.rows[0] as any).count);
    const perfCount = parseInt((performanceCount.rows[0] as any).count);

    if (reqCount > 0 || payCount > 0 || perfCount > 0) {
      const dependencies = [];
      if (reqCount > 0) dependencies.push(`${reqCount} Purchase Requests`);
      if (payCount > 0) dependencies.push(`${payCount} Payments`);
      if (perfCount > 0) dependencies.push(`${perfCount} Performance Reviews`);

      return NextResponse.json({
        error: "Deletion Restricted",
        message: `This vendor cannot be deleted as it is linked to historical data: ${dependencies.join(', ')}. To preserve the audit timeline, please update the vendor status to "Blocked" or "Frozen" instead.`,
      }, { status: 400 });
    }

    await db.delete(vendors).where(eq(vendors.id, vendorId));

    return NextResponse.json({ success: true, message: "Vendor deleted successfully" });
  } catch (error: any) {
    console.error("[Native API] Vendor DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
