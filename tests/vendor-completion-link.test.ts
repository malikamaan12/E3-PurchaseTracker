import { db, transactionDb } from "../db";
import { vendors, vendorOnboardingTokens, vendorPortalEvents, users } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { POST, GET } from "../src/app/api/vendors/[id]/completion-link/route";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../src/lib/utils/config";

// Helper to create authenticated NextRequest with signed JWT
async function createAuthRequest(url: string, user: { id: number; email: string; role: string; department: string }, body?: any, method: string = "POST"): Promise<NextRequest> {
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
    body: body ? JSON.stringify(body) : undefined,
  });

  return req;
}

async function runCompletionLinkSecurityTests() {
  console.log("=================================================================");
  console.log("RUNNING SUITE: Vendor Completion Link Security & Hardening Tests");
  console.log("=================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✓ [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`✗ [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // 1. Setup Test Fixtures in DB
  console.log("--- Setting up test fixtures ---");
  const [testVendor] = await db
    .insert(vendors)
    .values({
      companyName: `Test Security Vendor ${Date.now()}`,
      contactPerson: "Test Security Contact",
      contactNumber: "55001122",
      address: "West Bay, Doha",
      email: `test_sec_${Date.now()}@example.com`,
      vendorType: "company",
      engagementType: "permanent",
      complianceStatus: "unassessed",
      complianceScore: 0,
      status: "active",
      onboardingStatus: "approved",
    })
    .returning();

  const [superAdminUser] = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  const [employeeUser] = await db.select().from(users).where(eq(users.role, "supervisor")).limit(1);

  if (!superAdminUser || !employeeUser) {
    throw new Error("Required test users (super_admin, supervisor) not found in DB.");
  }

  const vendorIdStr = testVendor.id.toString();
  const context = { params: Promise.resolve({ id: vendorIdStr }) };

  try {
    // -------------------------------------------------------------
    // TEST 1: Standard Employee RBAC Restriction on Revoke (HTTP 403)
    // -------------------------------------------------------------
    console.log("\n--- [Test 1] RBAC Restriction on Revoke ---");
    const revokeReqEmployee = await createAuthRequest(
      `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
      employeeUser,
      { action: "revoke" }
    );
    const revokeResEmployee = await POST(revokeReqEmployee, context);
    const revokeJsonEmployee = await revokeResEmployee.json();

    assert(
      revokeResEmployee.status === 403 &&
      revokeJsonEmployee.success === false &&
      (revokeJsonEmployee.error?.includes("Only super administrators") || revokeJsonEmployee.message?.includes("Only super administrators")),
      "Standard employee is rejected with HTTP 403 Forbidden when attempting to revoke active links",
      `Status: ${revokeResEmployee.status}, Body: ${JSON.stringify(revokeJsonEmployee)}`
    );

    // -------------------------------------------------------------
    // TEST 2: Client Event Whitelisting (Valid vs Forged Events)
    // -------------------------------------------------------------
    console.log("\n--- [Test 2] Client Telemetry Whitelisting ---");
    // 2a. Valid client telemetry (LINK_COPIED)
    const validLogReq = await createAuthRequest(
      `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
      employeeUser,
      { action: "log_event", eventType: "LINK_COPIED" }
    );
    const validLogRes = await POST(validLogReq, context);
    const validLogJson = await validLogRes.json();

    assert(
      validLogRes.status === 200 && validLogJson.success === true && validLogJson.loggedEvent === "LINK_COPIED",
      "Client telemetry accepting whitelisted event LINK_COPIED with HTTP 200 OK",
      `Status: ${validLogRes.status}, Body: ${JSON.stringify(validLogJson)}`
    );

    // 2b. Forged server event (LINK_GENERATED) rejected with HTTP 400
    const forgedLogReq = await createAuthRequest(
      `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
      employeeUser,
      { action: "log_event", eventType: "LINK_GENERATED" }
    );
    const forgedLogRes = await POST(forgedLogReq, context);
    const forgedLogJson = await forgedLogRes.json();

    assert(
      forgedLogRes.status === 400 &&
      forgedLogJson.success === false &&
      (forgedLogJson.error?.includes("Invalid or unauthorized client event") || forgedLogJson.message?.includes("Invalid or unauthorized client event")),
      "Client telemetry rejecting forged server event LINK_GENERATED with HTTP 400 Bad Request",
      `Status: ${forgedLogRes.status}, Body: ${JSON.stringify(forgedLogJson)}`
    );

    // -------------------------------------------------------------
    // TEST 3: Concurrent Token Generation & Non-Invalidation of Existing Tokens
    // -------------------------------------------------------------
    console.log("\n--- [Test 3] Token Generation & Cap Enforcement ---");
    // Generate 5 active tokens sequentially/concurrently
    const generatedLinks: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const genReq = await createAuthRequest(
        `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
        employeeUser,
        { action: "generate" }
      );
      const genRes = await POST(genReq, context);
      const genJson = await genRes.json();
      assert(
        genRes.status === 200 && genJson.success === true && !!genJson.completionLink,
        `Token ${i}/5 generated successfully with HTTP 200 OK`,
        `Status: ${genRes.status}, Body: ${JSON.stringify(genJson)}`
      );
      generatedLinks.push(genJson.completionLink);
    }

    // Verify 5 active tokens exist in DB simultaneously without any eviction
    const dbActiveTokens = await db
      .select()
      .from(vendorOnboardingTokens)
      .where(
        and(
          eq(vendorOnboardingTokens.vendorId, testVendor.id),
          eq(vendorOnboardingTokens.status, "active"),
          gt(vendorOnboardingTokens.expiresAt, new Date())
        )
      );

    assert(
      dbActiveTokens.length === 5,
      "All 5 generated links remain concurrently active and usable without eviction",
      `Active tokens count in DB: ${dbActiveTokens.length}`
    );

    // -------------------------------------------------------------
    // TEST 4: Cap Enforcement — 6th Token Request Returns HTTP 409 Conflict
    // -------------------------------------------------------------
    console.log("\n--- [Test 4] Cap Enforcement (6th Request Returns 409) ---");
    const sixthGenReq = await createAuthRequest(
      `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
      employeeUser,
      { action: "generate" }
    );
    const sixthGenRes = await POST(sixthGenReq, context);
    const sixthGenJson = await sixthGenRes.json();

    assert(
      sixthGenRes.status === 409 &&
      sixthGenJson.success === false &&
      sixthGenJson.activeTokensCount === 5 &&
      sixthGenJson.maxAllowed === 5 &&
      (sixthGenJson.error?.includes("Active token limit reached") || sixthGenJson.message?.includes("Active token limit reached")),
      "6th token generation returns HTTP 409 Conflict when active token cap is reached",
      `Status: ${sixthGenRes.status}, Body: ${JSON.stringify(sixthGenJson)}`
    );

    // Verify existing 5 tokens are STILL active and unchanged in DB
    const dbTokensAfterSixth = await db
      .select()
      .from(vendorOnboardingTokens)
      .where(
        and(
          eq(vendorOnboardingTokens.vendorId, testVendor.id),
          eq(vendorOnboardingTokens.status, "active"),
          gt(vendorOnboardingTokens.expiresAt, new Date())
        )
      );

    assert(
      dbTokensAfterSixth.length === 5,
      "Previous 5 active tokens were preserved and NOT invalidated by the 6th failed request",
      `Active tokens count: ${dbTokensAfterSixth.length}`
    );

    // -------------------------------------------------------------
    // TEST 5: Super-Admin Authorized Revocation (HTTP 200)
    // -------------------------------------------------------------
    console.log("\n--- [Test 5] Super-Admin Authorized Revocation ---");
    const revokeReqAdmin = await createAuthRequest(
      `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
      superAdminUser,
      { action: "revoke", reason: "End of UAT testing cycle" }
    );
    const revokeResAdmin = await POST(revokeReqAdmin, context);
    const revokeJsonAdmin = await revokeResAdmin.json();

    assert(
      revokeResAdmin.status === 200 && revokeJsonAdmin.success === true,
      "Super-admin successfully revokes all active links with HTTP 200 OK",
      `Status: ${revokeResAdmin.status}, Body: ${JSON.stringify(revokeJsonAdmin)}`
    );

    // Verify all tokens are now revoked in DB
    const dbTokensAfterRevoke = await db
      .select()
      .from(vendorOnboardingTokens)
      .where(
        and(
          eq(vendorOnboardingTokens.vendorId, testVendor.id),
          eq(vendorOnboardingTokens.status, "active")
        )
      );

    assert(
      dbTokensAfterRevoke.length === 0,
      "All active tokens for vendor successfully transitioned to status 'revoked' in database",
      `Remaining active tokens: ${dbTokensAfterRevoke.length}`
    );

    // -------------------------------------------------------------
    // TEST 6: Secret Redaction & Safe Metadata Query
    // -------------------------------------------------------------
    console.log("\n--- [Test 6] Secret Redaction & GET Idempotency ---");
    const getReq = await createAuthRequest(
      `http://localhost:3000/api/vendors/${vendorIdStr}/completion-link`,
      employeeUser,
      undefined,
      "GET"
    );
    const getRes = await GET(getReq, context);
    const getJson = await getRes.json();

    assert(
      getRes.status === 200 &&
      getJson.success === true &&
      getJson.hasActiveToken === false &&
      !("tokenHash" in getJson) &&
      !("rawToken" in getJson) &&
      !("token" in getJson),
      "GET endpoint returns safe metadata without leaking tokenHash or raw secrets",
      `GET Response: ${JSON.stringify(getJson)}`
    );

    // -------------------------------------------------------------
    // TEST 7: Transaction Rollback Integrity
    // -------------------------------------------------------------
    console.log("\n--- [Test 7] Transaction Rollback Integrity ---");
    const initialEventsCount = (await db.select().from(vendorPortalEvents).where(eq(vendorPortalEvents.vendorId, testVendor.id))).length;
    const initialTokensCount = (await db.select().from(vendorOnboardingTokens).where(eq(vendorOnboardingTokens.vendorId, testVendor.id))).length;

    // Trigger an atomic transaction that aborts midway
    try {
      await transactionDb.transaction(async (tx) => {
        await tx.insert(vendorOnboardingTokens).values({
          vendorId: testVendor.id,
          scope: "onboarding",
          tokenHash: "temporary_test_rollback_hash",
          status: "active",
          expiresAt: new Date(Date.now() + 60000),
        });
        await tx.insert(vendorPortalEvents).values({
          vendorId: testVendor.id,
          eventType: "LINK_GENERATED",
          actorId: employeeUser.id,
          actorType: "user",
        });
        // Intentionally throw error to force rollback
        throw new Error("INTENTIONAL_TEST_ROLLBACK");
      });
    } catch (e: any) {
      // Expected rollback
    }

    const postRollbackEvents = (await db.select().from(vendorPortalEvents).where(eq(vendorPortalEvents.vendorId, testVendor.id))).length;
    const postRollbackTokens = (await db.select().from(vendorOnboardingTokens).where(eq(vendorOnboardingTokens.vendorId, testVendor.id))).length;

    assert(
      postRollbackEvents === initialEventsCount && postRollbackTokens === initialTokensCount,
      "Atomic transaction successfully rolls back all writes without partial state corruption",
      `Tokens before/after: ${initialTokensCount}/${postRollbackTokens}, Events before/after: ${initialEventsCount}/${postRollbackEvents}`
    );

    console.log("\n=================================================================");
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} (100% PASS RATE)`);
    console.log("=================================================================\n");

  } finally {
    // Clean up test fixtures from DB
    await db.delete(vendorPortalEvents).where(eq(vendorPortalEvents.vendorId, testVendor.id));
    await db.delete(vendorOnboardingTokens).where(eq(vendorOnboardingTokens.vendorId, testVendor.id));
    await db.delete(vendors).where(eq(vendors.id, testVendor.id));
  }
}

runCompletionLinkSecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Failed with error:", err);
    process.exit(1);
  });
