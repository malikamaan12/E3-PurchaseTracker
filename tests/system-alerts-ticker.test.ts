import { describe, it } from "node:test";
import assert from "node:assert";
import { AlertsService, SystemAlert } from "../src/lib/services/AlertsService";

async function runTests() {
  console.log("=".repeat(80));
  console.log("STARTING SYSTEM ALERTS & TICKER TEST SUITE");
  console.log("=".repeat(80));

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  await test("AlertsService.getAllAlerts returns an array", async () => {
    const alerts = await AlertsService.getAllAlerts();
    assert(Array.isArray(alerts), "Expected array of alerts");
    assert(alerts.length > 0, "Expected at least one initial or seeded alert");
  });

  let createdAlertId = "";

  await test("AlertsService.saveAlert creates a new broadcast alert", async () => {
    const newAlert = await AlertsService.saveAlert({
      title: "Test Compliance Update",
      message: "Testing system broadcast tickers for compliance and audit regulations.",
      category: "compliance",
      priority: "important",
      active: true,
      linkUrl: "/dashboard/compliance",
      linkText: "Review Rule",
    });

    assert(newAlert.id, "Expected alert to have an ID");
    assert.strictEqual(newAlert.title, "Test Compliance Update");
    assert.strictEqual(newAlert.category, "compliance");
    assert.strictEqual(newAlert.active, true);
    createdAlertId = newAlert.id;
  });

  await test("AlertsService.getActiveAlerts includes active alert", async () => {
    const activeAlerts = await AlertsService.getActiveAlerts();
    const found = activeAlerts.find((a) => a.id === createdAlertId);
    assert(found, "Expected newly created active alert to be in getActiveAlerts()");
  });

  await test("AlertsService.toggleAlertActive can pause an alert", async () => {
    const updated = await AlertsService.toggleAlertActive(createdAlertId, false);
    assert(updated, "Expected updated alert returned");
    assert.strictEqual(updated.active, false);

    const activeAlerts = await AlertsService.getActiveAlerts();
    const found = activeAlerts.find((a) => a.id === createdAlertId);
    assert(!found, "Paused alert must not be returned in getActiveAlerts()");
  });

  await test("AlertsService.deleteAlert removes the alert", async () => {
    const deleted = await AlertsService.deleteAlert(createdAlertId);
    assert.strictEqual(deleted, true);

    const all = await AlertsService.getAllAlerts();
    const found = all.find((a) => a.id === createdAlertId);
    assert(!found, "Deleted alert must no longer exist in getAllAlerts()");
  });

  console.log("=".repeat(80));
  console.log(`ALL TESTS COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("=".repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
