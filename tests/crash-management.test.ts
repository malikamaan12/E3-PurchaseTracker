import { NotificationService } from "../src/lib/services/NotificationService";
import { db } from "../db";
import { users, errorLogs, notifications } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

async function runCrashManagementTests() {
  console.log("================================================================================");
  console.log("   CRASH MANAGEMENT & SUPERADMIN NOTIFICATION ALERT SUITE                      ");
  console.log("================================================================================\n");

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string) {
    totalCount++;
    if (condition) {
      console.log(`  [CRASH-MGNT] ✓ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  [CRASH-MGNT] ✗ FAIL: ${testName}`);
    }
  }

  // 1. Verify Super Admins exist in DB
  const superAdmins = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));

  console.log(`  Found ${superAdmins.length} active Super Admin(s): [${superAdmins.map(s => s.username).join(", ")}]`);
  assert(superAdmins.length > 0, "At least one active Super Admin exists in the database");

  // 2. Test Crash Logging Entry
  const testMessage = `Automated Diagnostic Verification Test Error - ${Date.now()}`;
  const [inserted] = await db.insert(errorLogs).values({
    message: testMessage,
    code: "TEST_VERIFICATION_CRASH",
    severity: "critical",
    path: "/dashboard/requests/101",
    details: {
      stack: "Error: Simulated rendering failure\n    at RequestDetailPage (src/app/dashboard/requests/[id]/page.tsx:120:5)",
      digest: "TEST_DIGEST_9999",
      userAgent: "TestRunner/1.0",
      ipAddress: "127.0.0.1",
      timestamp: new Date().toISOString(),
    } as any,
  }).returning({ id: errorLogs.id });

  assert(!!inserted?.id, `Crash error log record created with ID #${inserted?.id}`);

  // 3. Test Super Admin Crash Notification Creation
  const notificationService = NotificationService.getInstance();
  const alertTitle = `🚨 System Crash Alert: ${testMessage.slice(0, 45)}...`;
  const alertMessage = `Crash detected on /dashboard/requests/101. Error: ${testMessage}. Incident Log #${inserted?.id}`;

  for (const admin of superAdmins) {
    const notif = await notificationService.createNotification({
      userId: admin.id,
      title: alertTitle,
      message: alertMessage,
      type: "system_alert",
      priority: "high",
      link: "/dashboard/admin/diagnostics",
      actionType: "view",
      actionData: {
        roleRestrictions: ["super_admin"],
        errorLogId: inserted?.id,
        route: "/dashboard/requests/101",
      },
    });

    assert(!!notif, `High-priority crash notification generated for Super Admin ${admin.username}`);
  }

  // 4. Verify RBAC Isolation (Regular user should NOT receive this notification)
  const regularUser = {
    id: 99999,
    username: "test_user",
    role: "user",
    department: "IT",
  };

  const syntheticAlert = {
    id: 8888,
    userId: 99999,
    type: "system_alert",
    title: alertTitle,
    message: alertMessage,
    isRead: false,
    actionData: {
      roleRestrictions: ["super_admin"],
    },
  };

  const isEligible = notificationService.isUserEligibleForNotification(syntheticAlert, regularUser as any);
  assert(!isEligible, "Regular employee is strictly BLOCKED from seeing SuperAdmin crash alerts");

  // 5. Verify Super Admin Eligibility
  const isSuperAdminEligible = notificationService.isUserEligibleForNotification(
    syntheticAlert,
    { id: superAdmins[0].id, username: superAdmins[0].username, role: "super_admin", department: "Executive" } as any
  );
  assert(isSuperAdminEligible, "Super Admin is eligible and authorized to receive crash alerts");

  // 6. Clean up test records
  if (inserted?.id) {
    await db.delete(errorLogs).where(eq(errorLogs.id, inserted.id));
    await db.delete(notifications).where(eq(notifications.title, alertTitle));
    console.log("  [CRASH-MGNT] ✓ Cleaned up synthetic test records from database");
  }

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${totalCount - passedCount} FAILED`);
  console.log("================================================================================\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runCrashManagementTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
