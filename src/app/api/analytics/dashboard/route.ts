import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import {
  purchaseRequests,
  users,
  paymentInstallments,
  subPurposes,
  departments,
  purposeCategories,
  approvals,
  vendors
} from "@db/schema";
import { sql, eq, and, gte, lte, sum, count, avg, desc, inArray, isNotNull } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { FinancialMetricsService } from "@/lib/services/FinancialMetricsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/dashboard
 * Premium executive analytics engine optimized for serverless/edge environments.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "monthly"; // weekly, monthly, yearly
    const departmentId = searchParams.get("departmentId");
    const projectId = searchParams.get("projectId");
    const purposeId = searchParams.get("purposeId");
    const vendorId = searchParams.get("vendorId");
    const prStatus = searchParams.get("prStatus");

    // 1. Build Base Filters with NaN Mitigation
    const filters: any[] = [];

    const parseId = (val: string | null) => {
      if (!val) return null;
      const parsed = parseInt(val);
      return isNaN(parsed) ? null : parsed;
    };

    const pId = parseId(projectId);
    const purpId = parseId(purposeId);
    const vId = parseId(vendorId);

    if (pId) filters.push(eq(purchaseRequests.subPurposeId, pId));
    if (purpId) filters.push(eq(purchaseRequests.purposeCategoryId, purpId));
    if (vId) filters.push(eq(purchaseRequests.vendorId, vId));
    if (prStatus) filters.push(eq(purchaseRequests.status, prStatus));

    // Department filtering requires join with users or departments
    let filterDeptName: string | undefined;
    const deptId = parseId(departmentId);
    if (deptId) {
      // Find department name to match against users.department (which is text)
      const [dept] = await db.select().from(departments).where(eq(departments.id, deptId)).limit(1);
      if (dept) {
        filterDeptName = dept.name;
        filters.push(eq(users.department, dept.name));
      }
    }

    const baseWhere = filters.length > 0 ? and(...filters) : undefined;

    // ─── AGGREGATION 1: CASH FLOW PROJECTION ────────────────────────────────
    // Aggregate pending installments to forecast liquidity needs
    const cashFlow = await db.select({
      bucket: sql`DATE_TRUNC(${sql.raw(timeframe === 'weekly' ? "'week'" : "'month'")}, COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate}))`,
      amount: sql`SUM(GREATEST(COALESCE(${paymentInstallments.calculatedAmountQar}, COALESCE(${paymentInstallments.calculatedAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0)) - COALESCE(${paymentInstallments.paidAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0), 0))`,
    })
    .from(paymentInstallments)
    .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(and(
      sql`${paymentInstallments.status} NOT IN ('cancelled', 'voided', 'paid')`,
      isNotNull(sql`COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate})`),
      baseWhere
    ))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

    // ─── AGGREGATION 2: BUDGET VS SAVINGS (HISTORICAL) ────────────────────────
    const savingsAndSpend = await db.select({
      department: sql`COALESCE(${purchaseRequests.department}, ${users.department})`,
      totalPaid: sql`SUM(COALESCE(${paymentInstallments.paidAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0))`,
      totalSavings: sql`SUM(COALESCE(${paymentInstallments.savingsAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0))`,
    })
    .from(paymentInstallments)
    .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(and(
      eq(paymentInstallments.status, 'paid'),
      baseWhere
    ))
    .groupBy(sql`COALESCE(${purchaseRequests.department}, ${users.department})`);

    // ─── AGGREGATION 3: COMPLIANCE METRICS ──────────────────────────────────
    const complianceBase = await db.select({
      totalPRs: count(purchaseRequests.id),
      variedPRs: sql`SUM(CASE WHEN ${purchaseRequests.revisedTotalCost} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(purchaseRequests)
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(baseWhere);

    const onTimePayments = await db.select({
      onTime: sql`SUM(CASE WHEN ${paymentInstallments.actualPaymentDate} <= ${paymentInstallments.dueDate} THEN 1 ELSE 0 END)`,
      total: count(),
    })
    .from(paymentInstallments)
    .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(and(eq(paymentInstallments.status, 'paid'), baseWhere));

    const totalPRCount = Number(complianceBase[0]?.totalPRs || 0);
    const variedPRCount = Number(complianceBase[0]?.variedPRs || 0);
    const totalPaymentsCount = Number(onTimePayments[0]?.total || 0);
    const onTimePaymentsCount = Number(onTimePayments[0]?.onTime || 0);

    // Real vendor compliance rate across active vendor base
    const vendorComplianceStats = await db.select({
      total: count(),
      compliant: sql`SUM(CASE WHEN ${vendors.complianceStatus} = 'compliant' THEN 1 ELSE 0 END)`
    }).from(vendors).where(eq(vendors.status, 'active'));

    const totalVendors = Number(vendorComplianceStats[0]?.total || 0);
    const compliantVendors = Number(vendorComplianceStats[0]?.compliant || 0);

    // Real approval SLA fulfillment rate
    const approvalStats = await db.select({
      total: count(),
      approved: sql`SUM(CASE WHEN ${purchaseRequests.status} = 'approved' THEN 1 ELSE 0 END)`
    }).from(purchaseRequests).where(and(
      sql`${purchaseRequests.status} NOT IN ('cancelled', 'rejected')`,
      baseWhere
    ));

    const totalActivePRs = Number(approvalStats[0]?.total || 0);
    const approvedActivePRs = Number(approvalStats[0]?.approved || 0);

    const complianceScore = {
      budgetAdherence: totalPRCount > 0
        ? Math.round(((totalPRCount - variedPRCount) / totalPRCount) * 100)
        : 100,
      paymentOnTime: totalPaymentsCount > 0
        ? Math.round((onTimePaymentsCount / totalPaymentsCount) * 100)
        : 100,
      vendorComplianceRate: totalVendors > 0
        ? Math.round((compliantVendors / totalVendors) * 100)
        : 100,
      approvalFulfillment: totalActivePRs > 0
        ? Math.round((approvedActivePRs / totalActivePRs) * 100)
        : 100
    };

    // ─── AGGREGATION 4: RESOURCE UTILIZATION INDEX (RUI) ─────────────────────
    // Calculate burn rate velocity based on timeframe
    const ruiData = await db.select({
      department: sql`COALESCE(${purchaseRequests.department}, ${users.department})`,
      totalSpent: sql`SUM(COALESCE(${paymentInstallments.paidAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0))`,
    })
    .from(paymentInstallments)
    .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(and(
      eq(paymentInstallments.status, 'paid'),
      baseWhere
    ))
    .groupBy(sql`COALESCE(${purchaseRequests.department}, ${users.department})`);

    // ─── AGGREGATION 5: PROCUREMENT CYCLE TIME ───────────────────────────────
    const cycleTime = await db.select({
      avgDays: avg(sql`EXTRACT(EPOCH FROM (
        (SELECT MAX(processed_at) FROM ${approvals} WHERE request_id = ${purchaseRequests.id} AND is_mandatory = true) - ${purchaseRequests.createdAt}
      )) / 86400`)
    })
    .from(purchaseRequests)
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(and(
      eq(purchaseRequests.status, 'approved'),
      baseWhere
    ));

    // ─── AGGREGATION 6: DISTRIBUTION ────────────────────────────────────────
    const vendorDist = await db.select({
      name: sql`COALESCE(${vendors.companyName}, 'General Supplier')`,
      value: sql`SUM(COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.revisedTotalCost}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0)) * COALESCE(${purchaseRequests.exchangeRate}, 1.0)))`
    })
    .from(purchaseRequests)
    .leftJoin(vendors, eq(purchaseRequests.vendorId, vendors.id))
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(baseWhere)
    .groupBy(vendors.companyName)
    .orderBy(desc(sql`2`))
    .limit(6);

    const purposeDist = await db.select({
      name: sql`COALESCE(${purchaseRequests.purposeType}, 'General Procurement')`,
      value: sql`SUM(COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.revisedTotalCost}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0)) * COALESCE(${purchaseRequests.exchangeRate}, 1.0)))`
    })
    .from(purchaseRequests)
    .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(baseWhere)
    .groupBy(purchaseRequests.purposeType)
    .orderBy(desc(sql`2`))
    .limit(6);

    const overview = await FinancialMetricsService.getGlobalFinancialMetrics(filterDeptName);

    return NextResponse.json({
      overview,
      cashFlow: cashFlow.map(c => ({
        date: c.bucket,
        amount: Number(c.amount || 0)
      })),
      budgetVsSavings: savingsAndSpend.map(s => ({
        department: s.department,
        spent: Number(s.totalPaid || 0),
        savings: Number(s.totalSavings || 0)
      })),
      compliance: complianceScore,
      rui: ruiData.map(r => ({
        department: r.department,
        velocity: Number(r.totalSpent || 0)
      })),
      cycleTime: cycleTime[0]?.avgDays != null ? Math.round(Number(cycleTime[0].avgDays) * 10) / 10 : null,
      distribution: {
        vendor: vendorDist.map(v => ({ name: v.name, value: Number(v.value || 0) })),
        purpose: purposeDist.map(p => ({ name: p.name, value: Number(p.value || 0) })),
      }
    });

  } catch (error: any) {
    console.error("[Dashboard Analytics API] Error:", {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name
    });
    return NextResponse.json({
      error: "Aggregation Failed",
      message: error.message,
      diagnostics: {
        code: error.code,
        detail: error.detail,
        hint: error.hint
      }
    }, { status: 500 });
  }
}
