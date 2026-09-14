import assert from "node:assert";
import { db } from "@db";
import {
  users,
  purchaseRequests,
  approvals,
  auditLogs,
  notifications,
  notificationPreferences,
  type User,
} from "@db/schema";
import { eq, and } from "drizzle-orm";
import { emailActionService } from "../src/lib/services/EmailActionService";

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING EMAIL ACTION TOKENS & 1-CLICK APPROVAL TEST SUITE");
  console.log("================================================================================");

  let testRequester: User | null = null;
  let testApprover: User | null = null;
  let testRequestId: number | null = null;
  let testApprovalId: number | null = null;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}: ${err?.message || err}`);
      throw err;
    }
  }

  try {
    const timestamp = Date.now();

    // 1. Seed test users
    const [requester] = await db
      .insert(users)
      .values({
        username: `requester_${timestamp}`,
        email: `requester_${timestamp}@eeeqa.com`,
        password: "hashed_test_password",
        contact_number: "+974 5555 0001",
        department: "Marketing",
        role: "user",
        isActive: true,
      })
      .returning();
    testRequester = requester;

    const [approver] = await db
      .insert(users)
      .values({
        username: `approver_${timestamp}`,
        email: `approver_${timestamp}@eeeqa.com`,
        password: "hashed_test_password",
        contact_number: "+974 5555 0002",
        department: "Finance",
        role: "approver",
        isActive: true,
      })
      .returning();
    testApprover = approver;

    // 2. Seed test purchase request with line items
    const testItems = [
      {
        name: "Ergonomic Office Chair",
        quantity: 5,
        estimatedCost: 850,
        description: "High-mesh executive chairs for marketing team",
      },
      {
        name: "4K Dual Monitors",
        quantity: 2,
        estimatedCost: 1400,
        description: "27-inch IPS USB-C displays",
      },
    ];

    const [request] = await db
      .insert(purchaseRequests)
      .values({
        requestNumber: `PR-TEST-${timestamp}`,
        requesterId: requester.id,
        title: "Marketing Workspace Hardware Upgrade",
        description: "Hardware refresh for Q4 creative campaigns",
        department: "Marketing",
        items: JSON.stringify(testItems) as any,
        currency: "QAR",
        totalEstimatedCost: 5 * 850 + 2 * 1400, // 7050
        status: "pending",
        paymentStructure: "POST_PROJECT",
      })
      .returning();
    testRequestId = request.id;

    // 3. Seed pending approval for approver
    const [approval] = await db
      .insert(approvals)
      .values({
        requestId: request.id,
        approverId: approver.id,
        department: "Finance",
        status: "pending",
        isMandatory: true,
      })
      .returning();
    testApprovalId = approval.id;

    // --- TEST 1: Token Generation & Verification ---
    let actionUrls: any = null;
    await test("Generates signed action URLs with tamper-proof cryptographic token", async () => {
      actionUrls = await emailActionService.generateActionUrls({
        requestId: testRequestId!,
        approverId: testApprover!.id,
        approvalId: testApprovalId!,
      });

      assert.ok(actionUrls.token, "Must return token string");
      assert.ok(actionUrls.approveUrl.includes("action=approved"), "Approve URL must contain action parameter");
      assert.ok(actionUrls.rejectUrl.includes("action=rejected"), "Reject URL must contain action parameter");
      assert.ok(actionUrls.changesUrl.includes("action=changes_requested"), "Changes URL must contain action parameter");

      const decoded = await emailActionService.verifyToken(actionUrls.token);
      assert.ok(decoded, "Token must be verifiable");
      assert.strictEqual(decoded.requestId, testRequestId);
      assert.strictEqual(decoded.approverId, testApprover!.id);
      assert.strictEqual(decoded.purpose, "email_approval_action");
    });

    // --- TEST 2: Tamper Resistance ---
    await test("Rejects tampered tokens and malformed inputs", async () => {
      const tampered = actionUrls.token.slice(0, -5) + "xyz12";
      const result = await emailActionService.verifyToken(tampered);
      assert.strictEqual(result, null, "Tampered token must fail verification");

      const invalid = await emailActionService.verifyToken("not-a-token");
      assert.strictEqual(invalid, null, "Malformed string must fail verification");
    });

    // --- TEST 3: Safe, Non-Mutating Context Lookup ---
    await test("getActionContext returns accurate details and items without side effects", async () => {
      const context = await emailActionService.getActionContext(actionUrls.token);
      assert.ok(context, "Context must be resolved");
      assert.strictEqual(context.valid, true);
      assert.strictEqual(context.requestId, testRequestId);
      assert.strictEqual(context.requestNumber, `PR-TEST-${timestamp}`);
      assert.strictEqual(context.totalEstimatedCost, 7050);
      assert.strictEqual(context.items.length, 2);
      assert.strictEqual(context.items[0].name, "Ergonomic Office Chair");
      assert.strictEqual(context.items[0].quantity, 5);
      assert.strictEqual(context.approver.username, `approver_${timestamp}`);
      assert.strictEqual(context.isAlreadyProcessed, false);

      // Verify no changes were made to approval row
      const [appRow] = await db.select().from(approvals).where(eq(approvals.id, testApprovalId!));
      assert.strictEqual(appRow.status, "pending", "Status must remain pending during GET context lookup");
    });

    // --- TEST 4: Action Execution (Approve) ---
    await test("Executes 1-click approval and updates request and approval rows", async () => {
      const execResult = await emailActionService.executeAction({
        token: actionUrls.token,
        action: "approved",
        comments: "Finance sign-off granted via email portal",
      });

      assert.strictEqual(execResult.success, true);
      assert.ok(execResult.message.includes("approved"));

      // Verify approval table
      const [updatedApp] = await db.select().from(approvals).where(eq(approvals.id, testApprovalId!));
      assert.strictEqual(updatedApp.status, "approved");
      assert.strictEqual(updatedApp.comments, "Finance sign-off granted via email portal");
      assert.ok(updatedApp.processedAt);

      // Verify request status
      const [updatedReq] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, testRequestId!));
      assert.strictEqual(updatedReq.status, "approved");

      // Verify audit log
      const [audit] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.resourceId, testRequestId!), eq(auditLogs.action, "email_approved")))
        .limit(1);
      assert.ok(audit, "Audit log entry must be recorded for email approval");
    });

    // --- TEST 5: Idempotency & Replay Prevention ---
    await test("Subsequent action on already-processed stage is safely handled", async () => {
      const replayResult = await emailActionService.executeAction({
        token: actionUrls.token,
        action: "approved",
      });

      assert.strictEqual(replayResult.success, true);
      assert.ok(replayResult.message.includes("already marked as approved"));
    });

  } finally {
    // Teardown test data
    try {
      if (testApprovalId) await db.delete(approvals).where(eq(approvals.id, testApprovalId));
      if (testRequestId) {
        await db.delete(auditLogs).where(eq(auditLogs.resourceId, testRequestId));
        await db.delete(notifications).where(eq(notifications.requestId, testRequestId));
        await db.delete(purchaseRequests).where(eq(purchaseRequests.id, testRequestId));
      }
      if (testRequester) await db.delete(users).where(eq(users.id, testRequester.id));
      if (testApprover) await db.delete(users).where(eq(users.id, testApprover.id));
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
  }

  console.log("================================================================================");
  console.log("ALL EMAIL ACTION TOKEN TESTS PASSED: 5/5 (100% PASS RATE)");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
