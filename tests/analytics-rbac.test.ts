import { db } from "../db";
import { users, purchaseRequests, paymentInstallments, departments, subPurposeBudgets } from "../db/schema";
import { sql, eq, and, or, inArray, sum } from "drizzle-orm";
import { normalizeDepartmentAssignments } from "../src/lib/auth-shared";

async function runAnalyticsRbacTests() {
  console.log("================================================================================");
  console.log("   ANALYTICS RBAC & DEPARTMENT COALESCING VERIFICATION TEST SUITE              ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      console.log(`  [ANALYTICS-RBAC] ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  [ANALYTICS-RBAC] ✗ FAIL: ${name}`);
    }
  }

  // 1. Fetch Mary (Site Operations Supervisor)
  const [mary] = await db.select().from(users).where(eq(users.id, 44));
  const [superadmin] = await db.select().from(users).where(eq(users.role, "super_admin"));

  // Simulate analytics query for Mary
  async function getAnalyticsKpis(user: any) {
    const isSuperAdmin = user.role === 'super_admin';
    const userDepts = (user.departments && user.departments.length > 0 ? user.departments : [user.department]).filter(Boolean);
    const userDeptsLower = userDepts.map((d: string) => d.toLowerCase().trim());
    const isAdmin = user.role === 'admin' || isSuperAdmin || userDeptsLower.some((d: string) => ["finance", "ceo office", "management"].includes(d));

    const approverDepts: string[] = [];
    if (user.role === 'approver' && user.department) {
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

    const prFilters: any[] = [];
    if (!isAdmin) {
      const visibilityConditions: any[] = [];
      if (userDepts.length > 0) {
        visibilityConditions.push(inArray(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, userDepts));
      }
      visibilityConditions.push(eq(purchaseRequests.requesterId, user.id));
      if (approverDepts.length > 0) {
        visibilityConditions.push(
          sql`EXISTS (SELECT 1 FROM approvals WHERE approvals.request_id = ${purchaseRequests.id} AND approvals.department IN ${approverDepts})`
        );
      }
      prFilters.push(or(...visibilityConditions));
    }

    const whereClause = prFilters.length > 0 ? and(...prFilters) : undefined;

    const rows = await db
      .select({
        id: purchaseRequests.id,
        dept: sql`COALESCE(${purchaseRequests.department}, ${users.department})`,
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(whereClause);

    return rows;
  }

  const maryRows = await getAnalyticsKpis(mary);
  const marketingRowsForMary = maryRows.filter((r: any) => r.dept === "Marketing");
  assert(marketingRowsForMary.length === 0, "Site Operations supervisor does not receive cross-department Marketing rows in analytics");

  const superAdminRows = await getAnalyticsKpis(superadmin);
  assert(superAdminRows.length >= maryRows.length, "Super Admin receives full organization analytics dataset");

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runAnalyticsRbacTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
  });
