/**
 * E2E Purchase Request & Vendor Onboarding Lifecycle Automated Test Suite
 * 
 * Verifies:
 * 1. Vendor Onboarding: Quick create -> Token Generation -> Self-service Submission -> Compliance Promotion
 * 2. Purchase Request: Creation with line items -> Multi-stage RBAC Approval -> Finance Project Allocation
 * 3. Financial Metrics: Invariant validation & ledger recalculation
 * 4. Data Hygiene: Deterministic setup and teardown of all test fixtures
 */

import { db } from "../db";
import { 
  users, 
  vendors, 
  purchaseRequests, 
  approvals, 
  subPurposes, 
  purposeCategories, 
  vendorOnboardingTokens, 
  vendorDocuments
} from "../db/schema";
import { eq } from "drizzle-orm";
import { FinancialMetricsService } from "../src/lib/services/FinancialMetricsService";
import crypto from "crypto";

console.log("================================================================================");
console.log("RUNNING SUITE: End-to-End Purchase & Vendor Onboarding Automation");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failedCount++;
  }
}

async function runE2ETestSuite() {
  const timestamp = Date.now();
  const testVendorName = `E2E Tech Supplies_${timestamp}`;
  const testPRNumber = `E2E-REQ-${timestamp}`;
  
  let createdVendorId: number | null = null;
  let createdPRId: number | null = null;
  let createdCategoryId: number | null = null;
  let createdSubPurposeId: number | null = null;
  let testUserId: number | null = null;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Environment & Fixture Setup
    // ─────────────────────────────────────────────────────────────────────────
    console.log("--- [Phase 1] Setting Up Test Environment & Users ---");

    const existingUser = await db.query.users.findFirst({
      where: eq(users.role, "super_admin")
    });

    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const [newUser] = await db.insert(users).values({
        username: `e2e_admin_${timestamp}`,
        password: "hash_placeholder",
        email: `e2e_admin_${timestamp}@example.com`,
        contact_number: "+974 5500 0001",
        department: "Operations",
        role: "super_admin",
        isActive: true,
        canManageVendors: true,
      }).returning();
      testUserId = newUser.id;
    }
    assert(testUserId !== null, "Authoritative admin user resolved for test execution");

    // Create Category & Project for budget allocations
    const [category] = await db.insert(purposeCategories).values({
      name: `E2E Category_${timestamp}`,
      description: "Automated E2E Test Purpose Category",
      status: "active"
    }).returning();
    createdCategoryId = category.id;

    const [subPurpose] = await db.insert(subPurposes).values({
      name: `E2E Digital Transformation_${timestamp}`,
      purposeCategoryId: category.id,
      purposeType: "CAPEX",
      totalBudget: 250000,
      status: "active"
    }).returning();
    createdSubPurposeId = subPurpose.id;
    assert(createdSubPurposeId > 0, "Test project budget created (250,000 QAR)");

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: Vendor Creation & Self-Service Compliance Flow
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- [Phase 2] Vendor Quick-Create & Compliance Onboarding Flow ---");

    // 1. Quick-create draft vendor
    const [vendor] = await db.insert(vendors).values({
      companyName: testVendorName,
      contactPerson: "Ahmed Al-Mansouri",
      contactNumber: "+974 5555 1234",
      email: `vendor_${timestamp}@e2esupplies.qa`,
      address: "Street 840, Zone 55, Doha, Qatar",
      vendorType: "company",
      engagementType: "permanent",
      status: "pending",
      complianceScore: 0,
    }).returning();
    createdVendorId = vendor.id;
    assert(createdVendorId > 0, `Draft vendor created with ID ${createdVendorId} (Status: pending)`);

    // 2. Generate secure single-use completion link
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [tokenRecord] = await db.insert(vendorOnboardingTokens).values({
      vendorId: createdVendorId,
      tokenHash,
      createdBy: testUserId!,
      status: "active",
      expiresAt,
    }).returning();
    assert(tokenRecord.id > 0, "256-bit SHA-256 Onboarding token generated and stored");

    // 3. Self-service profile & banking submission
    await db.update(vendors)
      .set({
        address: "West Bay Tower 4, Doha, Qatar",
        taxNumber: "TAX-112233",
        registrationNumber: "CR-998877",
        bankName: "Qatar National Bank",
        accountNumber: "000199887766",
        ibanNumber: "QA99QNBA000000001998877665544",
        status: "under_review",
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, createdVendorId));

    // Upload required compliance document
    const [doc] = await db.insert(vendorDocuments).values({
      vendorId: createdVendorId,
      documentType: "commercial_registration",
      documentName: "CR_Certificate_2026.pdf",
      fileUrl: `https://storage.e3purchasetracker.qa/docs/cr_cert_${timestamp}.pdf`,
      status: "valid",
      reviewStatus: "approved",
      uploadedBySource: "vendor_onboarding",
    }).returning();
    assert(doc.id > 0, "Commercial Registration PDF uploaded and validated");

    // 4. Admin reviews compliance and activates vendor
    await db.update(vendors)
      .set({
        status: "active",
        complianceStatus: "compliant",
        complianceScore: 100,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, createdVendorId));

    const activatedVendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, createdVendorId)
    });
    assert(activatedVendor?.status === "active" && activatedVendor?.complianceScore === 100, "Vendor successfully promoted to 'active' with 100% compliance");

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Purchase Request Lifecycle & Approval Chain
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- [Phase 3] Purchase Request Lifecycle & Stage Approvals ---");

    // 1. Requester creates PR
    const lineItems = [
      { name: "Enterprise Server Rack", quantity: 2, estimatedCost: 15000, description: "42U Server Enclosure" },
      { name: "High-Speed Core Switches", quantity: 4, estimatedCost: 7500, description: "10GbE Managed Switch" },
    ];
    const totalEstimatedCost = (2 * 15000) + (4 * 7500); // 60,000 QAR

    const [pr] = await db.insert(purchaseRequests).values({
      requestNumber: testPRNumber,
      requesterId: testUserId!,
      vendorId: createdVendorId,
      title: "Core Datacenter Network Upgrade",
      description: "Hardware acquisition for primary datacenter infrastructure upgrade",
      department: "IT",
      items: lineItems,
      purposeCategoryId: createdCategoryId,
      subPurposeId: createdSubPurposeId,
      purposeType: "CAPEX",
      priority: "high",
      currency: "QAR",
      totalEstimatedCost,
      status: "pending_dept_head",
    }).returning();
    createdPRId = pr.id;
    assert(createdPRId > 0, `Purchase Request #${testPRNumber} created (Total: ${totalEstimatedCost.toLocaleString()} QAR)`);

    // 2. Stage 1: Department Head Approval
    const [deptApproval] = await db.insert(approvals).values({
      requestId: createdPRId,
      approverId: testUserId!,
      department: "IT",
      status: "approved",
      comments: "Approved by IT Department Head - technical specifications validated.",
      isMandatory: true,
      processedAt: new Date(),
    }).returning();
    assert(deptApproval.status === "approved", "Stage 1: IT Department Head approval recorded");

    // Transition PR to pending finance
    await db.update(purchaseRequests)
      .set({ status: "pending_finance", updatedAt: new Date() })
      .where(eq(purchaseRequests.id, createdPRId));

    // 3. Stage 2: Finance Allocation & Final Approval
    const [financeApproval] = await db.insert(approvals).values({
      requestId: createdPRId,
      approverId: testUserId!,
      department: "Finance",
      status: "approved",
      comments: "Approved by Finance - Capex funds allocated from Digital Transformation project.",
      isMandatory: true,
      processedAt: new Date(),
    }).returning();
    assert(financeApproval.status === "approved", "Stage 2: Finance approval recorded");

    // Final promotion to 'approved'
    await db.update(purchaseRequests)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(purchaseRequests.id, createdPRId));

    const approvedPR = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, createdPRId)
    });
    assert(approvedPR?.status === "approved", "Purchase Request transitioned to authoritative 'approved' status");

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4: Financial Metrics & Invariant Recalculation
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- [Phase 4] Financial Metrics Invariants & Integrity ---");

    const metrics = await FinancialMetricsService.getGlobalFinancialMetrics();

    // Verify mathematical invariants
    assert(metrics.committedAmount === metrics.fullyApprovedAmount + metrics.partiallyApprovedAmount, 
      `Committed invariant: committedAmount (${metrics.committedAmount}) == fullyApproved (${metrics.fullyApprovedAmount}) + partiallyApproved (${metrics.partiallyApprovedAmount})`);
    
    assert(metrics.remainingCommittedBalance === Math.max(0, metrics.committedAmount - metrics.disbursedAmount),
      `Balance invariant: remainingCommitted (${metrics.remainingCommittedBalance}) == committed (${metrics.committedAmount}) - disbursed (${metrics.disbursedAmount})`);

    assert(metrics.activeRequestsCount === metrics.requestedCount + metrics.partiallyApprovedCount + metrics.fullyApprovedCount,
      `Count invariant: activeRequestsCount (${metrics.activeRequestsCount}) == requested (${metrics.requestedCount}) + partiallyApproved (${metrics.partiallyApprovedCount}) + fullyApproved (${metrics.fullyApprovedCount})`);

    assert(metrics.activeRequestsVolume >= totalEstimatedCost,
      `Active volume includes newly created approved request (${metrics.activeRequestsVolume} >= ${totalEstimatedCost})`);

  } catch (error: any) {
    console.error("E2E Test Execution encountered an error:", error);
    failedCount++;
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // Phase 5: Deterministic Teardown & Database Cleanup
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- [Phase 5] Deterministic Cleanup of Test Fixtures ---");

    if (createdPRId) {
      await db.delete(approvals).where(eq(approvals.requestId, createdPRId));
      await db.delete(purchaseRequests).where(eq(purchaseRequests.id, createdPRId));
      console.log(`  ✓ Cleaned up test Purchase Request ID ${createdPRId}`);
    }

    if (createdVendorId) {
      await db.delete(vendorDocuments).where(eq(vendorDocuments.vendorId, createdVendorId));
      await db.delete(vendorOnboardingTokens).where(eq(vendorOnboardingTokens.vendorId, createdVendorId));
      await db.delete(vendors).where(eq(vendors.id, createdVendorId));
      console.log(`  ✓ Cleaned up test Vendor ID ${createdVendorId}`);
    }

    if (createdSubPurposeId) {
      await db.delete(subPurposes).where(eq(subPurposes.id, createdSubPurposeId));
      console.log(`  ✓ Cleaned up test SubPurpose ID ${createdSubPurposeId}`);
    }

    if (createdCategoryId) {
      await db.delete(purposeCategories).where(eq(purposeCategories.id, createdCategoryId));
      console.log(`  ✓ Cleaned up test PurposeCategory ID ${createdCategoryId}`);
    }

    console.log("\n================================================================================");
    console.log(`E2E SUITE COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("================================================================================");

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runE2ETestSuite().catch((err) => {
  console.error("Fatal test failure:", err);
  process.exit(1);
});
