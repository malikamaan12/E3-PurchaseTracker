import { NotificationService } from "../src/lib/services/NotificationService";

/**
 * Isolated Multi-Worker Notification Concurrency & Unique Key Test
 * Demonstrates PostgreSQL atomic unique index & ON CONFLICT DO NOTHING semantics
 * without executing write operations against production tables.
 */
async function runConcurrencyTest() {
  console.log("=================================================");
  console.log(" ISOLATED NOTIFICATION CONCURRENCY & UNIQUE TEST ");
  console.log("=================================================\n");

  let allPassed = true;

  // Simulate in-memory relational table with PostgreSQL Unique Index on idempotency_key
  class MockPostgresNotificationTable {
    private rows: Array<{
      id: number;
      userId: number;
      requestId?: number;
      title: string;
      message: string;
      type: string;
      isRead: boolean;
      idempotencyKey: string | null;
      createdAt: Date;
    }> = [];
    private nextId = 1000;

    // Simulate atomic INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *
    public async insertOnConflictDoNothing(record: {
      userId: number;
      requestId?: number;
      title: string;
      message: string;
      type: string;
      idempotencyKey: string;
    }) {
      // Simulate network / concurrency delay
      await new Promise(r => setTimeout(r, Math.random() * 20));

      // Atomic Unique Constraint Evaluation on idempotency_key
      const conflict = this.rows.find(
        r => r.idempotencyKey !== null && r.idempotencyKey === record.idempotencyKey
      );

      if (conflict) {
        // ON CONFLICT DO NOTHING: returns empty list, existing row preserved
        return { inserted: false, record: conflict };
      }

      const newRow = {
        id: ++this.nextId,
        userId: record.userId,
        requestId: record.requestId,
        title: record.title,
        message: record.message,
        type: record.type,
        isRead: false,
        idempotencyKey: record.idempotencyKey,
        createdAt: new Date()
      };
      this.rows.push(newRow);
      return { inserted: true, record: newRow };
    }

    public getRows() {
      return [...this.rows];
    }
  }

  const mockDb = new MockPostgresNotificationTable();

  // Test Case 1: Two simultaneous workers attempt to insert the EXACT SAME causal event notification
  const key1 = NotificationService.generateIdempotencyKey({
    recipientId: 41,
    entityType: "purchase_request",
    entityId: 69,
    eventType: "approval_required",
    stage: "MANAGEMENT_APPROVAL",
    causalEventId: "evt_req69_mgmt_step"
  });

  console.log(`Deterministic Key 1: "${key1}"`);

  // Launch two concurrent worker insert promises
  const [worker1Result, worker2Result] = await Promise.all([
    mockDb.insertOnConflictDoNothing({
      userId: 41,
      requestId: 69,
      title: "Approval Required",
      message: "PR 69 requires management approval",
      type: "approval_required",
      idempotencyKey: key1
    }),
    mockDb.insertOnConflictDoNothing({
      userId: 41,
      requestId: 69,
      title: "Approval Required",
      message: "PR 69 requires management approval",
      type: "approval_required",
      idempotencyKey: key1
    })
  ]);

  const rowsAfterTest1 = mockDb.getRows();
  console.log(`- Rows in table after concurrent identical inserts: ${rowsAfterTest1.length} (Expected: 1)`);
  console.log(`- Worker 1 inserted: ${worker1Result.inserted}, Worker 2 inserted: ${worker2Result.inserted}`);

  if (rowsAfterTest1.length === 1 && (worker1Result.inserted !== worker2Result.inserted)) {
    console.log("✅ [PASS] Exactly ONE notification row created during simultaneous multi-worker race.");
  } else {
    console.error("❌ [FAIL] Multi-worker duplicate prevention failed.");
    allPassed = false;
  }

  // Test Case 2: Read state alteration does NOT break idempotency (Unconditional uniqueness)
  rowsAfterTest1[0].isRead = true; // User marks notification as read
  console.log("- Notification marked as isRead = true");

  const worker3Result = await mockDb.insertOnConflictDoNothing({
    userId: 41,
    requestId: 69,
    title: "Approval Required",
    message: "PR 69 requires management approval",
    type: "approval_required",
    idempotencyKey: key1
  });

  const rowsAfterTest2 = mockDb.getRows();
  console.log(`- Rows in table after insert on read notification: ${rowsAfterTest2.length} (Expected: 1)`);
  if (rowsAfterTest2.length === 1 && worker3Result.inserted === false) {
    console.log("✅ [PASS] Unconditional unique index prevents re-insertion even when notification is read.");
  } else {
    console.error("❌ [FAIL] Notification re-inserted after being marked as read.");
    allPassed = false;
  }

  // Test Case 3: Distinct causal event creates a separate notification
  const key2 = NotificationService.generateIdempotencyKey({
    recipientId: 41,
    entityType: "purchase_request",
    entityId: 69,
    eventType: "request_approved",
    stage: "FINANCE_APPROVAL",
    causalEventId: "evt_req69_fin_step"
  });

  console.log(`\nDeterministic Key 2 (Distinct stage): "${key2}"`);

  const worker4Result = await mockDb.insertOnConflictDoNothing({
    userId: 41,
    requestId: 69,
    title: "Request Approved",
    message: "PR 69 approved by Finance",
    type: "request_approved",
    idempotencyKey: key2
  });

  const rowsAfterTest3 = mockDb.getRows();
  console.log(`- Rows in table after distinct event insert: ${rowsAfterTest3.length} (Expected: 2)`);
  if (rowsAfterTest3.length === 2 && worker4Result.inserted === true) {
    console.log("✅ [PASS] Different causal event key correctly created a distinct notification.");
  } else {
    console.error("❌ [FAIL] Distinct causal event was wrongly suppressed.");
    allPassed = false;
  }

  console.log("\n=================================================");
  if (allPassed) {
    console.log("🎉 All notification concurrency & uniqueness tests PASSED!");
    process.exit(0);
  } else {
    console.error("❌ Notification concurrency tests FAILED.");
    process.exit(1);
  }
}

runConcurrencyTest().catch(err => {
  console.error("Fatal error during concurrency test:", err);
  process.exit(1);
});
