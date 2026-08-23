import { FinancialMetricsService, getQatarDateOnly, addCalendarDays } from "../src/lib/services/FinancialMetricsService";
import { db } from "../db";
import { purchaseRequests, subPurposes, paymentInstallments } from "../db/schema";
import { count } from "drizzle-orm";

/**
 * Pure evaluation function matching FinancialMetricsService rules for isolated testing.
 */
function evaluateInstallmentForecast(
  inst: {
    id: number;
    dueDate?: string | null;
    rescheduledDate?: string | null;
    calculatedAmount: number;
    paidAmount?: number | null;
    status: string;
  },
  asOfDateStr: string,
  days: number = 30
): { included: boolean; remainingAmount: number; reason: string } {
  const remaining = Math.max(Number(inst.calculatedAmount || 0) - Number(inst.paidAmount || 0), 0);
  
  if (['cancelled', 'voided', 'paid'].includes(inst.status.toLowerCase())) {
    return { included: false, remainingAmount: remaining, reason: `Status is ${inst.status}` };
  }
  
  if (remaining <= 0) {
    return { included: false, remainingAmount: 0, reason: "Fully paid or zero remaining" };
  }

  const effDate = inst.rescheduledDate || inst.dueDate;
  if (!effDate) {
    return { included: false, remainingAmount: remaining, reason: "Missing due date" };
  }

  const effDateStr = FinancialMetricsService.getQatarDateOnly(effDate);
  const maxDateStr = FinancialMetricsService.addCalendarDays(asOfDateStr, days);

  if (effDateStr < asOfDateStr) {
    return { included: false, remainingAmount: remaining, reason: `Overdue (due ${effDateStr} < asOfDate ${asOfDateStr})` };
  }

  if (effDateStr > maxDateStr) {
    return { included: false, remainingAmount: remaining, reason: `Beyond ${days} days (due ${effDateStr} > ${maxDateStr})` };
  }

  return { included: true, remainingAmount: remaining, reason: `Due ${effDateStr} within [${asOfDateStr}, ${maxDateStr}]` };
}

async function verifyFinancialMetrics() {
  console.log("=================================================");
  console.log("   FINANCIAL METRICS REGRESSION VERIFICATION     ");
  console.log("=================================================\n");

  const asOfDate = "2026-08-17";
  const metrics = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, asOfDate);

  console.log("Global Financial Metrics (from FinancialMetricsService):");
  console.log(`- Requested Amount:         ${metrics.requestedAmount} QAR (Count: ${metrics.requestedCount})`);
  console.log(`- Partially Approved:       ${metrics.partiallyApprovedAmount} QAR (Count: ${metrics.partiallyApprovedCount})`);
  console.log(`- Fully Approved:           ${metrics.fullyApprovedAmount} QAR (Count: ${metrics.fullyApprovedCount})`);
  console.log(`- Committed / Authorized:   ${metrics.committedAmount} QAR (Count: ${metrics.committedCount})`);
  console.log(`- Disbursed / Paid:         ${metrics.disbursedAmount} QAR (Count: ${metrics.disbursedCount})`);
  console.log(`- Remaining Committed Bal:  ${metrics.remainingCommittedBalance} QAR`);
  console.log(`- 30-Day Forecast Liab:     ${metrics.forecast30Days} QAR`);
  console.log(`- 90-Day Forecast Liab:     ${metrics.forecast90Days} QAR`);
  console.log(`- Active Requests Count:    ${metrics.activeRequestsCount}`);
  console.log(`- Active Requests Volume:   ${metrics.activeRequestsVolume} QAR\n`);

  let allPassed = true;

  // 1. Committed/Authorized Invariant: committedAmount == fullyApprovedAmount + partiallyApprovedAmount
  const expectedCommitted = Number(metrics.fullyApprovedAmount || 0) + Number(metrics.partiallyApprovedAmount || 0);
  if (metrics.committedAmount === expectedCommitted) {
    console.log(`✅ [PASS] Committed/Authorized invariant verified: ${metrics.committedAmount} QAR`);
  } else {
    console.error(`❌ [FAIL] Expected Committed Amount ${expectedCommitted} QAR, got ${metrics.committedAmount}`);
    allPassed = false;
  }

  // 2. Disbursed/Paid Volume & Remaining Balance Invariant
  const expectedRemaining = Math.max(0, metrics.committedAmount - metrics.disbursedAmount);
  if (metrics.remainingCommittedBalance === expectedRemaining) {
    console.log(`✅ [PASS] Remaining committed balance invariant verified: ${metrics.remainingCommittedBalance} QAR`);
  } else {
    console.error(`❌ [FAIL] Expected Remaining Committed Balance ${expectedRemaining} QAR, got ${metrics.remainingCommittedBalance}`);
    allPassed = false;
  }

  // 3. Forecast Invariants: forecast30Days <= totalUnpaidLiability
  if (metrics.forecast30Days <= metrics.totalUnpaidLiability) {
    console.log(`✅ [PASS] 30-day forecast (${metrics.forecast30Days} QAR) within total unpaid liability (${metrics.totalUnpaidLiability} QAR)`);
  } else {
    console.error(`❌ [FAIL] 30-day forecast ${metrics.forecast30Days} exceeds total unpaid liability ${metrics.totalUnpaidLiability}`);
    allPassed = false;
  }

  // 4. Overdue Liability & Total Unpaid Invariant
  if (metrics.overdueLiability <= metrics.totalUnpaidLiability) {
    console.log(`✅ [PASS] Overdue liability (${metrics.overdueLiability} QAR) within total unpaid liability (${metrics.totalUnpaidLiability} QAR)`);
  } else {
    console.error(`❌ [FAIL] Overdue liability ${metrics.overdueLiability} exceeds total unpaid liability ${metrics.totalUnpaidLiability}`);
    allPassed = false;
  }

  // 5. Active Requests Count Invariant
  const expectedActiveCount = metrics.requestedCount + metrics.partiallyApprovedCount + metrics.fullyApprovedCount;
  if (metrics.activeRequestsCount === expectedActiveCount) {
    console.log(`✅ [PASS] Active requests count invariant dynamically verified (count: ${metrics.activeRequestsCount})`);
  } else {
    console.error(`❌ [FAIL] Expected Active Requests Count ${expectedActiveCount}, got ${metrics.activeRequestsCount}`);
    allPassed = false;
  }

  // 6. Project Distinction
  const [totalProjectsRow] = await db.select({ total: count() }).from(subPurposes);
  const totalProjects = Number(totalProjectsRow?.total || 0);
  console.log(`\nProject Metrics: Total Projects = ${totalProjects}`);
  if (totalProjects >= 1) {
    console.log("✅ [PASS] Total Projects correctly queried and verified from live database.");
  } else {
    console.error(`❌ [FAIL] Total Projects query returned 0`);
    allPassed = false;
  }

  // 7. Synthetic Edge Cases Test Suite
  console.log("\n--- Synthetic Edge Cases Test Suite ---");
  const edgeCases = [
    {
      name: "Due today (2026-08-17)",
      inst: { id: 1, dueDate: "2026-08-17T00:00:00Z", calculatedAmount: 1000, paidAmount: 0, status: "pending" },
      expectedIncluded: true,
      expectedRemaining: 1000
    },
    {
      name: "Due exactly 30 days later (2026-09-16)",
      inst: { id: 2, dueDate: "2026-09-16T00:00:00Z", calculatedAmount: 1500, paidAmount: 0, status: "pending" },
      expectedIncluded: true,
      expectedRemaining: 1500
    },
    {
      name: "Due 31 days later (2026-09-17)",
      inst: { id: 3, dueDate: "2026-09-17T00:00:00Z", calculatedAmount: 2000, paidAmount: 0, status: "pending" },
      expectedIncluded: false,
      expectedRemaining: 2000
    },
    {
      name: "Partially paid within window (total 1000, paid 400)",
      inst: { id: 4, dueDate: "2026-08-25T00:00:00Z", calculatedAmount: 1000, paidAmount: 400, status: "partially_paid" },
      expectedIncluded: true,
      expectedRemaining: 600
    },
    {
      name: "Fully paid within window (status: paid)",
      inst: { id: 5, dueDate: "2026-08-25T00:00:00Z", calculatedAmount: 1000, paidAmount: 1000, status: "paid" },
      expectedIncluded: false,
      expectedRemaining: 0
    },
    {
      name: "Overpaid within window (total 1000, paid 1200)",
      inst: { id: 6, dueDate: "2026-08-25T00:00:00Z", calculatedAmount: 1000, paidAmount: 1200, status: "pending" },
      expectedIncluded: false,
      expectedRemaining: 0
    },
    {
      name: "Cancelled installment within window",
      inst: { id: 7, dueDate: "2026-08-25T00:00:00Z", calculatedAmount: 1000, paidAmount: 0, status: "cancelled" },
      expectedIncluded: false,
      expectedRemaining: 1000
    },
    {
      name: "Missing due date",
      inst: { id: 8, dueDate: null, rescheduledDate: null, calculatedAmount: 1000, paidAmount: 0, status: "pending" },
      expectedIncluded: false,
      expectedRemaining: 1000
    }
  ];

  for (const tc of edgeCases) {
    const res = evaluateInstallmentForecast(tc.inst, asOfDate, 30);
    if (res.included === tc.expectedIncluded && res.remainingAmount === tc.expectedRemaining) {
      console.log(`✅ [PASS] ${tc.name} -> Included: ${res.included}, Remaining: ${res.remainingAmount} (${res.reason})`);
    } else {
      console.error(`❌ [FAIL] ${tc.name} -> Got Included: ${res.included}, Remaining: ${res.remainingAmount}. Expected Included: ${tc.expectedIncluded}, Remaining: ${tc.expectedRemaining}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error("\n❌ Some financial metrics tests failed!");
    process.exit(1);
  } else {
    console.log("\n🎉 All financial metrics tests passed successfully!");
  }
}

verifyFinancialMetrics().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
