import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors, insertVendorSchema } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendors
 * Fetch all vendors, ordered by creation date.
 * Access: Authenticated users.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const allVendors = await db
      .select()
      .from(vendors)
      .orderBy(desc(vendors.createdAt));

    return NextResponse.json(allVendors);
  } catch (error: any) {
    console.error("[Native API] Vendors GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/vendors
 * Create a new vendor.
 * Access: Admin or users with canManageVendors permission.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const isAuthorized = user.role === 'admin' || user.canManageVendors === true;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Access denied. Admin or Vendor Management rights required." }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = insertVendorSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    // Check for duplicate name
    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.companyName, validationResult.data.companyName))
      .limit(1);

    if (existingVendor) {
      return NextResponse.json({
        message: "Vendor with this company name already exists",
      }, { status: 400 });
    }

    // Create new vendor
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...vendorData } = validationResult.data as any;

    const [newVendor] = await db
      .insert(vendors)
      .values({
        ...vendorData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newVendor, { status: 201 });
  } catch (error: any) {
    console.error("[Native API] Vendors POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
