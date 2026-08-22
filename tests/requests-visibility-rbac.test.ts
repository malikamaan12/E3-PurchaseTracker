import { db } from "../db";
import { purchaseRequests, users, subPurposes, vendors, fileAttachments, paymentInstallments, approvals } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { GET } from "../src/app/api/requests/route";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../src/lib/utils/config";

async function createAuthRequest(url: string, user: { id: number; email: string; role: string; department: string }, method: string = "GET"): Promise<NextRequest> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    department: user.department,
    assignedDepartments: [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secretKey);

  const req = new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `${TOKEN_COOKIE_NAME}=${token}`,
    },
  });
  return req;
}

async function runSuite() {
  console.log("\n=================================================================");
  console.log("RUNNING SUITE: Purchase Requests Visibility & RBAC Scoping Tests");
  console.log("=================================================================");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, msg: string) {
    total++;
    if (cond) {
      console.log(`✓ [PASS] Test ${total}: ${msg}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] Test ${total}: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // Find users for testing
  const [superAdminUser] = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  const [adminUser] = await db.select().from(users).where(eq(users.username, "Ahmad Faraz")).limit(1);
  const [approverUser] = await db.select().from(users).where(eq(users.username, "Lucain")).limit(1);
  const [brandingUser] = await db.select().from(users).where(eq(users.username, "Amaan Malik")).limit(1);

  assert(Boolean(superAdminUser), "Super Admin user exists in database");

  // -------------------------------------------------------------
  // TEST 1: Super Admin sees all 14 PRs
  // -------------------------------------------------------------
  console.log("\n--- [Test 1] Super Admin All PRs Visibility ---");
  const reqAll = await createAuthRequest("http://localhost:3000/api/requests?status=all", superAdminUser);
  const resAll = await GET(reqAll);
  assert(resAll.status === 200, "Super Admin GET /api/requests?status=all returns HTTP 200");
  const dataAll = await resAll.json();
  assert(Array.isArray(dataAll), "Response is an array of PRs");
  assert(dataAll.length === 14, `Super Admin sees all 14 PRs (got ${dataAll.length})`);

  const ids = dataAll.map((r: any) => r.id).sort((a: number, b: number) => a - b);
  const expectedIds = [68, 69, 74, 75, 77, 81, 82, 83, 84, 85, 86, 87, 88, 89];
  assert(
    JSON.stringify(ids) === JSON.stringify(expectedIds),
    `All expected PR IDs are present: [${expectedIds.join(", ")}]`
  );

  // -------------------------------------------------------------
  // TEST 2: Status Filter Expansions
  // -------------------------------------------------------------
  console.log("\n--- [Test 2] Status Filter Expansions ---");
  
  // Approved status
  const reqApproved = await createAuthRequest("http://localhost:3000/api/requests?status=approved", superAdminUser);
  const resApproved = await GET(reqApproved);
  const dataApproved = await resApproved.json();
  const approvedIds = dataApproved.map((r: any) => r.id).sort((a: number, b: number) => a - b);
  assert(
    JSON.stringify(approvedIds) === JSON.stringify([68, 69, 74, 75, 77]),
    `status=approved returns exactly [68, 69, 74, 75, 77] (got [${approvedIds.join(", ")}])`
  );

  // Pending status (expands to pending + pending_dept_head)
  const reqPending = await createAuthRequest("http://localhost:3000/api/requests?status=pending", superAdminUser);
  const resPending = await GET(reqPending);
  const dataPending = await resPending.json();
  const pendingIds = dataPending.map((r: any) => r.id).sort((a: number, b: number) => a - b);
  assert(
    JSON.stringify(pendingIds) === JSON.stringify([83, 84, 85, 86, 87, 88, 89]),
    `status=pending returns all 7 pending/pending_dept_head PRs: [83, 84, 85, 86, 87, 88, 89] (got [${pendingIds.join(", ")}])`
  );

  // Rejected / Cancelled status
  const reqRejected = await createAuthRequest("http://localhost:3000/api/requests?status=rejected", superAdminUser);
  const resRejected = await GET(reqRejected);
  const dataRejected = await resRejected.json();
  const rejectedIds = dataRejected.map((r: any) => r.id).sort((a: number, b: number) => a - b);
  assert(
    JSON.stringify(rejectedIds) === JSON.stringify([81, 82]),
    `status=rejected expands to include cancelled PRs [81, 82] (got [${rejectedIds.join(", ")}])`
  );

  // -------------------------------------------------------------
  // TEST 3: Left Join Safety & Null Relation Handling
  // -------------------------------------------------------------
  console.log("\n--- [Test 3] Left Join Safety ---");
  const pr68 = dataAll.find((r: any) => r.id === 68);
  const pr69 = dataAll.find((r: any) => r.id === 69);
  const pr81 = dataAll.find((r: any) => r.id === 81);

  assert(pr68 && pr68.department === "Marketing", "PR #68 falls back to requester department 'Marketing' when pr.department is null");
  assert(pr69 && pr69.department === "Marketing", "PR #69 falls back to requester department 'Marketing' when pr.department is null");
  assert(pr81 && (!pr81.subPurpose || pr81.subPurpose.id === null), "PR #81 is safely returned even with null subPurpose");
  assert(Array.isArray(pr68.approvals) && pr68.approvals.length > 0, "PR #68 includes full approvals array JSON data");

  // -------------------------------------------------------------
  // TEST 4: Department & Role RBAC Scoping
  // -------------------------------------------------------------
  console.log("\n--- [Test 4] Department & Role RBAC Scoping ---");
  if (adminUser) {
    const reqAdmin = await createAuthRequest("http://localhost:3000/api/requests?status=all", adminUser);
    const resAdmin = await GET(reqAdmin);
    const dataAdmin = await resAdmin.json();
    assert(dataAdmin.length === 11, `Admin sees 11 non-pending_dept_head PRs across depts (got ${dataAdmin.length})`);
  }

  if (approverUser) {
    const reqAppr = await createAuthRequest("http://localhost:3000/api/requests?status=all", approverUser);
    const resAppr = await GET(reqAppr);
    const dataAppr = await resAppr.json();
    assert(dataAppr.length === 6, `Approver in Site Operations sees 6 PRs (5 in-dept + 1 cross-dept requiring approval) (got ${dataAppr.length})`);
  }

  if (brandingUser) {
    const reqUser = await createAuthRequest("http://localhost:3000/api/requests?status=all", brandingUser);
    const resUser = await GET(reqUser);
    const dataUser = await resUser.json();
    assert(dataUser.length === 1, `Standard user in Branding sees 1 owned PR #83 (got ${dataUser.length})`);
  }

  // -------------------------------------------------------------
  // TEST 5: Verified Dependencies on Approved PRs 68, 69, 74, 75, 77
  // -------------------------------------------------------------
  console.log("\n--- [Test 5] Verified Dependencies on Approved PRs ---");
  const approvedPrDetails = await db
    .select({
      id: purchaseRequests.id,
      rn: purchaseRequests.requestNumber,
      status: purchaseRequests.status,
      items: purchaseRequests.items,
      totalEstimatedCost: purchaseRequests.totalEstimatedCost,
    })
    .from(purchaseRequests)
    .where(inArray(purchaseRequests.id, [68, 69, 74, 75, 77]));

  assert(approvedPrDetails.length === 5, "All 5 approved PRs (68, 69, 74, 75, 77) exist in database");
  for (const pr of approvedPrDetails) {
    assert(pr.status === "approved", `PR #${pr.id} (${pr.rn}) status is 'approved'`);
    assert(Boolean(pr.items && pr.items.length > 0), `PR #${pr.id} has intact items array`);
    assert(typeof pr.totalEstimatedCost === "number" && pr.totalEstimatedCost > 0, `PR #${pr.id} total estimated cost is valid (${pr.totalEstimatedCost})`);
  }

  console.log("\n=================================================================");
  console.log(`ALL TESTS PASSED: ${passed}/${total} (100% PASS RATE)`);
  console.log("=================================================================\n");
}

runSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
