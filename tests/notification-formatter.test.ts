import assert from "node:assert";
import {
  resolveNotificationLink,
  formatNotificationTitle,
  formatNotificationMessage,
  formatNotificationTime,
} from "../src/lib/utils/notification-formatter";

console.log("================================================================================");
console.log("STARTING NOTIFICATION FORMATTER & LINK RESOLUTION TEST SUITE");
console.log("================================================================================");

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. Link Resolution Tests
test("Resolves valid purchase request links", () => {
  assert.strictEqual(resolveNotificationLink({ link: "/dashboard/requests/42", requestId: 42 }), "/dashboard/requests/42");
});

test("Fixes links with unresolved {id} or {requestId} placeholders", () => {
  assert.strictEqual(resolveNotificationLink({ link: "/dashboard/requests/{id}", requestId: 99 }), "/dashboard/requests/99");
  assert.strictEqual(resolveNotificationLink({ link: "/dashboard/requests/{requestId}", requestId: 101 }), "/dashboard/requests/101");
});

test("Falls back to /dashboard/requests when no requestId is present on broken PR link", () => {
  assert.strictEqual(resolveNotificationLink({ link: "/dashboard/requests/{id}" }), "/dashboard/requests");
});

test("Resolves vendor notifications without ID placeholders to /dashboard/vendors", () => {
  assert.strictEqual(resolveNotificationLink({ link: "/dashboard/vendors/{id}", type: "vendor_created" }), "/dashboard/vendors");
  assert.strictEqual(resolveNotificationLink({ type: "vendor_updated" }), "/dashboard/vendors");
});

test("Resolves system diagnostic notifications to /dashboard/admin/diagnostics", () => {
  assert.strictEqual(resolveNotificationLink({ type: "system_error" }), "/dashboard/admin/diagnostics");
});

test("Prefixes non-dashboard relative links with /dashboard", () => {
  assert.strictEqual(resolveNotificationLink({ link: "/requests/12" }), "/dashboard/requests/12");
  assert.strictEqual(resolveNotificationLink({ link: "/vendors" }), "/dashboard/vendors");
});

// 2. Title Formatting Tests
test("Formats snake_case event names into Clean Title Case", () => {
  assert.strictEqual(formatNotificationTitle({ title: "purchase_request_approved" }), "Request Approved");
  assert.strictEqual(formatNotificationTitle({ title: "approval_required" }), "Approval Required");
  assert.strictEqual(formatNotificationTitle({ type: "purchase_request_changes_requested" }), "Changes Requested");
});

test("Preserves custom formatted titles", () => {
  assert.strictEqual(formatNotificationTitle({ title: "Urgent PO Sign-Off Needed" }), "Urgent PO Sign-Off Needed");
});

test("Fallbacks to System Notification when empty or null", () => {
  assert.strictEqual(formatNotificationTitle({}), "System Notification");
  assert.strictEqual(formatNotificationTitle(null), "System Notification");
});

// 3. Message Formatting Tests
test("Parses and extracts readable messages from raw JSON strings", () => {
  const rawJson = JSON.stringify({ message: "Vendor profile approved by procurement" });
  assert.strictEqual(formatNotificationMessage({ message: rawJson }), "Vendor profile approved by procurement");
});

test("Cleans unreplaced placeholders like {title}", () => {
  assert.strictEqual(formatNotificationMessage({ message: "Request {title} was submitted" }), "Request title was submitted");
});

test("Returns clean plain messages as-is", () => {
  assert.strictEqual(formatNotificationMessage({ message: "Your request has been approved." }), "Your request has been approved.");
});

// 4. Time Formatting Tests
test("Returns 'recently' for invalid or missing dates", () => {
  assert.strictEqual(formatNotificationTime(null), "recently");
  assert.strictEqual(formatNotificationTime("invalid-date"), "recently");
});

test("Returns formatted relative time for valid dates", () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const formatted = formatNotificationTime(fiveMinutesAgo);
  assert.ok(formatted.includes("ago"));
});

console.log("================================================================================");
console.log(`ALL TESTS PASSED: ${passed}/${passed} (100% PASS RATE)`);
console.log("================================================================================");
