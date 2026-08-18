import { describe, it, expect } from "vitest";
import { FinancialMetricsService } from "../src/lib/services/FinancialMetricsService";
import { GET as adminAnalyticsGet } from "../src/app/api/admin/analytics/route";
import { GET as dashboardAnalyticsGet } from "../src/app/api/analytics/dashboard/route";
import { NextRequest } from "next/server";
import { createAuthToken } from "../src/lib/auth-server";

describe("Admin Analytics & Financial Forecast Route Contract", () => {
  const adminPayload = { id: 21, email: "adil@eeeqa.com", username: "adil", role: "admin", department: "Admin" };
  const userPayload = { id: 23, email: "gd@eeeqa.com", username: "gd", role: "user", department: "Design" };

  it("1. Authenticated admin request returns 200", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("summary");
    expect(data).toHaveProperty("departmental");
  });

  it("2. Unauthenticated request returns 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/analytics");
    const res = await adminAnalyticsGet(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("3. Unauthorized non-admin role returns 403", async () => {
    const token = createAuthToken(userPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Access denied/i);
  });

  it("4. Response strictly matches the typed contract", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    const data = await res.json();

    expect(data.summary).toBeDefined();
    expect(typeof data.summary.committedAmount).toBe("number");
    expect(typeof data.summary.disbursedAmount).toBe("number");
    expect(typeof data.summary.upcoming30DayLiability).toBe("number");
    expect(typeof data.summary.overdueUnpaidLiability).toBe("number");
    expect(typeof data.summary.totalUnpaidLiability).toBe("number");
    expect(typeof data.summary.activeRequests).toBe("number");
    expect(typeof data.summary.activeDepartments).toBe("number");

    expect(Array.isArray(data.departmental)).toBe(true);
    for (const dept of data.departmental) {
      expect(dept.departmentId).toBeDefined();
      expect(typeof dept.departmentName).toBe("string");
      expect(typeof dept.committedAmount).toBe("number");
      expect(typeof dept.disbursedAmount).toBe("number");
      expect(typeof dept.requestCount).toBe("number");
    }
  });

  it("5. All numeric fields are finite numbers", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    const data = await res.json();

    expect(Number.isFinite(data.summary.committedAmount)).toBe(true);
    expect(Number.isFinite(data.summary.disbursedAmount)).toBe(true);
    expect(Number.isFinite(data.summary.upcoming30DayLiability)).toBe(true);
    expect(Number.isFinite(data.summary.overdueUnpaidLiability)).toBe(true);
    expect(Number.isFinite(data.summary.totalUnpaidLiability)).toBe(true);
    expect(Number.isFinite(data.summary.activeRequests)).toBe(true);
    expect(Number.isFinite(data.summary.activeDepartments)).toBe(true);
  });

  it("6. Two genuine requests produce committed value QAR 9,250", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    const data = await res.json();

    expect(data.summary.committedAmount).toBe(9250);
    expect(data.summary.activeRequests).toBe(2);
  });

  it("7. Paid / disbursed value is QAR 0", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    const data = await res.json();

    expect(data.summary.disbursedAmount).toBe(0);
  });

  it("8. On 18 August 2026: upcoming = QAR 3,625, overdue = QAR 5,625, total unpaid = QAR 9,250", async () => {
    const metrics = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-18");

    expect(metrics.committedAmount).toBe(9250);
    expect(metrics.disbursedAmount).toBe(0);
    expect(metrics.forecast30Days).toBe(3625);
    expect(metrics.overdueLiability).toBe(5625);
    expect(metrics.totalUnpaidLiability).toBe(9250);
  });

  it("9. On 17 August 2026: upcoming = QAR 7,250, overdue = QAR 2,000, total unpaid = QAR 9,250", async () => {
    const metrics = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-17");

    expect(metrics.committedAmount).toBe(9250);
    expect(metrics.disbursedAmount).toBe(0);
    // On 17 Aug: Installment 93 (due 17 Aug) is today (upcoming) + Installment 94 (due 5 Sept, upcoming) = 7,250
    // Installment 88 (due 12 Aug) is overdue = 2,000
    expect(metrics.forecast30Days).toBe(7250);
    expect(metrics.overdueLiability).toBe(2000);
    expect(metrics.totalUnpaidLiability).toBe(9250);
  });

  it("10. Department totals reconcile with the summary total", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/admin/analytics", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await adminAnalyticsGet(req);
    const data = await res.json();

    const sumDeptCommitted = data.departmental.reduce((acc: number, d: any) => acc + d.committedAmount, 0);
    expect(sumDeptCommitted).toBe(data.summary.committedAmount);
  });

  it("11. Dashboard Analytics endpoint returns overview matching the contract", async () => {
    const token = createAuthToken(adminPayload as any);
    const req = new NextRequest("http://localhost:3000/api/analytics/dashboard", {
      headers: {
        cookie: `auth_token=${token}`
      }
    });

    const res = await dashboardAnalyticsGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overview).toBeDefined();
    expect(data.overview.committedAmount).toBe(9250);
    expect(data.overview.disbursedAmount).toBe(0);
  });
});
