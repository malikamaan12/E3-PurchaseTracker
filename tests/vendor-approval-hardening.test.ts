import { transactionDb as db } from "../db";
import { vendorOnboardingDrafts, vendorDocuments, users, vendors } from "../db/schema";
import { vendorOnboardingService, ValidationError, NotFoundError } from "../src/lib/services/VendorOnboardingService";
import { ComplianceService } from "../src/lib/services/ComplianceService";
import { eq } from "drizzle-orm";

async function runVendorApprovalHardeningTests() {
  console.log("================================================================================");
  console.log("   VENDOR APPROVAL RESILIENCE & ERROR HANDLING TEST SUITE                      ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      console.log(`  [APPROVAL-HARDENING] ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  [APPROVAL-HARDENING] ✗ FAIL: ${name}`);
    }
  }

  const [admin] = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  if (!admin) throw new Error("No super admin found for tests");
  const superAdminId = admin.id;

  let testDraftId: number | null = null;
  let testVendorId: number | null = null;

  try {
    // TEST 1: Reject unsubmitted draft approval with clear message
    const [draft] = await db.insert(vendorOnboardingDrafts).values({
      companyName: "Unsubmitted Tech WLL",
      contactPerson: "Jane Doe",
      contactNumber: "+974 5511 2233",
      email: "jane@unsubmitted.qa",
      onboardingStatus: "invited",
      createdBy: superAdminId,
    }).returning();

    testDraftId = draft.id;

    let threwExpected = false;
    let errorMessage = "";
    try {
      await vendorOnboardingService.approveAndPromoteDraft({
        draftId: draft.id,
        userId: superAdminId,
      });
    } catch (err: any) {
      threwExpected = err instanceof ValidationError || err.name === "ValidationError";
      errorMessage = err.message;
    }

    assert(threwExpected && errorMessage.includes("not submitted their profile yet"), 
      "Reject unsubmitted draft with informative 'not submitted their profile yet' message");

    // TEST 2: Compliance scan resilience with unusual/empty document names
    const [testV] = await db.insert(vendors).values({
      companyName: "Null Document Vendor LLC",
      contactPerson: "John Smith",
      contactNumber: "+974 5500 1122",
      email: "john@nulltest.qa",
      address: "Doha, Qatar",
      bankName: "QNB",
      branchName: "Main",
      accountNumber: "12345678",
      ibanNumber: "QA55QNBA12345678901234",
      payment_currency: "QAR",
      status: "pending",
    }).returning();

    testVendorId = testV.id;

    await db.insert(vendorDocuments).values({
      vendorId: testV.id,
      documentType: "Commercial Registration",
      documentName: "",
      fileUrl: "https://example.com/doc.pdf",
      status: "valid",
      reviewStatus: "approved",
    });

    let scanSuccess = false;
    try {
      const scanRes = await ComplianceService.getInstance().scanVendorDocuments(testV.id);
      scanSuccess = scanRes && typeof scanRes.healthScore === "number";
    } catch (e) {
      console.error("Scan error:", e);
    }

    assert(scanSuccess, "Compliance scan executes cleanly with null-safe file handling");

    // TEST 3: Successful approval and activation of fully submitted draft
    const [submittedDraft] = await db.insert(vendorOnboardingDrafts).values({
      companyName: "Fully Compliant Automation WLL",
      contactPerson: "Ali Al-Kuwari",
      contactNumber: "+974 3311 4455",
      email: "ali@compliantauto.qa",
      address: "Zone 60, Street 100, Doha",
      taxNumber: "TAX-123456",
      registrationNumber: "CR-7891011",
      bankName: "Commercial Bank of Qatar",
      branchName: "Corniche Branch",
      accountNumber: "1122334455",
      ibanNumber: "QA55CBQK000000001122334455",
      payment_currency: "QAR",
      category: "general",
      onboardingStatus: "submitted",
      requiredDocumentTypes: [
        { type: "Commercial Registration", mandatory: true, description: "Official CR" },
      ],
      submittedAt: new Date(),
      createdBy: superAdminId,
    }).returning();

    await db.insert(vendorDocuments).values({
      draftId: submittedDraft.id,
      documentType: "Commercial Registration",
      documentName: "cr_doc_valid.pdf",
      fileUrl: "https://example.com/cr.pdf",
      status: "valid",
      reviewStatus: "approved",
      uploadedBySource: "vendor_onboarding",
      expiryDate: new Date("2028-01-01"),
    });

    const approvalResult = await vendorOnboardingService.approveAndPromoteDraft({
      draftId: submittedDraft.id,
      userId: superAdminId,
    });

    assert(
      approvalResult.success === true &&
      approvalResult.vendor !== undefined &&
      approvalResult.vendor.status === "active" &&
      approvalResult.vendor.companyName === "Fully Compliant Automation WLL",
      "Successfully approve, activate, and promote complete submitted draft to live vendor"
    );

    // Clean up approved vendor
    if (approvalResult.vendor?.id) {
      await db.delete(vendorDocuments).where(eq(vendorDocuments.vendorId, approvalResult.vendor.id));
      await db.delete(vendors).where(eq(vendors.id, approvalResult.vendor.id));
    }
    await db.delete(vendorDocuments).where(eq(vendorDocuments.draftId, submittedDraft.id));
    await db.delete(vendorOnboardingDrafts).where(eq(vendorOnboardingDrafts.id, submittedDraft.id));

  } finally {
    // Cleanup
    if (testDraftId) {
      await db.delete(vendorDocuments).where(eq(vendorDocuments.draftId, testDraftId));
      await db.delete(vendorOnboardingDrafts).where(eq(vendorOnboardingDrafts.id, testDraftId));
    }
    if (testVendorId) {
      await db.delete(vendorDocuments).where(eq(vendorDocuments.vendorId, testVendorId));
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
  }

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runVendorApprovalHardeningTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
  });
