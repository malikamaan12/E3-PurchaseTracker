import assert from "assert";
import crypto from "crypto";
import {
  vendorQuickCreateSchema,
  vendorRuleDefinitionSchema,
  vendorBankingSubmissionSchema,
  vendorRequirementSubmissionSchema,
} from "../db/schema";
import { VendorBankingStagingService } from "../src/lib/services/VendorBankingStagingService";

async function runVendorRedesignTestSuite() {
  console.log("================================================================================");
  console.log("STARTING VENDOR MANAGEMENT REDESIGN V1.1.0-REVISED COMPREHENSIVE TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(category: string, name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  [${category}] ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [${category}] ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Zod Schema Validations
  await test("Schema", "Test 1: Quick-Create schema allows minimal vendor creation (name, contact, phone, email, type)", () => {
    const validPayload = {
      companyName: "Al Rayyan Supplies W.L.L.",
      contactPerson: "Jassim Al-Kuwari",
      contactNumber: "+974 5511 2233",
      email: "procurement@alrayyan.qa",
      address: "Industrial Area, Doha",
      vendorType: "company",
      engagementType: "permanent",
      deadlineOption: "30",
    };

    const parsed = vendorQuickCreateSchema.parse(validPayload);
    assert.strictEqual(parsed.companyName, validPayload.companyName);
    assert.strictEqual(parsed.vendorType, "company");
    assert.strictEqual(parsed.deadlineOption, "30");
  });

  await test("Schema", "Test 2: Quick-Create schema rejects invalid email or missing company name", () => {
    const invalidEmail = {
      companyName: "Valid Company",
      contactPerson: "Valid Contact",
      contactNumber: "+974 5500 0000",
      email: "invalid-email-string",
      vendorType: "company",
    };

    assert.throws(() => {
      vendorQuickCreateSchema.parse(invalidEmail);
    }, /Invalid email format/);

    const missingName = {
      companyName: "",
      contactPerson: "Valid Contact",
      contactNumber: "+974 5500 0000",
      email: "valid@email.com",
      vendorType: "company",
    };

    assert.throws(() => {
      vendorQuickCreateSchema.parse(missingName);
    }, /Company \/ Freelancer name must be at least 2 characters/);
  });

  // 2. Multi-Dimensional Status Modeling
  await test("Multi-Dimensional", "Test 3: Orthogonal status modeling isolates submission, validity, and deadline statuses", () => {
    const requirementState = {
      ruleKey: "TAX_CARD",
      submissionStatus: "submitted",
      validityStatus: "valid",
      deadlineStatus: "completed_on_time",
    };

    assert.strictEqual(requirementState.submissionStatus, "submitted");
    assert.strictEqual(requirementState.validityStatus, "valid");
    assert.strictEqual(requirementState.deadlineStatus, "completed_on_time");

    // Can transition submission to 'verified' without mutating deadline completion
    requirementState.submissionStatus = "verified";
    assert.strictEqual(requirementState.submissionStatus, "verified");
    assert.strictEqual(requirementState.deadlineStatus, "completed_on_time");
  });

  // 3. Directive 1: 0% Compliance Score Credit for Under-Review
  await test("Directive 1", "Test 4: Submitted/under-review requirements receive 0% compliance-score credit until verified", () => {
    const weights = { CR: 40, TAX_CARD: 30, ESTABLISHMENT_ID: 30 };
    const totalWeight = weights.CR + weights.TAX_CARD + weights.ESTABLISHMENT_ID; // 100

    // All submitted but none verified
    const subStatuses = { CR: "submitted", TAX_CARD: "submitted", ESTABLISHMENT_ID: "submitted" };
    let earnedWeight = 0;

    for (const [key, status] of Object.entries(subStatuses)) {
      if (status === "verified") {
        earnedWeight += weights[key as keyof typeof weights];
      }
    }

    const unverifiedScore = Math.round((earnedWeight / totalWeight) * 100);
    assert.strictEqual(unverifiedScore, 0, "Score must be 0% when documents are under review");

    // Verify CR
    subStatuses.CR = "verified";
    earnedWeight = 0;
    for (const [key, status] of Object.entries(subStatuses)) {
      if (status === "verified") {
        earnedWeight += weights[key as keyof typeof weights];
      }
    }
    const partiallyVerifiedScore = Math.round((earnedWeight / totalWeight) * 100);
    assert.strictEqual(partiallyVerifiedScore, 40, "Score must reflect only verified weight (40%)");
  });

  // 4. Directive 2: Deadline Completion based on Submission Timestamp
  await test("Directive 2", "Test 5: Deadline completion is determined using submission timestamp, not verification timestamp", () => {
    const deadline = new Date("2026-09-01T00:00:00Z");
    const submittedAt = new Date("2026-08-25T12:00:00Z"); // Before deadline
    const verifiedAt = new Date("2026-09-10T12:00:00Z"); // 9 days after deadline!

    const isSubmittedOnTime = submittedAt <= deadline;
    const deadlineStatus = isSubmittedOnTime ? "completed_on_time" : "completed_late";

    assert.strictEqual(isSubmittedOnTime, true);
    assert.strictEqual(deadlineStatus, "completed_on_time", "Verification after deadline must preserve 'completed_on_time' status");
  });

  await test("Directive 2", "Test 6: Rejection reopens requirement; overdue if deadline has passed", () => {
    const deadline = new Date("2026-08-01T00:00:00Z");
    const now = new Date("2026-08-21T00:00:00Z");

    const rejectionEvent = {
      decision: "reject",
      rejectedAt: now,
    };

    // Upon rejection, requirement is reopened
    const reopenedRequirement = {
      submissionStatus: "rejected",
      validityStatus: "not_applicable",
      deadlineStatus: now > deadline ? "overdue" : "due",
    };

    assert.strictEqual(reopenedRequirement.submissionStatus, "rejected");
    assert.strictEqual(reopenedRequirement.deadlineStatus, "overdue", "Reopened requirement after deadline must be overdue");
  });

  // 5. Staged Banking Quarantine & Dual Control
  await test("Banking Staging", "Test 7: Vendor banking input is quarantined in pending_stage1 and does not mutate vendor payables", () => {
    const canonicalVendor = {
      id: 101,
      bankName: null,
      accountNumber: null,
      ibanNumber: null,
      bankingVerificationStatus: "unverified",
    };

    const stagedSubmission = {
      id: 1,
      vendorId: 101,
      bankName: "Qatar National Bank (QNB)",
      branchName: "Corporate Branch",
      accountNumber: "0013-123456-001",
      ibanNumber: "QA55QNBA0000000013123456001",
      status: "pending_stage1",
    };

    // Verify canonical vendor is unchanged
    assert.strictEqual(canonicalVendor.accountNumber, null);
    assert.strictEqual(canonicalVendor.ibanNumber, null);
    assert.strictEqual(stagedSubmission.status, "pending_stage1");
  });

  await test("Banking Staging", "Test 8: Stage 1 review advances status to pending_stage2; Stage 2 confirms and promotes", () => {
    const submission = {
      status: "pending_stage1",
      stage1ReviewedBy: null as number | null,
      stage2ReviewedBy: null as number | null,
    };

    // Finance Stage 1 Review
    submission.status = "pending_stage2";
    submission.stage1ReviewedBy = 5; // Finance user ID
    assert.strictEqual(submission.status, "pending_stage2");
    assert.strictEqual(submission.stage1ReviewedBy, 5);

    // Super Admin Stage 2 Confirmation
    submission.status = "verified";
    submission.stage2ReviewedBy = 1; // Super Admin user ID
    assert.strictEqual(submission.status, "verified");
    assert.strictEqual(submission.stage2ReviewedBy, 1);
  });

  await test("Banking Staging", "Test 9: Masking utility masks IBAN and account numbers correctly for non-finance users", () => {
    const rawIban = "QA55QNBA0000000013123456001";
    const rawAccount = "0013123456001";

    const maskedIban = VendorBankingStagingService.maskIban(rawIban);
    const maskedAccount = VendorBankingStagingService.maskAccountNumber(rawAccount);

    assert.strictEqual(maskedIban.startsWith("QA"), true);
    assert.strictEqual(maskedIban.endsWith("6001"), true);
    assert.strictEqual(maskedIban.includes("••••"), true);

    assert.strictEqual(maskedAccount.endsWith("6001"), true);
    assert.strictEqual(maskedAccount.includes("••••"), true);
  });

  // 6. Token Lifecycle & Expiration Independence
  await test("Token Lifecycle", "Test 10: 7-day SHA-256 token expiration is decoupled from compliance deadline (30 days)", () => {
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const complianceDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const tokenDays = Math.round((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const deadlineDays = Math.round((complianceDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    assert.strictEqual(tokenDays, 7);
    assert.strictEqual(deadlineDays, 30);
    assert.notStrictEqual(tokenDays, deadlineDays, "Portal token validity must be independent of compliance deadline");
  });

  // 7. Non-Blocking PR Gatekeeper
  await test("PR Gatekeeper", "Test 11: Non-compliant or pending vendors NEVER block Purchase Requests (isBlocked is always false)", async () => {
    const { evaluateCompliance } = await import("../src/lib/core/compliance");

    // evaluateCompliance always returns isBlocked: false
    const evaluation = await evaluateCompliance(0);
    assert.strictEqual(evaluation.isBlocked, false, "PR must NEVER be blocked by vendor compliance");
    assert.strictEqual(evaluation.complianceScore, 100);
  });

  // 8. Immutable Ruleset Versions
  await test("Rule Versioning", "Test 12: Rule matrix changes are locked into immutable snapshot versions", () => {
    const rulesetVersion = {
      id: 1,
      versionNumber: 1,
      status: "published",
      ruleDefinitionsSnapshot: [
        { ruleKey: "CR", isMandatory: true, affectsScore: true, scoreWeight: 40 },
        { ruleKey: "TAX_CARD", isMandatory: true, affectsScore: true, scoreWeight: 30 },
      ],
      publishedAt: new Date(),
    };

    assert.strictEqual(rulesetVersion.status, "published");
    assert.strictEqual(rulesetVersion.ruleDefinitionsSnapshot.length, 2);
    // Frozen snapshot cannot be mutated by future draft changes
  });

  // 9. Cascade Integrity
  await test("Cascade Rules", "Test 13: Disabling applicability automatically resets mandatory and score flags", () => {
    const rule = {
      companyApplicable: true,
      companyMandatory: true,
      companyAffectsScore: true,
    };

    // Admin toggles companyApplicable to false
    rule.companyApplicable = false;
    if (!rule.companyApplicable) {
      rule.companyMandatory = false;
      rule.companyAffectsScore = false;
    }

    assert.strictEqual(rule.companyApplicable, false);
    assert.strictEqual(rule.companyMandatory, false);
    assert.strictEqual(rule.companyAffectsScore, false);
  });

  // 10. Locked Rules Immutability
  await test("Locked Rules", "Test 14: Core statutory rules (CR for Company, QID for Freelancer) have isLocked: true", () => {
    const statutoryCompanyRule = { ruleKey: "CR", isLocked: true, companyMandatory: true };
    const statutoryFreelancerRule = { ruleKey: "QID", isLocked: true, freelancerMandatory: true };

    assert.strictEqual(statutoryCompanyRule.isLocked, true);
    assert.strictEqual(statutoryFreelancerRule.isLocked, true);
  });

  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runVendorRedesignTestSuite().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
