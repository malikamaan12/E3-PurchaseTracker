import { db } from "../db/index";
import { vendors, vendorDocuments, vendorRulesetVersions, vendorRuleDefinitions } from "../db/schema";
import { eq, sql } from "drizzle-orm";

interface DryRunReport {
  timestamp: string;
  totalVendors: number;
  byEntityType: {
    company: number;
    freelancer: number;
    other: number;
  };
  byComplianceStatus: Record<string, number>;
  withVerifiedCr: number;
  withVerifiedQid: number;
  withBankDetails: number;
  missingBankDetails: number;
  requiresReviewCount: number;
  publishedRulesetVersion: number | null;
  actionsPlan: string[];
}

export async function runVendorMigrationDryRun(): Promise<DryRunReport> {
  console.log("================================================================================");
  console.log("VENDOR MANAGEMENT REDESIGN — PRE-FLIGHT MIGRATION DRY-RUN INSPECTION REPORT");
  console.log("================================================================================\n");

  const allVendors = await db.select().from(vendors);
  const allDocs = await db.select().from(vendorDocuments);
  const publishedRuleset = await db
    .select()
    .from(vendorRulesetVersions)
    .where(eq(vendorRulesetVersions.status, "published"))
    .limit(1);

  const report: DryRunReport = {
    timestamp: new Date().toISOString(),
    totalVendors: allVendors.length,
    byEntityType: { company: 0, freelancer: 0, other: 0 },
    byComplianceStatus: {},
    withVerifiedCr: 0,
    withVerifiedQid: 0,
    withBankDetails: 0,
    missingBankDetails: 0,
    requiresReviewCount: 0,
    publishedRulesetVersion: publishedRuleset.length > 0 ? publishedRuleset[0].versionNumber : null,
    actionsPlan: [],
  };

  const crDocs = new Set(
    allDocs
      .filter((d) => (d.documentType === "CR" || d.documentType === "Commercial Registration") && d.reviewStatus === "approved" && d.vendorId)
      .map((d) => d.vendorId)
  );

  const qidDocs = new Set(
    allDocs
      .filter((d) => (d.documentType === "QID" || d.documentType === "Qatar ID") && d.reviewStatus === "approved" && d.vendorId)
      .map((d) => d.vendorId)
  );

  for (const v of allVendors) {
    // Entity type breakdown
    if (v.vendorType === "company") report.byEntityType.company++;
    else if (v.vendorType === "freelancer") report.byEntityType.freelancer++;
    else report.byEntityType.other++;

    // Compliance status breakdown
    const status = v.complianceStatus || "unassessed";
    report.byComplianceStatus[status] = (report.byComplianceStatus[status] || 0) + 1;

    // Banking completeness
    if (v.bankName && v.accountNumber && v.ibanNumber) {
      report.withBankDetails++;
    } else {
      report.missingBankDetails++;
    }

    // Document evidence
    if (crDocs.has(v.id)) report.withVerifiedCr++;
    if (qidDocs.has(v.id)) report.withVerifiedQid++;

    // Flag uncertain records
    if (!v.vendorType || (v.vendorType !== "company" && v.vendorType !== "freelancer")) {
      report.requiresReviewCount++;
    }
  }

  report.actionsPlan = [
    `1. Target ${report.totalVendors} total existing vendor records for non-destructive schema backfill.`,
    `2. Default ${report.byEntityType.company} company vendors to engagement_type = 'permanent'.`,
    `3. Flag ${report.requiresReviewCount} unclassified records with requires_classification_review = true.`,
    `4. Link ${allDocs.length} historical vendor documents into new vendor_requirement_submissions structure.`,
    `5. Retain existing verified banking for ${report.withBankDetails} vendors with banking_verification_status = 'verified'.`,
    `6. Keep all legacy vendors in compliance_status = 'legacy_pending_assessment' until Super Admin sets bulk deadline.`,
  ];

  console.log(`Report Generated At: ${report.timestamp}`);
  console.log(`Total Master Vendors Found: ${report.totalVendors}`);
  console.log(`  - Companies: ${report.byEntityType.company}`);
  console.log(`  - Freelancers: ${report.byEntityType.freelancer}`);
  console.log(`  - Other / Unclassified: ${report.byEntityType.other}`);
  console.log(`\nDocument & Financial Coverage:`);
  console.log(`  - Vendors with Approved CR: ${report.withVerifiedCr}`);
  console.log(`  - Vendors with Approved QID: ${report.withVerifiedQid}`);
  console.log(`  - Complete Bank Details: ${report.withBankDetails}`);
  console.log(`  - Incomplete Bank Details: ${report.missingBankDetails}`);
  console.log(`\nActive Published Ruleset Version: ${report.publishedRulesetVersion ?? "None (Will seed v1)"}`);
  console.log(`\nExecution Plan:`);
  report.actionsPlan.forEach((step) => console.log(`  ${step}`));
  console.log("================================================================================\n");

  return report;
}

runVendorMigrationDryRun()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Dry run failed:", err);
    process.exit(1);
  });
