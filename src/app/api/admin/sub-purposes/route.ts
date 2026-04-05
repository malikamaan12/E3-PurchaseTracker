import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes, insertSubPurposeSchema } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sub-purposes
 * List all sub-purposes for management.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const allSubPurposes = await db
      .select()
      .from(subPurposes)
      .orderBy(desc(subPurposes.created_at));

    return NextResponse.json(allSubPurposes);
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purposes GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/sub-purposes
 * Create a new sub-purpose.
 * Access: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const body = await req.json();
    
    // Normalize body keys for Drizzle schema
    const normalizedData = {
      name: body.name,
      purpose_type: body.purposeType || body.purpose_type,
      is_frozen: body.isFrozen || body.is_frozen || false,
      valid_from: body.valid_from ? new Date(body.valid_from) : null,
      valid_to: body.valid_to ? new Date(body.valid_to) : null,
    };

    const validationResult = insertSubPurposeSchema.safeParse(normalizedData);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    const { id: _id, created_at: _ca, updated_at: _ua, ...insertData } = validationResult.data as any;

    const [newSubPurpose] = await db
      .insert(subPurposes)
      .values({
        ...insertData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    return NextResponse.json(newSubPurpose, { status: 201 });
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purposes POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
