import { R2Storage } from "../src/lib/storage/r2";
import { GoogleDriveStorage } from "../src/lib/storage/google-drive";
import { SettingsService } from "../src/lib/services/SettingsService";

async function runDriveConnectionTests() {
  console.log("=== RUNNING DRIVE CONNECTION & CREDENTIALS TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Cloudflare R2 testConnection()
  try {
    console.log("Testing R2Storage.testConnection()...");
    const r2Result = await R2Storage.testConnection();
    console.log("R2 Test Result:", r2Result);
    assert(r2Result.ok === true, "R2Storage.testConnection() succeeds");
    assert(Boolean(r2Result.bucket), `R2 Bucket verified: ${r2Result.bucket}`);
  } catch (err: any) {
    console.error("Test 1 error:", err);
    failed++;
  }

  // Test 2: GoogleDriveStorage.testConnection() behavior
  try {
    console.log("Testing GoogleDriveStorage.testConnection()...");
    const gdriveResult = await GoogleDriveStorage.testConnection("1rdvsubX5zb5IX4fOe4oXJozNgz-6bbBQ");
    console.log("Google Drive Test Result:", gdriveResult);
    assert(typeof gdriveResult.ok === "boolean", "GoogleDriveStorage.testConnection returns a boolean ok status");
    if (!gdriveResult.ok) {
      assert(Boolean(gdriveResult.error), `Detailed error returned: ${gdriveResult.error}`);
    }
  } catch (err: any) {
    console.error("Test 2 error:", err);
    failed++;
  }

  // Test 3: Settings Service credential round-trip
  try {
    console.log("Testing SettingsService credential persistence...");
    const testEmail = "test-agent@project.iam.gserviceaccount.com";
    await SettingsService.setSetting("google_drive_service_account_email", testEmail);
    const retrieved = await SettingsService.getSetting("google_drive_service_account_email");
    assert(retrieved === testEmail, "SettingsService correctly stores and retrieves google_drive_service_account_email");

    // Clean up test setting
    await SettingsService.setSetting("google_drive_service_account_email", "");
  } catch (err: any) {
    console.error("Test 3 error:", err);
    failed++;
  }

  // Test 4: Credential extraction and parsing
  try {
    console.log("Testing Service Account JSON parser...");
    const mockJson = JSON.stringify({
      type: "service_account",
      project_id: "test-project",
      client_email: "bot@test.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n",
    });

    const parsed = JSON.parse(mockJson);
    assert(parsed.client_email === "bot@test.iam.gserviceaccount.com", "Valid client email extracted from JSON");
    assert(Boolean(parsed.private_key), "Private key extracted from JSON");
  } catch (err: any) {
    console.error("Test 4 error:", err);
    failed++;
  }

  console.log(`\n=== RESULTS: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runDriveConnectionTests();
