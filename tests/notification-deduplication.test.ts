import { NotificationService } from "../src/lib/services/NotificationService";

async function testNotificationDeduplication() {
  console.log("=================================================");
  console.log("   NOTIFICATION DEDUPLICATION ISOLATED TEST      ");
  console.log("=================================================\n");

  // Synthetic in-memory test batch representing multi-worker concurrent notifications
  const rawBatch = [
    // Two duplicate events for User 1, Request 69 (Back to School)
    {
      id: 101,
      userId: 1,
      requestId: 69,
      type: "approval_required",
      title: "Action Required: PR BACKTOSC-MKT-20260816-0002",
      message: "Purchase request requires your departmental approval.",
      isRead: false,
      createdAt: new Date("2026-08-16T10:00:00Z")
    },
    {
      id: 102,
      userId: 1,
      requestId: 69,
      type: "approval_required",
      title: "Action Required: PR BACKTOSC-MKT-20260816-0002",
      message: "Purchase request requires your departmental approval.",
      isRead: false,
      createdAt: new Date("2026-08-16T10:00:05Z")
    },
    // Genuinely different event within 24 hours (Request 69, different event type / stage)
    {
      id: 103,
      userId: 1,
      requestId: 69,
      type: "stage_advanced",
      title: "Stage Advanced: PR BACKTOSC-MKT-20260816-0002",
      message: "Marketing approval completed, advancing to Finance review.",
      isRead: false,
      createdAt: new Date("2026-08-16T11:30:00Z")
    },
    // Genuinely different event for Request 68 (Urban Arena)
    {
      id: 104,
      userId: 1,
      requestId: 68,
      type: "approval_required",
      title: "Action Required: PR URBANARE-MKT-20260812-0035",
      message: "Purchase request requires your departmental approval.",
      isRead: false,
      createdAt: new Date("2026-08-16T12:00:00Z")
    },
    // Different recipient (User 2) with same request
    {
      id: 105,
      userId: 2,
      requestId: 69,
      type: "approval_required",
      title: "Action Required: PR BACKTOSC-MKT-20260816-0002",
      message: "Purchase request requires your departmental approval.",
      isRead: false,
      createdAt: new Date("2026-08-16T10:00:00Z")
    }
  ];

  const deduplicated = NotificationService.deduplicateNotifications(rawBatch);

  console.log(`Original synthetic notifications: ${rawBatch.length}`);
  console.log(`Deduplicated notifications:       ${deduplicated.length}`);

  let passed = true;

  // Assertions:
  // 1. Should deduplicate id 101 and 102 into 1 item
  const user1Req69Approval = deduplicated.filter(n => n.userId === 1 && n.requestId === 69 && n.type === "approval_required");
  if (user1Req69Approval.length === 1) {
    console.log("✅ [PASS] Duplicate approval notification suppressed to 1 unique event.");
  } else {
    console.error(`❌ [FAIL] Expected 1 duplicate approval notification, got ${user1Req69Approval.length}`);
    passed = false;
  }

  // 2. Should NOT suppress genuinely different event (id 103: stage_advanced)
  const user1Req69Advanced = deduplicated.filter(n => n.userId === 1 && n.requestId === 69 && n.type === "stage_advanced");
  if (user1Req69Advanced.length === 1) {
    console.log("✅ [PASS] Genuinely different event (stage advancement) preserved.");
  } else {
    console.error("❌ [FAIL] Different event was incorrectly suppressed.");
    passed = false;
  }

  // 3. Should preserve different request (id 104: req 68)
  const user1Req68 = deduplicated.filter(n => n.userId === 1 && n.requestId === 68);
  if (user1Req68.length === 1) {
    console.log("✅ [PASS] Different purchase request event preserved.");
  } else {
    console.error("❌ [FAIL] Different request was incorrectly suppressed.");
    passed = false;
  }

  // 4. Should preserve different recipient (id 105: user 2)
  const user2Req69 = deduplicated.filter(n => n.userId === 2 && n.requestId === 69);
  if (user2Req69.length === 1) {
    console.log("✅ [PASS] Different recipient event preserved.");
  } else {
    console.error("❌ [FAIL] Different recipient was incorrectly suppressed.");
    passed = false;
  }

  // Total deduplicated count should be 4
  if (deduplicated.length === 4) {
    console.log("✅ [PASS] Deduplication identity handles: recipient, entity ID, event type, stage.");
  } else {
    console.error(`❌ [FAIL] Expected total 4 unique notifications, got ${deduplicated.length}`);
    passed = false;
  }

  if (!passed) process.exit(1);
}

testNotificationDeduplication().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
