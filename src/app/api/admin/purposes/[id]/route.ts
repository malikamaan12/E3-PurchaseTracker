import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purposeCategories, insertPurposeCategorySchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

/**
 * PATCH /api/admin/purposes/[id]
 * Update a purpose category (details or status).
 * Access: Admin only.
 */
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const { id: categoryId } = await params;
    const body = await req.json();

    // Destructure to extract ONLY valid database columns for purpose_categories
    const { name, description, status } = body;

    // Partial update support
    const [existing] = await db
      .select()
      .from(purposeCategories)
      .where(eq(purposeCategories.id, parseInt(categoryId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const [updatedCategory] = await db
      .update(purposeCategories)
      .set({
        name,
        description,
        status,
        updatedAt: new Date(),
      })
      .where(eq(purposeCategories.id, parseInt(categoryId)))
      .returning();

    return NextResponse.json(updatedCategory);
  } catch (error: any) {
    console.error("[Native Admin API] Purpose Category PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
