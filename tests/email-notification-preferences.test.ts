import assert from "node:assert";
import { notificationService, GLOBAL_EMAIL_PREFERENCE_TYPE, DEFAULT_NOTIFICATION_TYPES, NotificationService } from "../src/lib/services/NotificationService";
import { emailService } from "../src/lib/services/EmailService";
import { db } from "../db/index";
import { users, notificationPreferences } from "../db/schema";
import { eq, and } from "drizzle-orm";

console.log("================================================================================");
console.log("STARTING RESEND EMAIL NOTIFICATIONS & USER PREFERENCES TEST SUITE");
console.log("================================================================================");

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runTests() {
  // Setup a dedicated mock user for deterministic testing
  const testUsername = `email_test_user_${Date.now()}`;
  const testEmail = `${testUsername}@example.com`;

  const [testUser] = await db
    .insert(users)
    .values({
      username: testUsername,
      email: testEmail,
      password: "hashed_password_123",
      contact_number: "+97412345678",
      department: "Procurement",
      role: "user",
      isActive: true
    })
    .returning();

  const userId = testUser.id;

  try {
    // 1. Requirement: By default, email notifications must be completely OFF
    await test("Default preferences have masterEmailEnabled = false and all types emailEnabled = false", async () => {
      const result = await notificationService.getUserNotificationPreferences(userId);

      assert.strictEqual(result.masterEmailEnabled, false, "Master email switch must be false by default");
      assert.strictEqual(result.userEmail, testEmail, "User email must match user record");
      assert.ok(Array.isArray(result.preferences), "Preferences must be an array");
      assert.ok(result.preferences.length >= 7, "Must contain all standard notification categories");

      // Verify every event has emailEnabled = false by default
      for (const pref of result.preferences) {
        assert.strictEqual(
          pref.emailEnabled,
          false,
          `Event preference '${pref.type}' must have emailEnabled: false by default`
        );
        assert.strictEqual(
          pref.inAppEnabled,
          true,
          `Event preference '${pref.type}' must keep inAppEnabled: true`
        );
      }
    });

    // 2. Requirement: Event type mapping is comprehensive and accurate
    await test("Event to preference mapping accurately normalizes workflow event types", () => {
      assert.strictEqual(NotificationService.mapEventToPreferenceType("approval_required"), "pending_approval");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("pending_approval"), "pending_approval");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("purchase_request_submitted"), "new_request");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("new_request"), "new_request");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("purchase_request_approved"), "approval_granted");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("purchase_request_rejected"), "approval_rejected");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("purchase_request_changes_requested"), "changes_requested");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("vendor_status_change"), "vendor_status_change");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("vendor_created"), "vendor_status_change");
      assert.strictEqual(NotificationService.mapEventToPreferenceType("system_maintenance"), "system_update");
    });

    // 3. Requirement: User can toggle master switch ON and selectively enable specific notifications
    await test("User can update master toggle and granular preferences", async () => {
      const updated = await notificationService.updateAllPreferences(userId, {
        masterEmailEnabled: true,
        preferences: [
          { type: "pending_approval", emailEnabled: true },
          { type: "approval_granted", emailEnabled: true },
          { type: "new_request", emailEnabled: false },
        ]
      });

      assert.strictEqual(updated.masterEmailEnabled, true, "Master switch should now be true");

      const pendingPref = updated.preferences.find(p => p.type === "pending_approval");
      assert.ok(pendingPref, "pending_approval preference must exist");
      assert.strictEqual(pendingPref.emailEnabled, true, "pending_approval must have emailEnabled = true");

      const approvedPref = updated.preferences.find(p => p.type === "approval_granted");
      assert.ok(approvedPref, "approval_granted preference must exist");
      assert.strictEqual(approvedPref.emailEnabled, true, "approval_granted must have emailEnabled = true");

      const newReqPref = updated.preferences.find(p => p.type === "new_request");
      assert.ok(newReqPref, "new_request preference must exist");
      assert.strictEqual(newReqPref.emailEnabled, false, "new_request must remain emailEnabled = false");
    });

    // 4. Requirement: Email dispatch eligibility respects master switch and granular toggles
    await test("Email dispatch skips delivery when master switch is off", async () => {
      // Temporarily turn master switch off
      await notificationService.updateAllPreferences(userId, {
        masterEmailEnabled: false,
        preferences: [{ type: "pending_approval", emailEnabled: true }]
      });

      let emailSent = false;
      const originalSend = emailService.sendNotificationEmail.bind(emailService);
      emailService.sendNotificationEmail = async (params) => {
        emailSent = true;
        return { success: true, id: "mock_test_1" };
      };

      try {
        await notificationService.dispatchEmailNotificationIfEligible({
          userId,
          title: "Pending Approval Test",
          message: "A request needs review",
          type: "approval_required"
        });

        assert.strictEqual(emailSent, false, "Email must NOT be sent when masterEmailEnabled is false");
      } finally {
        emailService.sendNotificationEmail = originalSend;
      }
    });

    await test("Email dispatch skips delivery when specific event type is off even if master is on", async () => {
      // Turn master switch ON, but 'new_request' is OFF
      await notificationService.updateAllPreferences(userId, {
        masterEmailEnabled: true,
        preferences: [{ type: "new_request", emailEnabled: false }]
      });

      let emailSent = false;
      const originalSend = emailService.sendNotificationEmail.bind(emailService);
      emailService.sendNotificationEmail = async (params) => {
        emailSent = true;
        return { success: true, id: "mock_test_2" };
      };

      try {
        await notificationService.dispatchEmailNotificationIfEligible({
          userId,
          title: "New Request Test",
          message: "A new request was submitted",
          type: "purchase_request_submitted"
        });

        assert.strictEqual(emailSent, false, "Email must NOT be sent when event type preference is false");
      } finally {
        emailService.sendNotificationEmail = originalSend;
      }
    });

    await test("Email dispatch triggers delivery when master is on AND specific event type is on", async () => {
      // Turn master switch ON and 'pending_approval' ON
      await notificationService.updateAllPreferences(userId, {
        masterEmailEnabled: true,
        preferences: [{ type: "pending_approval", emailEnabled: true }]
      });

      let capturedRecipient = "";
      let capturedTitle = "";
      const originalSend = emailService.sendNotificationEmail.bind(emailService);
      emailService.sendNotificationEmail = async (params) => {
        capturedRecipient = params.to;
        capturedTitle = params.title;
        return { success: true, id: "mock_test_3" };
      };

      try {
        await notificationService.dispatchEmailNotificationIfEligible({
          userId,
          title: "Action Required: Sign-off Needed",
          message: "Please sign off on PR-100",
          type: "approval_required"
        });

        assert.strictEqual(capturedRecipient, testEmail, "Recipient must match user email");
        assert.strictEqual(capturedTitle, "Action Required: Sign-off Needed", "Title must match");
      } finally {
        emailService.sendNotificationEmail = originalSend;
      }
    });

    // 5. Requirement: Resend EmailService handles test emails and invalid inputs safely
    await test("EmailService sendTestEmail runs without throwing and handles fallback gracefully", async () => {
      // Use official Resend test sink (delivered@resend.dev) which succeeds in both live and sandbox
      const result = await emailService.sendTestEmail("delivered@resend.dev", "Test User");
      assert.ok(result.success, "sendTestEmail must return success = true in live or simulated mode");
      assert.ok(result.id, "sendTestEmail must provide a delivery or simulation ID");
    });

    await test("EmailService rejects invalid recipient email safely", async () => {
      const result = await emailService.sendNotificationEmail({
        to: "invalid-email-no-at-sign",
        title: "Test",
        message: "Test",
        type: "test"
      });
      assert.strictEqual(result.success, false, "Must return success = false for malformed email");
      assert.strictEqual(result.error, "Invalid recipient email");
    });

  } finally {
    // Clean up test data
    try {
      await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    } catch (cleanupErr) {
      console.warn("Test cleanup warning:", cleanupErr);
    }
  }

  console.log("================================================================================");
  console.log(`ALL NOTIFICATION PREFERENCE TESTS PASSED: ${passed}/${passed} (100% PASS RATE)`);
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test execution aborted with error:", err);
  process.exit(1);
});
