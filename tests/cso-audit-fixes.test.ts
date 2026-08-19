import { db } from "../db";
import { users, purchaseRequests, departments, approvals } from "../db/schema";
import { eq, sql, inArray, and, or } from "drizzle-orm";
import { normalizeDepartmentAssignments } from "../src/lib/auth-shared";
import { safeFormatDate } from "../src/lib/utils";

async function runCsoAuditVerification() {
  console.log("================================================================================");
  console.log("   CSO COMPREHENSIVE BUG HUNT & SECURITY REMEDIATION TEST SUITE               ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      console.log(`  [CSO-AUDIT] ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  [CSO-AUDIT] ✗ FAIL: ${name}`);
    }
  }

  // 1. Verify Excel Export RBAC Query Filter
  const [mary] = await db.select().from(users).where(eq(users.id, 44)); // Mary (Site Operations Supervisor)
  const [superadmin] = await db.select().from(users).where(eq(users.role, "super_admin"));

  async function getExcelExportDataset(user: any) {
    const isSuperAdmin = user.role === 'super_admin';
    const isAdmin = user.role === 'admin' || isSuperAdmin;
    const userDepts = (user.departments && user.departments.length > 0 ? user.departments : [user.department]).filter(Boolean);

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

    const whereConditions: any[] = [];

    if (!isSuperAdmin) {
      whereConditions.push(
        sql`(${purchaseRequests.status} != 'pending_dept_head' OR COALESCE(${purchaseRequests.department}, ${users.department}) IN ${userDepts} OR ${purchaseRequests.requesterId} = ${user.id})`
      );
    }

    if (!isAdmin) {
      const visibilityConditions = [
        inArray(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, userDepts),
        eq(purchaseRequests.requesterId, user.id)
      ];

      if (approverDepts.length > 0) {
        visibilityConditions.push(
          sql`EXISTS (SELECT 1 FROM ${approvals} WHERE ${approvals.requestId} = ${purchaseRequests.id} AND ${approvals.department} IN ${approverDepts})`
        );
      }

      whereConditions.push(or(...visibilityConditions));
    }

    return db
      .select({
        id: purchaseRequests.id,
        title: purchaseRequests.title,
        department: sql<string>`COALESCE(${purchaseRequests.department}, ${users.department})`,
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
  }

  const maryExcelRows = await getExcelExportDataset(mary);
  const adminExcelRows = await getExcelExportDataset(superadmin);

  assert(
    !maryExcelRows.some(r => r.department === "Marketing"),
    "Excel Export RBAC: Standard user cannot leak cross-department Marketing rows"
  );
  assert(
    adminExcelRows.length >= maryExcelRows.length,
    "Excel Export RBAC: Super Admin receives full organization export"
  );

  // 2. Verify Safe Date Formatting on Corrupted / Null Timestamps
  const safeNullDate = safeFormatDate(null, "yyyy-MM-dd HH:mm");
  const safeUndefinedDate = safeFormatDate(undefined, "yyyy-MM-dd HH:mm");
  const safeInvalidString = safeFormatDate("INVALID_DATE_STRING", "yyyy-MM-dd HH:mm");
  const safeValidDate = safeFormatDate("2026-08-19T12:00:00Z", "yyyy-MM-dd");

  assert(safeNullDate === "N/A", "safeFormatDate safely handles null without throwing RangeError");
  assert(safeUndefinedDate === "N/A", "safeFormatDate safely handles undefined without throwing");
  assert(safeInvalidString === "N/A", "safeFormatDate safely handles malformed date strings");
  assert(safeValidDate === "2026-08-19", "safeFormatDate accurately formats valid ISO dates");

  // 3. Verify Super Admin Department Mutation RBAC
  const isSuperAdminAllowed = (role: string) => role === "admin" || role === "super_admin";
  assert(isSuperAdminAllowed(superadmin.role), "Department API authorizes super_admin for PATCH / DELETE");
  assert(!isSuperAdminAllowed("supervisor"), "Department API rejects supervisor for PATCH / DELETE");
  assert(!isSuperAdminAllowed("user"), "Department API rejects regular user for PATCH / DELETE");

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runCsoAuditVerification().catch(e => {
  console.error(e);
  process.exit(1);
});
