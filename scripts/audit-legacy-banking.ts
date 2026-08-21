import { db } from "../db/index";
import { vendors, vendorDocuments } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

async function auditLegacyBanking() {
  console.log("================================================================================");
  console.log("LEGACY VENDOR BANKING DETAILS AUDIT & CLASSIFICATION");
  console.log("================================================================================\n");

  const allVendors = await db.select().from(vendors);
  const allDocs = await db.select().from(vendorDocuments);

  const bankLetterDocs = allDocs.filter(
    (d) =>
      (d.documentType?.toLowerCase().includes("bank") ||
        d.name?.toLowerCase().includes("bank")) &&
      d.status === "approved"
  );
  const vendorApprovedBankLetters = new Set(bankLetterDocs.map((d) => d.vendorId));

  let countVerifiedWithEvidence = 0;
  let countLegacyPendingReview = 0;
  let countMissingBanking = 0;

  const classificationUpdates: Array<{ id: number; name: string; status: string; reason: string }> = [];

  for (const v of allVendors) {
    const hasBankDetails = Boolean(v.bankName && v.ibanNumber && v.accountNumber);
    const hasEvidence = vendorApprovedBankLetters.has(v.id);

    let status = "missing_information";
    let reason = "No bank details provided";

    if (!hasBankDetails) {
      status = "missing_information";
      reason = "Missing bank name, IBAN, or account number";
      countMissingBanking++;
    } else if (hasEvidence) {
      status = "verified";
      reason = "Approved bank letter document on file";
      countVerifiedWithEvidence++;
    } else {
      status = "legacy_pending_review";
      reason = "Legacy bank details populated but lacks formal verification audit record";
      countLegacyPendingReview++;
    }

    classificationUpdates.push({
      id: v.id,
      name: v.companyName,
      status,
      reason,
    });

    // Update vendor record
    await db
      .update(vendors)
      .set({
        bankingVerificationStatus: status,
      })
      .where(eq(vendors.id, v.id));
  }

  console.log("=== VENDOR-BY-VENDOR BANKING CLASSIFICATION ===");
  console.table(classificationUpdates);

  console.log("\n================================================================================");
  console.log("SUMMARY COUNTS:");
  console.log(`  - Verified with Evidence:      ${countVerifiedWithEvidence}`);
  console.log(`  - Pending Legacy Review:       ${countLegacyPendingReview}`);
  console.log(`  - Missing Banking Information: ${countMissingBanking}`);
  console.log(`  - Total Vendors Audited:       ${allVendors.length}`);
  console.log("================================================================================\n");
}

auditLegacyBanking()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Banking audit failed:", err);
    process.exit(1);
  });
