import { db } from "@db";
import { 
  purchaseRequests, 
  paymentInstallments, 
  subPurposes, 
  departments, 
  users, 
  approvals,
  purposeCategories
} from "@db/schema";
import { sql, eq, and, inArray, gte, lte, isNotNull, avg, sum, count, desc } from "drizzle-orm";

/**
 * ============================================================================
 * CANONICAL FINANCIAL METRICS SERVICE
 * ============================================================================
 * 
 * Authoritative source of financial calculations across Purchases, Analytics,
 * Admin Overview, Department Analytics, and Project Management.
 * 
 * KPI DEFINITIONS:
 * ----------------------------------------------------------------------------
 * 1. Requested Amount (Draft / Pending):
 *    Value of purchase requests currently in draft, pending approval, or changes requested.
 * 
 * 2. Partially Approved Amount:
 *    Value of purchase requests that have received one or more approvals but have
 *    not completed all mandatory approval stages (status = 'partially_approved' or 'PARTIALLY_APPROVED').
 * 
 * 3. Fully Approved Amount:
 *    Value of purchase requests where all mandatory approvers have approved (status = 'approved').
 * 
 * 4. Committed / Authorized Amount:
 *    Total authorized financial liability committed to vendors.
 *    Formula: Sum of (Partially Approved + Fully Approved + Variation Pending requests).
 *    Note: A partially approved request represents an in-flight authorization and is treated
 *    as committed exposure.
 * 
 * 5. Disbursed Amount (Spent / Paid):
 *    Actual cash outflow recorded in payment installments with status = 'paid'.
 *    Must NOT be conflated with Committed/Authorized amounts when no disbursements have occurred.
 * 
 * 6. Remaining Balance:
 *    Committed Amount minus Disbursed Amount (or Budget Ceiling minus Committed Amount).
 * 
 * 7. Forecasted Liability (30-Day & 90-Day Cash Flow):
 *    Sum of pending payment installment amounts (converted to QAR equivalent)
 *    whose scheduled due date or rescheduled date falls within the next 30 or 90 days.
 * 
 * 8. Rejected / Closed Amount:
 *    Value of purchase requests terminated or closed without procurement.
 * ============================================================================
 */

export interface FinancialOverviewMetrics {
  requestedAmount: number;
  requestedCount: number;
  partiallyApprovedAmount: number;
  partiallyApprovedCount: number;
  fullyApprovedAmount: number;
  fullyApprovedCount: number;
  committedAmount: number;
  committedCount: number;
  disbursedAmount: number;
  disbursedCount: number;
  remainingCommittedBalance: number;
  rejectedAmount: number;
  rejectedCount: number;
  forecast30Days: number;
  forecast90Days: number;
  overdueLiability: number;
  totalUnpaidLiability: number;
  activeRequestsCount: number;
  activeRequestsVolume: number;
}

export class FinancialMetricsService {
  /**
   * Helper to normalize purchase request monetary value to QAR.
   * Uses baseAmountQar if present, else revisedTotalCost or totalEstimatedCost * exchangeRate.
   */
  public static getNormalizedPrCostSql() {
    return sql<number>`CASE 
      WHEN ${purchaseRequests.revisedTotalCost} IS NOT NULL 
      THEN ${purchaseRequests.revisedTotalCost} * COALESCE(${purchaseRequests.exchangeRate}, 1.0)
      ELSE COALESCE(${purchaseRequests.baseAmountQar}, COALESCE(${purchaseRequests.totalEstimatedCost}, 0) * COALESCE(${purchaseRequests.exchangeRate}, 1.0))
    END`;
  }

  /**
   * Helper to normalize payment installment amount to QAR.
   */
  public static getNormalizedInstallmentAmountSql() {
    return sql<number>`COALESCE(${paymentInstallments.calculatedAmountQar}, COALESCE(${paymentInstallments.calculatedAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0))`;
  }

  /**
   * Helper to normalize payment installment paid amount to QAR.
   */
  public static getNormalizedPaidAmountSql() {
    return sql<number>`COALESCE(${paymentInstallments.paidAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0)`;
  }

  /**
   * Format a date into YYYY-MM-DD string in Asia/Qatar timezone (UTC+3).
   */
  public static getQatarDateOnly(dateInput: Date | string | number = new Date()): string {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Qatar" });
  }

  /**
   * Add calendar days to a YYYY-MM-DD date string.
   */
  public static addCalendarDays(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day + days));
    return d.toISOString().slice(0, 10);
  }

  /**
   * Get complete financial overview metrics across all purchase requests and installments.
   */
  public static async getGlobalFinancialMetrics(filterDept?: string, asOfDateInput?: Date | string): Promise<FinancialOverviewMetrics> {
    const costSql = this.getNormalizedPrCostSql();
    const paidSql = this.getNormalizedPaidAmountSql();
    const instAmountSql = this.getNormalizedInstallmentAmountSql();

    // 1. Group purchase requests by status
    const prQuery = db
      .select({
        status: purchaseRequests.status,
        count: count(purchaseRequests.id),
        totalValue: sum(costSql)
      })
      .from(purchaseRequests)
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id));

    if (filterDept) {
      prQuery.where(eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, filterDept));
    }

    const prRows = await prQuery.groupBy(purchaseRequests.status);

    // Normalize status string to lowercase
    const byStatus = new Map<string, { count: number; totalValue: number }>();
    for (const row of prRows) {
      const s = (row.status || "").toLowerCase().trim();
      const existing = byStatus.get(s) || { count: 0, totalValue: 0 };
      byStatus.set(s, {
        count: existing.count + Number(row.count || 0),
        totalValue: existing.totalValue + Number(row.totalValue || 0)
      });
    }

    const getStat = (...statuses: string[]) => {
      let totalCount = 0;
      let totalVal = 0;
      for (const st of statuses) {
        const item = byStatus.get(st.toLowerCase());
        if (item) {
          totalCount += item.count;
          totalVal += item.totalValue;
        }
      }
      return { count: totalCount, totalValue: totalVal };
    };

    const draft = getStat('draft');
    const pending = getStat('pending', 'pending_dept_head');
    const changesRequested = getStat('changes_requested');
    const partiallyApproved = getStat('partially_approved');
    const fullyApproved = getStat('approved', 'fully_paid');
    const variationPending = getStat('variation_pending');
    const rejected = getStat('rejected', 'cancelled');

    // Requested: draft + pending + changes_requested
    const requestedAmount = draft.totalValue + pending.totalValue + changesRequested.totalValue;
    const requestedCount = draft.count + pending.count + changesRequested.count;

    // Committed / Authorized: partially_approved + approved + variation_pending
    const committedAmount = partiallyApproved.totalValue + fullyApproved.totalValue + variationPending.totalValue;
    const committedCount = partiallyApproved.count + fullyApproved.count + variationPending.count;

    // Active requests: pending + partially_approved + approved + variation_pending + changes_requested
    const activeRequestsCount = pending.count + partiallyApproved.count + fullyApproved.count + variationPending.count + changesRequested.count;
    const activeRequestsVolume = pending.totalValue + partiallyApproved.totalValue + fullyApproved.totalValue + variationPending.totalValue + changesRequested.totalValue;

    // 2. Disbursed amount from paid installments
    const paidQuery = db
      .select({
        totalPaid: sum(paidSql),
        paidCount: count(paymentInstallments.id)
      })
      .from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(
        filterDept 
          ? and(eq(paymentInstallments.status, 'paid'), eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, filterDept))
          : eq(paymentInstallments.status, 'paid')
      );

    const [paidRow] = await paidQuery;
    const disbursedAmount = Number(paidRow?.totalPaid || 0);
    const disbursedCount = Number(paidRow?.paidCount || 0);

    // 3. Forecasted liability (Deterministic date boundaries)
    const asOfStr = FinancialMetricsService.getQatarDateOnly(asOfDateInput || new Date());
    const date30Str = FinancialMetricsService.addCalendarDays(asOfStr, 30);
    const date90Str = FinancialMetricsService.addCalendarDays(asOfStr, 90);

    const effDateSql = sql`DATE(COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate}))`;
    const remainingAmountSql = sql<number>`GREATEST(COALESCE(${paymentInstallments.calculatedAmountQar}, COALESCE(${paymentInstallments.calculatedAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0)) - COALESCE(${paymentInstallments.paidAmount}, 0) * COALESCE(${paymentInstallments.exchangeRate}, 1.0), 0)`;

    const forecast30Query = db
      .select({ total: sum(remainingAmountSql) })
      .from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(
        sql`${paymentInstallments.status} NOT IN ('cancelled', 'voided', 'paid')`,
        sql`${purchaseRequests.status} IN ('partially_approved', 'approved', 'variation_pending')`,
        isNotNull(sql`COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate})`),
        sql`${effDateSql} >= ${asOfStr}::date`,
        sql`${effDateSql} <= ${date30Str}::date`,
        filterDept ? eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, filterDept) : undefined
      ));

    const forecast90Query = db
      .select({ total: sum(remainingAmountSql) })
      .from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(
        sql`${paymentInstallments.status} NOT IN ('cancelled', 'voided', 'paid')`,
        sql`${purchaseRequests.status} IN ('partially_approved', 'approved', 'variation_pending')`,
        isNotNull(sql`COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate})`),
        sql`${effDateSql} >= ${asOfStr}::date`,
        sql`${effDateSql} <= ${date90Str}::date`,
        filterDept ? eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, filterDept) : undefined
      ));

    const overdueQuery = db
      .select({ total: sum(remainingAmountSql) })
      .from(paymentInstallments)
      .innerJoin(purchaseRequests, eq(paymentInstallments.requestId, purchaseRequests.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(
        sql`${paymentInstallments.status} NOT IN ('cancelled', 'voided', 'paid')`,
        sql`${purchaseRequests.status} IN ('partially_approved', 'approved', 'variation_pending')`,
        isNotNull(sql`COALESCE(${paymentInstallments.rescheduledDate}, ${paymentInstallments.dueDate})`),
        sql`${effDateSql} < ${asOfStr}::date`,
        filterDept ? eq(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, filterDept) : undefined
      ));

    const [[row30], [row90], [rowOverdue]] = await Promise.all([forecast30Query, forecast90Query, overdueQuery]);
    const forecast30Days = Number(row30?.total || 0);
    const forecast90Days = Number(row90?.total || 0);
    const overdueLiability = Number(rowOverdue?.total || 0);
    const totalUnpaidLiability = overdueLiability + forecast30Days + Math.max(0, forecast90Days - forecast30Days);

    return {
      requestedAmount,
      requestedCount,
      partiallyApprovedAmount: partiallyApproved.totalValue,
      partiallyApprovedCount: partiallyApproved.count,
      fullyApprovedAmount: fullyApproved.totalValue,
      fullyApprovedCount: fullyApproved.count,
      committedAmount,
      committedCount,
      disbursedAmount,
      disbursedCount,
      remainingCommittedBalance: Math.max(0, committedAmount - disbursedAmount),
      rejectedAmount: rejected.totalValue,
      rejectedCount: rejected.count,
      forecast30Days,
      forecast90Days,
      overdueLiability,
      totalUnpaidLiability,
      activeRequestsCount,
      activeRequestsVolume
    };
  }

  /**
   * Format numbers to standardized QAR currency string.
   */
  public static formatCurrency(amount: number | null | undefined, currency = "QAR"): string {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0 " + currency;
    }
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
  }
}
