import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes, purchaseRequests, insertSubPurposeSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/sub-purposes/[id]
 * Update an existing sub-purpose.
 * Access: Admin only.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const subPurposeId = parseInt(paramId);
    if (isNaN(subPurposeId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    
    // Normalize body keys
    const normalizedData = {
      name: body.name,
      purpose_type: body.purposeType || body.purpose_type,
      is_frozen: body.isFrozen || body.is_frozen,
      valid_from: body.valid_from ? new Date(body.valid_from) : undefined,
      valid_to: body.valid_to ? new Date(body.valid_to) : undefined,
    };

    const validationResult = insertSubPurposeSchema.partial().safeParse(normalizedData);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    const { id: _id, updated_at: _ua, created_at: _ca, ...updateData } = validationResult.data as any;

    const [updated] = await db
      .update(subPurposes)
      .set({
        ...updateData,
        updated_at: new Date(),
      })
      .where(eq(subPurposes.id, subPurposeId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Sub-purpose not found" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purpose PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/sub-purposes/[id]
 * Delete a sub-purpose (with reference checks).
 * Access: Admin only.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const subPurposeId = parseInt(paramId);
    if (isNaN(subPurposeId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    // 1. Check for references in Purchase Requests
    const [pr] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.subPurposeId, subPurposeId))
      .limit(1);

    if (pr) {
      return NextResponse.json({ 
        error: "Cannot delete sub-purpose", 
        message: "This sub-purpose is currently referenced by active purchase requests. Use 'is_frozen' to disable it instead." 
      }, { status: 400 });
    }

    // 2. Perform deletion
    const [deleted] = await db
      .delete(subPurposes)
      .where(eq(subPurposes.id, subPurposeId))
      .returning();

    if (!deleted) return NextResponse.json({ error: "Sub-purpose not found" }, { status: 404 });

    return NextResponse.json({ message: "Sub-purpose deleted successfully" });
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purpose DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
