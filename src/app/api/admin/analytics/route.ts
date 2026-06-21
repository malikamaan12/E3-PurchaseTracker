import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users, subPurposes, purposeCategories } from "@db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics
 * Fetch departmental, project, and category spend analysis.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    // 1. Departmental Spend
    const deptStats = await db
      .select({
        department: users.department,
        count: sql`count(${purchaseRequests.id})`.mapWith(Number),
        totalCost: sql`sum(COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.revisedTotalCost}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0)) * COALESCE(${purchaseRequests.exchangeRate}, 1.0)))`.mapWith(Number)
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .groupBy(users.department);

    // 2. Project Budget Utilization (Top 10)
    // We only count requests that are approved or pending (not draft/rejected) for spend
    const projectStats = await db
      .select({
        projectId: subPurposes.id,
        projectName: subPurposes.name,
        totalBudget: subPurposes.totalBudget,
        spent: sql`COALESCE(sum(COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.revisedTotalCost}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0)) * COALESCE(${purchaseRequests.exchangeRate}, 1.0))), 0)`.mapWith(Number),
        count: sql`count(${purchaseRequests.id})`.mapWith(Number)
      })
      .from(subPurposes)
      .leftJoin(purchaseRequests, and(
        eq(subPurposes.id, purchaseRequests.subPurposeId),
        inArray(purchaseRequests.status, ['approved', 'pending', 'paid', 'completed'])
      ))
      .groupBy(subPurposes.id, subPurposes.name, subPurposes.totalBudget)
      .orderBy(sql`COALESCE(sum(COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.revisedTotalCost}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0)) * COALESCE(${purchaseRequests.exchangeRate}, 1.0))), 0) DESC`)
      .limit(10);

    // 3. Purpose Category Distribution
    const categoryStats = await db
      .select({
        categoryId: purposeCategories.id,
        categoryName: purposeCategories.name,
        spent: sql`COALESCE(sum(COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.revisedTotalCost}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0)) * COALESCE(${purchaseRequests.exchangeRate}, 1.0))), 0)`.mapWith(Number),
        count: sql`count(${purchaseRequests.id})`.mapWith(Number)
      })
      .from(purposeCategories)
      .leftJoin(subPurposes, eq(purposeCategories.id, subPurposes.purposeCategoryId))
      .leftJoin(purchaseRequests, and(
        eq(subPurposes.id, purchaseRequests.subPurposeId),
        inArray(purchaseRequests.status, ['approved', 'pending', 'paid', 'completed'])
      ))
      .groupBy(purposeCategories.id, purposeCategories.name);

    return NextResponse.json({
        departmental: deptStats,
        projects: projectStats,
        categories: categoryStats
    });
  } catch (error: any) {
    console.error("[Native Admin API] Admin Analytics GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
