import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes, subPurposeBudgets, insertSubPurposeSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

/**
 * PATCH /api/admin/sub-purposes/[id]
 * Update a project/sub-purpose (status, dates, or budgets).
 * Access: Admin only.
 */
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const { id: projectId } = await params;
    const body = await req.json();

    // Destructure to extract ONLY valid database columns for the subPurposes table
    const { 
      name, 
      purposeCategoryId, 
      purposeType, 
      status, 
      totalBudget, 
      isFrozen, 
      validFrom, 
      validTo 
    } = body;

    const [existing] = await db
      .select()
      .from(subPurposes)
      .where(eq(subPurposes.id, parseInt(projectId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Sequential Update for Sub-Purpose and Budget Updates (Neon HTTP compatible)
    const [project] = await db
      .update(subPurposes)
      .set({
        name,
        purposeCategoryId,
        purposeType: purposeType || "PROJECT",
        status,
        totalBudget: totalBudget !== undefined ? Number(totalBudget) : undefined,
        isFrozen,
        validFrom: validFrom ? new Date(validFrom) : (validFrom === null ? null : undefined),
        validTo: validTo ? new Date(validTo) : (validTo === null ? null : undefined),
        updatedAt: new Date(),
      })
      .where(eq(subPurposes.id, parseInt(projectId)))
      .returning();

    // If budget splits are updated, re-sync them
    if (body.budgetSplits && Array.isArray(body.budgetSplits)) {
      // Clear existing splits and insert new ones
      await db.delete(subPurposeBudgets).where(eq(subPurposeBudgets.subPurposeId, parseInt(projectId)));
      
      const budgetInserts = body.budgetSplits.map((split: any) => ({
        subPurposeId: project.id,
        departmentId: Number(split.departmentId),
        allocatedAmount: Number(split.amount || split.allocatedAmount || 0),
      }));

      if (budgetInserts.length > 0) {
        await db.insert(subPurposeBudgets).values(budgetInserts);
      }
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purpose PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * GET /api/admin/sub-purposes/[id]
 * Get detailed project info including its budget splits.
 * Access: Admin only.
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const { id: projectId } = await params;

    const [project] = await db
      .select()
      .from(subPurposes)
      .where(eq(subPurposes.id, parseInt(projectId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const budgets = await db
      .select()
      .from(subPurposeBudgets)
      .where(eq(subPurposeBudgets.subPurposeId, project.id));

    return NextResponse.json({
      ...project,
      budgetSplits: budgets
    });
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purpose GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
