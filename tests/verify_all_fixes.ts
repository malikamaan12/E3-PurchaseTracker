import { FinancialMetricsService } from "../src/lib/services/FinancialMetricsService";
import { maskAccountNumber, maskIban, maskVendorBanking, maskVendorList } from "../src/lib/utils/masking";
import { NotificationService } from "../src/lib/services/NotificationService";
import { db } from "../db";
import { purchaseRequests, subPurposes, paymentInstallments, vendors } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function runVerification() {
  console.log("=================================================");
  console.log("  COMPREHENSIVE AUTOMATED VERIFICATION SUITE    ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extraInfo?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${extraInfo ? ` - ${extraInfo}` : ""}`);
      failed++;
    }
  }

  // ─── TEST SUITE 1: CANONICAL FINANCIAL CALCULATIONS ───
  console.log("\n--- Suite 1: Financial Metrics & Canonical Calculation ---");
  
  const allRequests = await db.select().from(purchaseRequests);
  const allSubPurposes = await db.select().from(subPurposes);
  const activeSubPurposes = allSubPurposes.filter(sp => sp.status === 'ACTIVE' || sp.status === 'active' || !sp.status || (sp as any).isFrozen === false);
  
  assert(allRequests.length >= 2, `Database contains production purchase requests (found ${allRequests.length})`);
  assert(allSubPurposes.length >= 16, `Database contains projects / sub-purposes (found ${allSubPurposes.length})`);

  const canonical = await FinancialMetricsService.getGlobalFinancialMetrics(undefined, "2026-08-17");
  
  assert(canonical.committedAmount === 9250, `Committed/Authorized volume equals 9,250 QAR (got ${canonical.committedAmount})`);
  assert(canonical.disbursedAmount === 0, `Disbursed/Paid volume equals 0 QAR (got ${canonical.disbursedAmount})`);
  assert(canonical.activeRequestsCount >= 2, `Active requests count dynamically verified (got ${canonical.activeRequestsCount})`);
  assert(canonical.remainingCommittedBalance === 9250, `Remaining balance equals 9,250 QAR (got ${canonical.remainingCommittedBalance})`);

  // ─── TEST SUITE 2: VENDOR BANKING MASKING & SECURITY ───
  console.log("\n--- Suite 2: Vendor Banking Security & Masking ---");

  const sampleIban = "QA55CBQA000000001234567890123";
  const maskedIban = maskIban(sampleIban);
  assert(maskedIban.startsWith("QA") && maskedIban.endsWith("0123"), `IBAN masking preserves country code and last 4 digits (got "${maskedIban}")`);
  assert(!maskedIban.includes("123456789"), "IBAN masking completely redacts intermediate account digits");

  const sampleAccount = "000123456789";
  const maskedAccount = maskAccountNumber(sampleAccount);
  assert(maskedAccount.endsWith("6789") && maskedAccount.includes("••••"), `Account number masking protects leading digits (got "${maskedAccount}")`);

  const mockVendor = {
    id: 1,
    companyName: "Al Rayyan Supplies",
    accountNumber: "123456789012",
    ibanNumber: "QA12CBQA000011112222333344445",
    bankName: "Commercial Bank of Qatar",
    beneficiaryName: "Al Rayyan Co"
  };

  const maskedVendor = maskVendorBanking(mockVendor);
  assert(maskedVendor.isBankingMasked === true, "Vendor object tagged with isBankingMasked=true");
  assert(maskedVendor.accountNumber !== mockVendor.accountNumber, "Vendor account number masked in payload");
  assert(maskedVendor.ibanNumber !== mockVendor.ibanNumber, "Vendor IBAN number masked in payload");

  // ─── TEST SUITE 3: NOTIFICATION IDEMPOTENCY & DEDUPLICATION ───
  console.log("\n--- Suite 3: Notification Idempotency & Deduplication ---");

  const duplicateBatch = [
    { id: 1, userId: 1, requestId: 69, type: "approval_required", title: "Approval Required", message: "Back to School PR requires approval", isRead: false, createdAt: new Date("2026-08-16T10:00:00Z") },
    { id: 2, userId: 1, requestId: 69, type: "approval_required", title: "Approval Required", message: "Back to School PR requires approval", isRead: false, createdAt: new Date("2026-08-16T09:00:00Z") },
    { id: 3, userId: 1, requestId: 68, type: "approval_required", title: "Approval Required", message: "Urban Arena PR requires approval", isRead: false, createdAt: new Date("2026-08-16T08:00:00Z") }
  ];

  const deduplicated = NotificationService.deduplicateNotifications(duplicateBatch);
  assert(deduplicated.length === 2, `Duplicate notifications deduplicated in memory (3 items -> ${deduplicated.length} items)`);
  assert(deduplicated.some(n => n.requestId === 69) && deduplicated.some(n => n.requestId === 68), "Unique notification events preserved");

  // ─── TEST SUITE 4: DATA INTEGRITY PRESERVATION ───
  console.log("\n--- Suite 4: Production Data Integrity Verification ---");

  const [req69] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 69));
  const [req68] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 68));

  assert(!!req69 && req69.requestNumber === "BACKTOSC-MKT-20260816-0002" && Number(req69.totalEstimatedCost) === 7250, "PR 69 intact: BACKTOSC-MKT-20260816-0002 with 7,250 QAR");
  assert(!!req68 && req68.requestNumber === "URBANARE-MKT-20260812-0035" && Number(req68.totalEstimatedCost) === 2000, "PR 68 intact: URBANARE-MKT-20260812-0035 with 2,000 QAR");

  console.log("\n=================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error("FATAL ERROR during test execution:", err);
  process.exit(1);
});
