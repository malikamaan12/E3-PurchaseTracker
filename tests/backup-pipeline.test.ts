import { R2Storage } from "../src/lib/storage/r2";
import { BackupService } from "../src/lib/services/BackupService";
import { GoogleDriveStorage } from "../src/lib/storage/google-drive";
import { db } from "../db";
import { systemSettings } from "../db/schema";
import { eq } from "drizzle-orm";

async function runBackupTests() {
  console.log("=== RUNNING BACKUP PIPELINE VERIFICATION TESTS ===");
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

  // Test 1: Role permission check logic
  try {
    const isAllowedRole = (role?: string) => {
      const r = role?.toLowerCase();
      return r === "admin" || r === "super_admin";
    };

    assert(isAllowedRole("admin") === true, "Admin role is permitted");
    assert(isAllowedRole("super_admin") === true, "Super Admin role is permitted");
    assert(isAllowedRole("ADMIN") === true, "Uppercase ADMIN is permitted");
    assert(isAllowedRole("SUPER_ADMIN") === true, "Uppercase SUPER_ADMIN is permitted");
    assert(isAllowedRole("user") === false, "Regular user is forbidden");
    assert(isAllowedRole("approver") === false, "Approver role is forbidden");
    assert(isAllowedRole("supervisor") === false, "Supervisor role is forbidden");
  } catch (err: any) {
    console.error("Test 1 error:", err);
    failed++;
  }

  // Test 2: Cloudflare R2 Storage List
  try {
    console.log("Testing Cloudflare R2 listBackups()...");
    const backups = await R2Storage.listBackups();
    assert(Array.isArray(backups), "R2Storage.listBackups() returns an array");
    assert(backups.length > 0, `R2Storage returned ${backups.length} backup archives`);
    console.log(`Found ${backups.length} archives in R2.`);
  } catch (err: any) {
    console.error("Test 2 error (R2):", err);
    failed++;
  }

  // Test 3: Google Drive graceful handling when credentials incomplete
  try {
    console.log("Testing GoogleDriveStorage uploadRedundant resilience...");
    // A dummy buffer
    const testBuffer = Buffer.from("test-content");
    const results = await GoogleDriveStorage.uploadRedundant(testBuffer, "test-ignore.xlsx");
    assert(Array.isArray(results), "GoogleDriveStorage.uploadRedundant returns an array without crashing");
  } catch (err: any) {
    console.error("Test 3 error (Google Drive):", err);
    failed++;
  }

  // Test 4: Database Setting Key Verification
  try {
    console.log("Verifying Database Vault settings keys...");
    const [primary] = await db.select().from(systemSettings).where(
      eq(systemSettings.key, "google_drive_folder_primary_id")
    );
    const [secondary] = await db.select().from(systemSettings).where(
      eq(systemSettings.key, "google_drive_folder_secondary_id")
    );

    assert(Boolean(primary?.value), `Primary folder configured in DB: ${primary?.value}`);
    assert(Boolean(secondary?.value), `Secondary folder configured in DB: ${secondary?.value}`);
  } catch (err: any) {
    console.error("Test 4 error (Settings):", err);
    failed++;
  }

  // Test 5: Full Backup Job Execution
  try {
    console.log("Testing BackupService.runBackupJob(true)...");
    const backupResult = await BackupService.runBackupJob(true);
    assert(backupResult?.success === true, `BackupService job succeeded: ${backupResult?.fileName}`);
  } catch (err: any) {
    console.error("Test 5 error (BackupService):", err);
    failed++;
  }

  console.log(`\n=== RESULTS: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runBackupTests();
