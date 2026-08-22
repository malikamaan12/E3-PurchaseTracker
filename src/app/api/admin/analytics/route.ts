import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users, subPurposes, purposeCategories, paymentInstallments } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { FinancialMetricsService } from "@/lib/services/FinancialMetricsService";

export const dynamic = 'force-dynamic';

export interface AdminAnalyticsSummary {
  committedAmount: number;
  disbursedAmount: number;
  upcoming30DayLiability: number;
  overdueUnpaidLiability: number;
  totalUnpaidLiability: number;
  activeRequests: number;
  activeDepartments: number;
}

export interface AdminAnalyticsDepartment {
  departmentId: number | string;
  departmentName: string;
  department: string;
  committedAmount: number;
  disbursedAmount: number;
  requestCount: number;
  count: number;
  totalCost: number;
}

export interface AdminAnalyticsResponse {
  summary: AdminAnalyticsSummary;
  departmental: AdminAnalyticsDepartment[];
  projects: any[];
  categories: any[];
  overview: any;
  totalActiveProjects: number;
}

/**
 * GET /api/admin/analytics
 * Fetch departmental, project, category, and executive spend analysis.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (admin.role?.toLowerCase() !== 'admin' && admin.role?.toLowerCase() !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 });
    }

    const costSql = FinancialMetricsService.getNormalizedPrCostSql();
    const paidSql = FinancialMetricsService.getNormalizedPaidAmountSql();

    // 1. Departmental Committed vs Disbursed
    const prDepts = await db
      .select({
        department: sql<string>`COALESCE(${purchaseRequests.department}, ${users.department}, 'General')`,
        count: sql`count(${purchaseRequests.id})::int`,
        committedAmount: sql`sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'pending_dept_head', 'variation_pending') THEN ${costSql} ELSE 0 END)::numeric`,
        totalCost: sql`sum(${costSql})::numeric`
      })
      .from(purchaseRequests)
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .groupBy(sql`COALESCE(${purchaseRequests.department}, ${users.department}, 'General')`);

    const paidDepts = await db
      .select({
        department: sql<string>`COALESCE(${purchaseRequests.department}, ${users.department}, 'General')`,
        disbursedAmount: sql`sum(${paidSql})::numeric`
      })
      .from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(eq(paymentInstallments.status, 'paid'))
      .groupBy(sql`COALESCE(${purchaseRequests.department}, ${users.department}, 'General')`);

    const disbursedMap = new Map<string, number>();
    for (const p of paidDepts) {
      if (p.department) disbursedMap.set(p.department, Number(p.disbursedAmount || 0));
    }

    const departmental: AdminAnalyticsDepartment[] = prDepts.map((d, idx) => ({
      departmentId: idx + 1,
      departmentName: d.department || "General",
      department: d.department || "General",
      committedAmount: Number(d.committedAmount || 0),
      disbursedAmount: disbursedMap.get(d.department) || 0,
      requestCount: Number(d.count || 0),
      count: Number(d.count || 0),
      totalCost: Number(d.totalCost || 0)
    }));

    // 2. Project Budget Utilization
    const projectStats = await db
      .select({
        projectId: subPurposes.id,
        projectName: subPurposes.name,
        totalBudget: subPurposes.totalBudget,
        status: subPurposes.status,
        spent: sql`COALESCE(sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'paid', 'completed', 'variation_pending') THEN ${costSql} ELSE 0 END), 0)::numeric`,
        count: sql`count(${purchaseRequests.id})::int`
      })
      .from(subPurposes)
      .leftJoin(purchaseRequests, eq(subPurposes.id, purchaseRequests.subPurposeId))
      .groupBy(subPurposes.id, subPurposes.name, subPurposes.totalBudget, subPurposes.status)
      .orderBy(sql`COALESCE(sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'paid', 'completed', 'variation_pending') THEN ${costSql} ELSE 0 END), 0) DESC`);

    // 3. Purpose Category Distribution
    const categoryStats = await db
      .select({
        categoryId: purposeCategories.id,
        categoryName: purposeCategories.name,
        spent: sql`COALESCE(sum(CASE WHEN ${purchaseRequests.status} IN ('approved', 'partially_approved', 'pending', 'paid', 'completed', 'variation_pending') THEN ${costSql} ELSE 0 END), 0)::numeric`,
        count: sql`count(${purchaseRequests.id})::int`
      })
      .from(purposeCategories)
      .leftJoin(subPurposes, eq(purposeCategories.id, subPurposes.purposeCategoryId))
      .leftJoin(purchaseRequests, eq(subPurposes.id, purchaseRequests.subPurposeId))
      .groupBy(purposeCategories.id, purposeCategories.name);

    // 4. Global Overview & Summary Contract
    const globalMetrics = await FinancialMetricsService.getGlobalFinancialMetrics();

    const summary: AdminAnalyticsSummary = {
      committedAmount: Number(globalMetrics.committedAmount || 0),
      disbursedAmount: Number(globalMetrics.disbursedAmount || 0),
      upcoming30DayLiability: Number(globalMetrics.forecast30Days || 0),
      overdueUnpaidLiability: Number(globalMetrics.overdueLiability || 0),
      totalUnpaidLiability: Number(globalMetrics.totalUnpaidLiability || 0),
      activeRequests: Number(globalMetrics.activeRequestsCount || 0),
      activeDepartments: departmental.length
    };

    const responsePayload: AdminAnalyticsResponse = {
      summary,
      departmental,
      projects: projectStats.map(p => ({
        ...p,
        spent: Number(p.spent || 0),
        totalBudget: Number(p.totalBudget || 0),
        count: Number(p.count || 0)
      })),
      categories: categoryStats.map(c => ({
        ...c,
        spent: Number(c.spent || 0),
        count: Number(c.count || 0)
      })),
      overview: globalMetrics,
      totalActiveProjects: projectStats.filter(p => p.status === 'active').length
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("[Native Admin API] Admin Analytics GET Error:", error);
    return NextResponse.json({ error: "Analytics service temporarily unavailable" }, { status: 500 });
  }
}
