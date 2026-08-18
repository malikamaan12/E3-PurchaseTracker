import { FinancialMetricsService } from "../src/lib/services/FinancialMetricsService";
import { db } from "../db";

async function runRollingForecastTest() {
  console.log("=================================================");
  console.log("    ROLLING CASH FLOW FORECAST VERIFICATION     ");
  console.log("=================================================\n");

  let allPassed = true;

  // ─────────────────────────────────────────────────────────
  // EVALUATION AS OF 17 AUGUST 2026
  // ─────────────────────────────────────────────────────────
  console.log("--- Evaluation Date: 17 August 2026 (Historical Baseline) ---");
  const metrics17 = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-17");
  console.log(`- Upcoming 30-Day Liability:  ${metrics17.forecast30Days} QAR (Expected: 7,250 QAR)`);
  console.log(`- Overdue Unpaid Liability:   ${metrics17.overdueLiability} QAR (Expected: 2,000 QAR)`);
  console.log(`- Total Unpaid Liability:     ${metrics17.totalUnpaidLiability} QAR (Expected: 9,250 QAR)`);
  console.log(`- Disbursed / Paid Amount:    ${metrics17.disbursedAmount} QAR (Expected: 0 QAR)`);
  console.log(`- Committed / Authorized:     ${metrics17.committedAmount} QAR (Expected: 9,250 QAR)\n`);

  if (metrics17.forecast30Days === 7250) {
    console.log("✅ [PASS] 17 Aug: 30-Day upcoming forecast correctly equals 7,250 QAR (Installments 93 & 94)");
  } else {
    console.error(`❌ [FAIL] 17 Aug: Expected 30-Day forecast 7,250 QAR, got ${metrics17.forecast30Days}`);
    allPassed = false;
  }

  if (metrics17.overdueLiability === 2000) {
    console.log("✅ [PASS] 17 Aug: Overdue liability correctly equals 2,000 QAR (Installment 88)");
  } else {
    console.error(`❌ [FAIL] 17 Aug: Expected overdue 2,000 QAR, got ${metrics17.overdueLiability}`);
    allPassed = false;
  }

  if (metrics17.totalUnpaidLiability === 9250) {
    console.log("✅ [PASS] 17 Aug: Total unpaid liability equals 9,250 QAR (2,000 overdue + 7,250 upcoming)");
  } else {
    console.error(`❌ [FAIL] 17 Aug: Expected total unpaid 9,250 QAR, got ${metrics17.totalUnpaidLiability}`);
    allPassed = false;
  }

  // ─────────────────────────────────────────────────────────
  // EVALUATION AS OF 18 AUGUST 2026 (TODAY)
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Evaluation Date: 18 August 2026 (Today's Rolling Window) ---");
  const metrics18 = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-18");
  console.log(`- Upcoming 30-Day Liability:  ${metrics18.forecast30Days} QAR (Expected: 3,625 QAR)`);
  console.log(`- Overdue Unpaid Liability:   ${metrics18.overdueLiability} QAR (Expected: 5,625 QAR)`);
  console.log(`- Total Unpaid Liability:     ${metrics18.totalUnpaidLiability} QAR (Expected: 9,250 QAR)`);
  console.log(`- Disbursed / Paid Amount:    ${metrics18.disbursedAmount} QAR (Expected: 0 QAR)`);
  console.log(`- Committed / Authorized:     ${metrics18.committedAmount} QAR (Expected: 9,250 QAR)\n`);

  if (metrics18.forecast30Days === 3625) {
    console.log("✅ [PASS] 18 Aug: 30-Day upcoming forecast correctly equals 3,625 QAR (Installment 94 only)");
  } else {
    console.error(`❌ [FAIL] 18 Aug: Expected 30-Day forecast 3,625 QAR, got ${metrics18.forecast30Days}`);
    allPassed = false;
  }

  if (metrics18.overdueLiability === 5625) {
    console.log("✅ [PASS] 18 Aug: Overdue liability correctly equals 5,625 QAR (Installment 88 [2,000] + Installment 93 [3,625])");
  } else {
    console.error(`❌ [FAIL] 18 Aug: Expected overdue 5,625 QAR, got ${metrics18.overdueLiability}`);
    allPassed = false;
  }

  if (metrics18.totalUnpaidLiability === 9250) {
    console.log("✅ [PASS] 18 Aug: Total unpaid liability equals 9,250 QAR (5,625 overdue + 3,625 upcoming)");
  } else {
    console.error(`❌ [FAIL] 18 Aug: Expected total unpaid 9,250 QAR, got ${metrics18.totalUnpaidLiability}`);
    allPassed = false;
  }

  if (metrics18.disbursedAmount === 0) {
    console.log("✅ [PASS] Disbursed/Paid volume equals 0 QAR across rolling evaluation");
  } else {
    console.error(`❌ [FAIL] Expected disbursed amount 0 QAR, got ${metrics18.disbursedAmount}`);
    allPassed = false;
  }

  console.log("\n=================================================");
  if (allPassed) {
    console.log("🎉 All rolling forecast regression tests PASSED!");
    process.exit(0);
  } else {
    console.error("❌ Some rolling forecast tests FAILED.");
    process.exit(1);
  }
}

runRollingForecastTest().catch(err => {
  console.error("Fatal error during rolling forecast test:", err);
  process.exit(1);
});
