import { db } from "../db";
import { vendors, vendorOnboardingTokens, vendorPortalEvents, vendorAssignedRequirements, purchaseRequests, approvals, paymentInstallments } from "../db/schema";
import { gte, desc, eq } from "drizzle-orm";

async function inventorySyntheticData() {
  console.log("=== COMPREHENSIVE SYNTHETIC DATA INVENTORY ===");

  // 1. Vendors 60+
  const allVendors = await db
    .select()
    .from(vendors)
    .where(gte(vendors.id, 60))
    .orderBy(desc(vendors.id));

  console.log(`\nFound ${allVendors.length} synthetic vendors (ID >= 60):`);
  for (const v of allVendors) {
    const tokens = await db.select().from(vendorOnboardingTokens).where(eq(vendorOnboardingTokens.vendorId, v.id));
    const events = await db.select().from(vendorPortalEvents).where(eq(vendorPortalEvents.vendorId, v.id));
    const reqs = await db.select().from(vendorAssignedRequirements).where(eq(vendorAssignedRequirements.vendorId, v.id));
    const prs = await db.select().from(purchaseRequests).where(eq(purchaseRequests.vendorId, v.id));

    console.log(`\n------------------------------------------------------------`);
    console.log(`VENDOR ID ${v.id}: "${v.companyName}"`);
    console.log(`  - Type/Status: ${v.vendorType} / ${v.status} (Onboarding: ${v.onboardingStatus})`);
    console.log(`  - Compliance: ${v.complianceStatus} (${v.complianceScore}%)`);
    console.log(`  - Created At: ${v.createdAt?.toISOString()}`);
    console.log(`  - Assigned Requirements: ${reqs.length} records`);
    console.log(`  - Onboarding Tokens: ${tokens.length} records (${tokens.map(t => `ID ${t.id} [${t.status}]`).join(", ")})`);
    console.log(`  - Portal Events: ${events.length} records (${events.map(e => `ID ${e.id} [${e.eventType}]`).join(", ")})`);
    console.log(`  - Linked PRs: ${prs.length} records (${prs.map(p => `#${p.id} ${p.requestNumber}`).join(", ")})`);
  }

  // 2. PRs 80+
  const allPrs = await db
    .select()
    .from(purchaseRequests)
    .where(gte(purchaseRequests.id, 80))
    .orderBy(desc(purchaseRequests.id));

  console.log(`\n\n============================================================`);
  console.log(`PURCHASE REQUESTS INVENTORY (ID >= 80, Total: ${allPrs.length}):`);
  for (const pr of allPrs) {
    const apprvs = await db.select().from(approvals).where(eq(approvals.requestId, pr.id));
    const installments = await db.select().from(paymentInstallments).where(eq(paymentInstallments.requestId, pr.id));

    console.log(`\n------------------------------------------------------------`);
    console.log(`PR #${pr.id}: ${pr.requestNumber} - "${pr.title}"`);
    console.log(`  - Requester ID: ${pr.requesterId}, Vendor ID: ${pr.vendorId}`);
    console.log(`  - Department: ${pr.department}, Total: ${pr.totalEstimatedCost} QAR, Status: ${pr.status}`);
    console.log(`  - Created At: ${pr.createdAt?.toISOString()}`);
    console.log(`  - Approvals: ${apprvs.length} records (${apprvs.map(a => `${a.department}:${a.status}`).join(", ")})`);
    console.log(`  - Installments: ${installments.length} records`);
  }

  process.exit(0);
}

inventorySyntheticData().catch(console.error);
