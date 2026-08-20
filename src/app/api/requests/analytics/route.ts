import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { 
  purchaseRequests, 
  approvals, 
  paymentInstallments, 
  departments,
  subPurposeBudgets,
  users,
  subPurposes
} from "@db/schema";
import { sql, eq, and, or, isNotNull, gte, lte, sum, count, avg, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { FinancialMetricsService } from "@/lib/services/FinancialMetricsService";
import { normalizeDepartmentAssignments } from "@/lib/auth-shared";
import { safeFormatDate } from "@/lib/utils";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

/**
 * GET /api/requests/analytics
 * Analytics Aggregation Engine with Dynamic Filtering and Multi-Department RBAC Scoping
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Extract URL Parameters
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");
    const filterDept = searchParams.get("departmentId");

    const isSuperAdmin = user.role === 'super_admin';
    const userDepts = (user.departments && user.departments.length > 0 ? user.departments : [user.department]).filter(Boolean);
    const userDeptsLower = userDepts.map((d: string) => d.toLowerCase().trim());
    const isAdmin = user.role === 'admin' || isSuperAdmin || userDeptsLower.some((d: string) => ["finance", "ceo office", "management"].includes(d));

    // Approver department resolution
    const approverDepts: string[] = [];
    if ((user.role === 'approver' || user.isApprover) && user.department) {
      approverDepts.push(user.department);
    }
    const normalizedAssignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
    for (const assignment of normalizedAssignments) {
      if (assignment.status === 'active' && (assignment.role === 'approver' || assignment.role === 'both')) {
        if (assignment.department && !approverDepts.includes(assignment.department)) {
          approverDepts.push(assignment.department);
        }
      }
    }
    const approverDeptsLower = approverDepts.map((d: string) => d.toLowerCase().trim());

    // 2. Build Dynamic Filters
    const prFilters: any[] = [];
    if (startDate) prFilters.push(gte(purchaseRequests.createdAt, new Date(startDate)));
    if (endDate) prFilters.push(lte(purchaseRequests.createdAt, new Date(endDate)));
    if (vendorId) prFilters.push(eq(purchaseRequests.vendorId, parseInt(vendorId)));
    if (status) prFilters.push(eq(purchaseRequests.status, status));

    // RBAC: Force department and approver scoping for non-admin users
    if (!isAdmin) {
      const visibilityConditions: any[] = [];
      if (userDeptsLower.length > 0) {
        visibilityConditions.push(sql`LOWER(COALESCE(${purchaseRequests.department}, ${users.department})) = ANY(${userDeptsLower}) OR COALESCE(${purchaseRequests.department}, ${users.department}) = ANY(${userDepts})`);
      }
      visibilityConditions.push(eq(purchaseRequests.requesterId, user.id));

      if (approverDeptsLower.length > 0) {
        visibilityConditions.push(
          sql`EXISTS (SELECT 1 FROM ${approvals} WHERE ${approvals.requestId} = ${purchaseRequests.id} AND (LOWER(${approvals.department}) = ANY(${approverDeptsLower}) OR ${approvals.department} = ANY(${approverDepts})))`
        );
      }

      prFilters.push(or(...visibilityConditions));
    } else if (filterDept) {
      prFilters.push(eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, filterDept));
    }

    const whereClause = prFilters.length > 0 ? and(...prFilters) : undefined;

    // ─── 1. KPI AGGREGATION ────────────────────────────────────────────────
    const costSql = FinancialMetricsService.getNormalizedPrCostSql();
    const kpis = await db.select({
      status: purchaseRequests.status,
      count: count(),
      totalValue: sum(costSql)
    }).from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(whereClause)
      .groupBy(purchaseRequests.status);

    const paidSql = FinancialMetricsService.getNormalizedPaidAmountSql();
    const totalPaidVal = await db.select({
      total: sum(paidSql)
    }).from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(eq(paymentInstallments.status, 'paid'), whereClause));

    const overview = await FinancialMetricsService.getGlobalFinancialMetrics(
      !isAdmin ? (userDepts[0] || user.department || undefined) : (filterDept || undefined)
    );

    // ─── 2. PAYMENT COMPLIANCE (On-time vs Late) ────────────────────────
    const complianceData = await db.select({
      onTimeCount: sql`count(*) FILTER (WHERE ${paymentInstallments.actualPaymentDate} <= ${paymentInstallments.dueDate} AND ${paymentInstallments.rescheduledDate} IS NULL)`,
      lateCount: sql`count(*) FILTER (WHERE ${paymentInstallments.actualPaymentDate} > ${paymentInstallments.dueDate} OR ${paymentInstallments.rescheduledDate} IS NOT NULL)`,
    }).from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(eq(paymentInstallments.status, 'paid'), whereClause));

    // ─── 3. PROCUREMENT CYCLE TIME (Line Chart Trends) ──────────────────
    const cycleTimeTrends = await db.select({
      month: sql`DATE_TRUNC('month', ${purchaseRequests.createdAt})`,
      avgDays: avg(sql`EXTRACT(EPOCH FROM (
        (SELECT MAX(processed_at) FROM approvals WHERE request_id = ${purchaseRequests.id} AND is_mandatory = true) - ${purchaseRequests.createdAt}
      )) / 86400`)
    }).from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(eq(purchaseRequests.status, 'approved'), whereClause))
      .groupBy(sql`DATE_TRUNC('month', ${purchaseRequests.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${purchaseRequests.createdAt})`);

    // ─── 4. PROJECT SPEND (Stacked Bar) ────────────────────────────────
    const projectSpend = await db.select({
      projectName: subPurposes.name,
      totalPaid: sum(paymentInstallments.paidAmount),
      totalBudget: subPurposes.totalBudget
    }).from(subPurposes)
      .innerJoin(purchaseRequests, eq(purchaseRequests.subPurposeId, subPurposes.id))
      .innerJoin(paymentInstallments, eq(paymentInstallments.requestId, purchaseRequests.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(eq(paymentInstallments.status, 'paid'), whereClause))
      .groupBy(subPurposes.id, subPurposes.name, subPurposes.totalBudget);

    // ─── 5. CASH FLOW FORECAST (90 DAYS) ───────────────────────────────────
    const asOfStr = FinancialMetricsService.getQatarDateOnly(new Date());
    const ninetyDaysStr = FinancialMetricsService.addCalendarDays(asOfStr, 90);
    const effDateSql = sql`DATE(COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate}))`;
    const instRemainingSql = sql<number>`GREATEST(COALESCE(${paymentInstallments.calculatedAmountQar}, COALESCE(${paymentInstallments.calculatedAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0)) - COALESCE(${paymentInstallments.paidAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0), 0)`;

    const cashFlow = await db.select({
      date: sql`DATE_TRUNC('month', COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate}))`,
      total: sum(instRemainingSql)
    }).from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(
        sql`${paymentInstallments.status} NOT IN ('cancelled', 'voided', 'paid')`,
        isNotNull(sql`COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate})`),
        sql`${effDateSql} >= ${asOfStr}::date`,
        sql`${effDateSql} <= ${ninetyDaysStr}::date`,
        whereClause
      ))
      .groupBy(sql`DATE_TRUNC('month', COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate}))`)
      .orderBy(sql`DATE_TRUNC('month', COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate}))`);

    // ─── 6. APPROVAL BOTTLENECK MATRIX ──────────────────────────────────────
    const bottlenecks = await db.select({
      department: approvals.department,
      avgTurnaround: avg(sql`EXTRACT(EPOCH FROM (${approvals.processedAt} - ${approvals.createdAt})) / 3600`)
    }).from(approvals)
      .innerJoin(purchaseRequests, eq(approvals.requestId, purchaseRequests.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(
        isNotNull(approvals.processedAt), 
        eq(approvals.isMandatory, true),
        inArray(approvals.department, ['Finance', 'CEO Office', 'Management']),
        whereClause
      ))
      .groupBy(approvals.department);

    // ─── 7. BUDGET UTILIZATION (Filtered) ──────────────────────────────────
    let targetDepts = await db.select({ name: departments.name, id: departments.id }).from(departments);
    if (!isAdmin) {
      targetDepts = targetDepts.filter(d => userDepts.includes(d.name));
    } else if (filterDept) {
      targetDepts = targetDepts.filter(d => d.name === filterDept);
    }

    const budgetsWithActuals = await Promise.all(targetDepts.map(async (b) => {
      const [sumRes] = await db.select({
        allocated: sum(subPurposeBudgets.allocatedAmount),
      }).from(subPurposeBudgets).where(eq(subPurposeBudgets.departmentId, b.id));

      const [actualRes] = await db.select({
        total: sum(paymentInstallments.paidAmount)
      }).from(paymentInstallments)
        .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
        .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
        .where(and(
          eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, b.name),
          eq(paymentInstallments.status, 'paid'),
          whereClause
        ));

      return {
        name: b.name,
        allocated: Number(sumRes?.allocated || 0),
        actual: Number(actualRes?.total || 0)
      };
    }));

    const response = NextResponse.json({
      overview,
      kpis: {
        byStatus: (kpis || []).map(k => ({
          status: k.status,
          count: Number(k.count || 0),
          totalValue: Number(k.totalValue || 0)
        })),
        totalPaid: Number(totalPaidVal[0]?.total || 0)
      },
      cashFlow: (cashFlow || []).map(c => {
        let monthLabel = "N/A";
        try {
          if (c.date) {
            const parsed = new Date(c.date as string);
            if (!isNaN(parsed.getTime())) {
              monthLabel = parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }
          }
        } catch {}
        return {
          month: monthLabel,
          value: Number(c.total || 0)
        };
      }),
      bottlenecks: (bottlenecks || []).map(b => ({
        subject: b.department || "Unknown",
        A: Math.round(Number(b.avgTurnaround || 0) * 10) / 10
      })),
      compliance: [
        { name: "On-Time", value: Number(complianceData[0]?.onTimeCount || 0) },
        { name: "Late/Rescheduled", value: Number(complianceData[0]?.lateCount || 0) }
      ],
      cycleTime: (cycleTimeTrends || []).map(t => {
        let monthLabel = "N/A";
        try {
          if (t.month) {
            const parsed = new Date(t.month as string);
            if (!isNaN(parsed.getTime())) {
              monthLabel = parsed.toLocaleDateString('en-US', { month: 'short' });
            }
          }
        } catch {}
        return {
          month: monthLabel,
          days: Math.round(Number(t.avgDays || 0) * 10) / 10
        };
      }),
      projectSpend: (projectSpend || []).map(p => ({
        name: p.projectName || "Unassigned",
        spent: Number(p.totalPaid || 0),
        budget: Number(p.totalBudget || 0)
      })),
      budgets: budgetsWithActuals || []
    });

    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    return response;

  } catch (error: any) {
    const correlationId = crypto.randomUUID();
    console.error(`[Analytics API Error:${correlationId}]`, error);
    return NextResponse.json({ 
      error: "Aggregation failed", 
      message: error.message,
      correlationId
    }, { status: 500 });
  }
}

