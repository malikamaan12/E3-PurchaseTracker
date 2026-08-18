import { FinancialMetricsService } from "../src/lib/services/FinancialMetricsService";
import { GET as adminAnalyticsGet } from "../src/app/api/admin/analytics/route";
import { GET as dashboardAnalyticsGet } from "../src/app/api/analytics/dashboard/route";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../src/lib/utils/config";
import { db } from "../db";
import { purchaseRequests, paymentInstallments, users, departments } from "../db/schema";
import { eq } from "drizzle-orm";

async function createTestToken(payload: Record<string, any>): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

async function runHotfixSuite() {
  console.log("=================================================");
  console.log("   ANALYTICS HOTFIX VERIFICATION TEST SUITE      ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extraInfo?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${extraInfo ? ` - ${extraInfo}` : ""}`);
      failed++;
    }
  }

  const adminPayload = { id: 21, email: "adil@eeeqa.com", username: "adil", role: "admin", department: "Admin" };
  const userPayload = { id: 23, email: "gd@eeeqa.com", username: "gd", role: "user", department: "Design" };

  // Test 1: Authenticated admin returns 200
  try {
    const token = await createTestToken(adminPayload);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: { cookie: `${TOKEN_COOKIE_NAME}=${token}` }
    });
    const res = await adminAnalyticsGet(req);
    assert(res.status === 200, "1. Authenticated admin request returns 200");
  } catch (err: any) {
    assert(false, "1. Authenticated admin request returns 200", err.message);
  }

  // Test 2: Unauthenticated returns 401
  try {
    const req = new NextRequest("http://localhost:3000/api/admin/analytics");
    const res = await adminAnalyticsGet(req);
    assert(res.status === 401, "2. Unauthenticated request returns 401");
  } catch (err: any) {
    assert(false, "2. Unauthenticated request returns 401", err.message);
  }

  // Test 3: Unauthorized non-admin returns 403
  try {
    const token = await createTestToken(userPayload);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: { cookie: `${TOKEN_COOKIE_NAME}=${token}` }
    });
    const res = await adminAnalyticsGet(req);
    assert(res.status === 403, "3. Unauthorized non-admin role returns 403");
  } catch (err: any) {
    assert(false, "3. Unauthorized non-admin role returns 403", err.message);
  }

  // Test 4: Response matches typed contract
  let analyticsData: any = null;
  try {
    const token = await createTestToken(adminPayload);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: { cookie: `${TOKEN_COOKIE_NAME}=${token}` }
    });
    const res = await adminAnalyticsGet(req);
    analyticsData = await res.json();

    const hasSummary = !!analyticsData.summary &&
      typeof analyticsData.summary.committedAmount === "number" &&
      typeof analyticsData.summary.disbursedAmount === "number" &&
      typeof analyticsData.summary.upcoming30DayLiability === "number" &&
      typeof analyticsData.summary.overdueUnpaidLiability === "number" &&
      typeof analyticsData.summary.totalUnpaidLiability === "number" &&
      typeof analyticsData.summary.activeRequests === "number" &&
      typeof analyticsData.summary.activeDepartments === "number";

    const hasDepartmental = Array.isArray(analyticsData.departmental) &&
      analyticsData.departmental.every((d: any) =>
        d.departmentId !== undefined &&
        typeof d.departmentName === "string" &&
        typeof d.committedAmount === "number" &&
        typeof d.disbursedAmount === "number" &&
        typeof d.requestCount === "number"
      );

    assert(hasSummary && hasDepartmental, "4. Response matches typed contract with summary and departmental fields");
  } catch (err: any) {
    assert(false, "4. Response matches typed contract", err.message);
  }

  // Test 5: All numeric fields are finite
  try {
    const s = analyticsData?.summary || {};
    const allFinite = Number.isFinite(s.committedAmount) &&
      Number.isFinite(s.disbursedAmount) &&
      Number.isFinite(s.upcoming30DayLiability) &&
      Number.isFinite(s.overdueUnpaidLiability) &&
      Number.isFinite(s.totalUnpaidLiability) &&
      Number.isFinite(s.activeRequests) &&
      Number.isFinite(s.activeDepartments);
    assert(allFinite, "5. All summary metrics are finite numbers");
  } catch (err: any) {
    assert(false, "5. All summary metrics are finite numbers", err.message);
  }

  // Test 6: Two genuine requests produce committed value QAR 9,250
  try {
    assert(analyticsData?.summary?.committedAmount === 9250, `6. Two genuine requests produce committed value QAR 9,250 (got ${analyticsData?.summary?.committedAmount})`);
  } catch (err: any) {
    assert(false, "6. Two genuine requests produce committed value QAR 9,250", err.message);
  }

  // Test 7: Paid / disbursed value is QAR 0
  try {
    assert(analyticsData?.summary?.disbursedAmount === 0, `7. Paid / disbursed value equals QAR 0 (got ${analyticsData?.summary?.disbursedAmount})`);
  } catch (err: any) {
    assert(false, "7. Paid / disbursed value is QAR 0", err.message);
  }

  // Test 8: As of 18 August 2026: upcoming = QAR 3,625, overdue = QAR 5,625, total = QAR 9,250
  try {
    const metrics18 = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-18");
    const correct18 = metrics18.committedAmount === 9250 &&
      metrics18.disbursedAmount === 0 &&
      metrics18.forecast30Days === 3625 &&
      metrics18.overdueLiability === 5625 &&
      metrics18.totalUnpaidLiability === 9250;
    assert(correct18, `8. On 18 August 2026: upcoming=3,625, overdue=5,625, total=9,250 (got upcoming=${metrics18.forecast30Days}, overdue=${metrics18.overdueLiability})`);
  } catch (err: any) {
    assert(false, "8. As of 18 August 2026 breakdown", err.message);
  }

  // Test 9: As of 17 August 2026: upcoming = QAR 7,250, overdue = QAR 2,000, total = QAR 9,250
  try {
    const metrics17 = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-17");
    const correct17 = metrics17.committedAmount === 9250 &&
      metrics17.disbursedAmount === 0 &&
      metrics17.forecast30Days === 7250 &&
      metrics17.overdueLiability === 2000 &&
      metrics17.totalUnpaidLiability === 9250;
    assert(correct17, `9. On 17 August 2026: upcoming=7,250, overdue=2,000, total=9,250 (got upcoming=${metrics17.forecast30Days}, overdue=${metrics17.overdueLiability})`);
  } catch (err: any) {
    assert(false, "9. As of 17 August 2026 breakdown", err.message);
  }

  // Test 10: Department totals reconcile with summary
  try {
    const sumDepts = (analyticsData?.departmental || []).reduce((acc: number, d: any) => acc + d.committedAmount, 0);
    assert(sumDepts === analyticsData?.summary?.committedAmount, `10. Department total (${sumDepts} QAR) reconciles with summary (${analyticsData?.summary?.committedAmount} QAR)`);
  } catch (err: any) {
    assert(false, "10. Department totals reconcile with summary", err.message);
  }

  // Test 11: Dashboard Analytics returns overview matching contract
  try {
    const token = await createTestToken(adminPayload);
    const req = new NextRequest("http://localhost:3000/api/analytics/dashboard", {
      headers: { cookie: `${TOKEN_COOKIE_NAME}=${token}` }
    });
    const res = await dashboardAnalyticsGet(req);
    assert(res.status === 200, "11a. /api/analytics/dashboard returns status 200");
    const dData = await res.json();
    assert(dData.overview?.committedAmount === 9250, `11b. /api/analytics/dashboard overview committedAmount is 9,250 QAR (got ${dData.overview?.committedAmount})`);
  } catch (err: any) {
    assert(false, "11. Dashboard Analytics endpoint", err.message);
  }

  // Test 12: Production baseline unchanged
  try {
    const [req69] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 69));
    const [req68] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 68));
    const insts = await db.select().from(paymentInstallments);
    const allPrs = await db.select().from(purchaseRequests);

    assert(allPrs.length === 2 && insts.length === 3, `12a. Production counts intact (2 PRs, 3 Installments)`);
    assert(req69?.requestNumber === "BACKTOSC-MKT-20260816-0002" && req68?.requestNumber === "URBANARE-MKT-20260812-0035", `12b. PR 68 and PR 69 request numbers unchanged`);
  } catch (err: any) {
    assert(false, "12. Production baseline unchanged", err.message);
  }

  console.log("\n=================================================");
  console.log(`  FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHotfixSuite().catch(console.error);
