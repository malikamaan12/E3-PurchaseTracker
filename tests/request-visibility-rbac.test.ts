import { db } from "../db";
import { users, purchaseRequests, approvals } from "../db/schema";
import { eq, and, sql, or, inArray } from "drizzle-orm";
import { normalizeDepartmentAssignments } from "../src/lib/auth-shared";

async function runVisibilityRbacTest() {
  console.log("================================================================================");
  console.log("   PURCHASE REQUEST LISTING RBAC & CROSS-DEPARTMENT VISIBILITY TEST           ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      console.log(`  [REQ-RBAC] ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  [REQ-RBAC] ✗ FAIL: ${name}`);
    }
  }

  // Fetch Mary (Supervisor in Site Operations)
  const [mary] = await db.select().from(users).where(eq(users.id, 44));
  // Fetch Lucain (Approver in Site Operations)
  const [lucain] = await db.select().from(users).where(eq(users.id, 33));

  console.log(`  Testing with:`);
  console.log(`    - Mary: role=${mary.role}, dept=${mary.department}`);
  console.log(`    - Lucain: role=${lucain.role}, dept=${lucain.department}\n`);

  // Reusable query builder mirroring GET /api/requests
  async function getVisibleRequestsForUser(testUser: any) {
    const isSuperAdmin = testUser.role === 'super_admin';
    const isAdmin = testUser.role === 'admin' || testUser.role === 'super_admin';
    const userDepts = (testUser.departments && testUser.departments.length > 0 ? testUser.departments : [testUser.department]).filter(Boolean);

    const approverDepts: string[] = [];
    if (testUser.role === 'approver' && testUser.department) {
      approverDepts.push(testUser.department);
    }
    const normalizedAssignments = testUser.departmentAssignments || normalizeDepartmentAssignments(testUser.assignedDepartments, testUser.department);
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
        sql`(${purchaseRequests.status} != 'pending_dept_head' OR COALESCE(${purchaseRequests.department}, ${users.department}) IN ${userDepts} OR ${purchaseRequests.requesterId} = ${testUser.id})`
      );
    }

    if (!isAdmin) {
      const visibilityConditions = [
        inArray(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, userDepts),
        eq(purchaseRequests.requesterId, testUser.id)
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

  // 1. Check Mary's visible requests
  const maryRequests = await getVisibleRequestsForUser(mary);
  const maryHasCrayons = maryRequests.some(r => r.title.toLowerCase().includes("crayon"));
  const maryHasSiteOps = maryRequests.some(r => r.department === "Site Operations");

  console.log(`  Mary visible request count: ${maryRequests.length}`);
  console.log(`  Mary requests: [${maryRequests.map(r => `${r.title} (${r.department})`).join(", ")}]`);

  assert(!maryHasCrayons, "Mary (Supervisor) does NOT see Marketing's Crayons request");
  assert(maryHasSiteOps, "Mary (Supervisor) sees requests originating from Site Operations");

  // 2. Check Lucain's visible requests
  const lucainRequests = await getVisibleRequestsForUser(lucain);
  const lucainHasCrayons = lucainRequests.some(r => r.title.toLowerCase().includes("crayon"));

  console.log(`\n  Lucain visible request count: ${lucainRequests.length}`);
  console.log(`  Lucain requests: [${lucainRequests.map(r => `${r.title} (${r.department})`).join(", ")}]`);

  assert(lucainHasCrayons, "Lucain (Approver) DOES see Marketing's Crayons request because Site Operations is an approver");

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runVisibilityRbacTest().catch(e => {
  console.error(e);
  process.exit(1);
});
