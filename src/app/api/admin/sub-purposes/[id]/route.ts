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
    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
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

    // If budget splits are updated, validate uniqueness first
    let budgetInserts: Array<{ subPurposeId: number; departmentId: number; allocatedAmount: number }> = [];
    if (body.budgetSplits && Array.isArray(body.budgetSplits)) {
      const validSplits = body.budgetSplits
        .map((split: any) => ({
          subPurposeId: parseInt(projectId, 10),
          departmentId: Number(split.departmentId),
          allocatedAmount: Number(split.amount || split.allocatedAmount || 0),
        }))
        .filter((s: any) => s.departmentId > 0);

      const deptIds = validSplits.map((s: any) => s.departmentId);
      if (new Set(deptIds).size !== deptIds.length) {
        return NextResponse.json({
          message: "Duplicate department allocations are not allowed. Each department can only have one budget split per project.",
          errors: { budgetSplits: ["Duplicate department IDs detected."] }
        }, { status: 400 });
      }

      budgetInserts = validSplits;
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

    // Re-sync splits if provided
    if (body.budgetSplits && Array.isArray(body.budgetSplits)) {
      // Clear existing splits and insert new ones
      await db.delete(subPurposeBudgets).where(eq(subPurposeBudgets.subPurposeId, parseInt(projectId)));
      
      if (budgetInserts.length > 0) {
        await db.insert(subPurposeBudgets).values(budgetInserts);
      }
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purpose PATCH Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
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
    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
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

/**
 * DELETE /api/admin/sub-purposes/[id]
 * Delete a project if it has NO committed/used funds.
 * If project has used amount / purchase requests, deletion is blocked (freeze only).
 * Access: Admin only.
 */
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const { id: projectId } = await params;
    const pId = parseInt(projectId);
    if (isNaN(pId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const [project] = await db
      .select()
      .from(subPurposes)
      .where(eq(subPurposes.id, pId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if project has purchase requests or used/committed funds
    const { purchaseRequests } = await import("@db/schema");
    const { sql } = await import("drizzle-orm");
    const [reqCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.subPurposeId, pId));

    if (reqCount && Number(reqCount.count) > 0) {
      return NextResponse.json(
        { 
          error: "Project Has Used Funds", 
          message: "This project has existing purchase requests or committed funds. It can only be frozen, not deleted." 
        }, 
        { status: 400 }
      );
    }

    // Safe to delete if no used funds/requests
    await db.delete(subPurposeBudgets).where(eq(subPurposeBudgets.subPurposeId, pId));
    await db.delete(subPurposes).where(eq(subPurposes.id, pId));

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("[Native Admin API] Sub-Purpose DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

