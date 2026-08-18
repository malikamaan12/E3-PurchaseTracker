import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users, subPurposes, purposeCategories } from "@db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

import { FinancialMetricsService } from "@/lib/services/FinancialMetricsService";
import { paymentInstallments } from "@db/schema";

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

    const costSql = FinancialMetricsService.getNormalizedPrCostSql();
    const paidSql = FinancialMetricsService.getNormalizedPaidAmountSql();

    // 1. Departmental Committed vs Disbursed
    const deptStats = await db
      .select({
        department: users.department,
        count: sql`count(${purchaseRequests.id})`.mapWith(Number),
        committedAmount: sql`sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'VARIATION_PENDING') THEN ${costSql} ELSE 0 END)`.mapWith(Number),
        disbursedAmount: sql`COALESCE((
          SELECT sum(${paidSql})
          FROM ${paymentInstallments} pi
          INNER JOIN ${purchaseRequests} pr ON pi.request_id = pr.id
          INNER JOIN ${users} u ON pr.requester_id = u.id
          WHERE u.department = ${users.department} AND pi.status = 'paid'
        ), 0)`.mapWith(Number),
        totalCost: sql`sum(${costSql})`.mapWith(Number)
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .groupBy(users.department);

    // 2. Project Budget Utilization (All Projects)
    // Include partially_approved requests as active committed exposure
    const projectStats = await db
      .select({
        projectId: subPurposes.id,
        projectName: subPurposes.name,
        totalBudget: subPurposes.totalBudget,
        status: subPurposes.status,
        spent: sql`COALESCE(sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'paid', 'completed', 'VARIATION_PENDING') THEN ${costSql} ELSE 0 END), 0)`.mapWith(Number),
        count: sql`count(${purchaseRequests.id})`.mapWith(Number)
      })
      .from(subPurposes)
      .leftJoin(purchaseRequests, eq(subPurposes.id, purchaseRequests.subPurposeId))
      .groupBy(subPurposes.id, subPurposes.name, subPurposes.totalBudget, subPurposes.status)
      .orderBy(sql`COALESCE(sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'paid', 'completed', 'VARIATION_PENDING') THEN ${costSql} ELSE 0 END), 0) DESC`);

    // 3. Purpose Category Distribution
    const categoryStats = await db
      .select({
        categoryId: purposeCategories.id,
        categoryName: purposeCategories.name,
        spent: sql`COALESCE(sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'paid', 'completed', 'VARIATION_PENDING') THEN ${costSql} ELSE 0 END), 0)`.mapWith(Number),
        count: sql`count(${purchaseRequests.id})`.mapWith(Number)
      })
      .from(purposeCategories)
      .leftJoin(subPurposes, eq(purposeCategories.id, subPurposes.purposeCategoryId))
      .leftJoin(purchaseRequests, eq(subPurposes.id, purchaseRequests.subPurposeId))
      .groupBy(purposeCategories.id, purposeCategories.name);

    const globalMetrics = await FinancialMetricsService.getGlobalFinancialMetrics();

    return NextResponse.json({
        departmental: deptStats,
        projects: projectStats,
        categories: categoryStats,
        overview: globalMetrics,
        totalActiveProjects: projectStats.filter(p => p.status === 'active').length
    });
  } catch (error: any) {
    console.error("[Native Admin API] Admin Analytics GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
