import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes, subPurposeBudgets, insertSubPurposeSchema } from "@db/schema";
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
      .orderBy(desc(subPurposes.createdAt));

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
    
    // Normalize body keys and handle new Phase 6 fields
    const normalizedData = {
      name: body.name,
      purposeCategoryId: body.purposeCategoryId ? Number(body.purposeCategoryId) : null,
      purposeType: body.purposeType || body.purpose_type || "PROJECT",
      status: body.status || "active",
      totalBudget: Number(body.totalBudget || 0),
      isFrozen: body.isFrozen || body.is_frozen || false,
      validFrom: (body.validFrom || body.valid_from) ? new Date(body.validFrom || body.valid_from) : null,
      validTo: (body.validTo || body.valid_to) ? new Date(body.validTo || body.valid_to) : null,
    };

    const validationResult = insertSubPurposeSchema.safeParse(normalizedData);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    const { id: _id, ...insertData } = validationResult.data as any;

    // Phase 6: Sequential Execution for Project + Budget Splits (Neon HTTP compatible)
    const [project] = await db
      .insert(subPurposes)
      .values({
        ...insertData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // If budget splits are provided, insert them
    if (body.budgetSplits && Array.isArray(body.budgetSplits)) {
      const budgetInserts = body.budgetSplits.map((split: any) => ({
        subPurposeId: project.id,
        departmentId: Number(split.departmentId),
        allocatedAmount: Number(split.amount || split.allocatedAmount || 0),
      }));

      if (budgetInserts.length > 0) {
        await db.insert(subPurposeBudgets).values(budgetInserts);
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purposes POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
