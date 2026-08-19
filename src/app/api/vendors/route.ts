import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors, insertVendorSchema } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { maskVendorList } from "@/lib/utils/masking";

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

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const selectable = searchParams.get("selectable") === "true";

    let query = db.select().from(vendors);

    if (selectable) {
      query = query.where(eq(vendors.status, "active")) as any;
    } else if (statusParam && statusParam !== "all") {
      query = query.where(eq(vendors.status, statusParam as any)) as any;
    }

    const allVendors = await query.orderBy(desc(vendors.createdAt));

    // Fetch documents
    const { vendorDocuments } = await import("@db/schema");
    const { inArray } = await import("drizzle-orm");
    
    let allDocs: any[] = [];
    if (allVendors.length > 0) {
      allDocs = await db
        .select()
        .from(vendorDocuments)
        .where(inArray(vendorDocuments.vendorId, allVendors.map(v => v.id)));
    }

    const vendorsWithDocs = allVendors.map(v => ({
      ...v,
      documents: allDocs.filter(d => d.vendorId === v.id)
    }));

    return NextResponse.json(maskVendorList(vendorsWithDocs));
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

    const isAuthorized = user.role === 'admin' || user.role === 'super_admin' || user.canManageVendors === true;
    // Allow any authenticated user to create a vendor.
    // We will set status based on authorization later.

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

    const vendorStatus = isAuthorized ? (vendorData.status || "active") : "pending";

    const [newVendor] = await db
      .insert(vendors)
      .values({
        ...vendorData,
        status: vendorStatus,
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
