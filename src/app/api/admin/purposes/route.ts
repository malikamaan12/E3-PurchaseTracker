import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purposeCategories, insertPurposeCategorySchema } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/purposes
 * List all purpose categories for management.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const categories = await db
      .select()
      .from(purposeCategories)
      .orderBy(desc(purposeCategories.createdAt));

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error("[Native Admin API] Purpose Categories GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/purposes
 * Create a new purpose category.
 * Access: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = insertPurposeCategorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    const [newCategory] = await db
      .insert(purposeCategories)
      .values({
        ...validationResult.data,
      })
      .returning();

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    console.error("[Native Admin API] Purpose Categories POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
