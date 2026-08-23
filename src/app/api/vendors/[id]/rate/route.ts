import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/vendors/[id]/rate
 * Submit a rating for a specific vendor.
 * Access: All authenticated users.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const vendorId = parseInt(paramId);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const { rating } = await req.json();
    
    // Validate rating (1-5)
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be a number between 1 and 5" }, { status: 400 });
    }

    // Update vendor rating (for now, simply overwritten by the latest rater)
    // Future expansion: Average rating calculation from a 'ratings' audit table.
    const [updatedVendor] = await db
      .update(vendors)
      .set({ 
        rating,
        updatedAt: new Date()
      })
      .where(eq(vendors.id, vendorId))
      .returning();

    if (!updatedVendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    return NextResponse.json({
      success: true,
      message: "Rating submitted successfully",
      vendor: updatedVendor
    });

  } catch (error: any) {
    console.error("[Vendor Rating API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/vendors/[id]/rate
 * Alias for PATCH to support clients invoking via POST.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH(req, ctx);
}
