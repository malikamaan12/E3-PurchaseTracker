import { db } from "../db";
import { 
  purchaseRequests, 
  users, 
  vendors, 
  departments, 
  subPurposes, 
  purposeCategories, 
  paymentInstallments, 
  approvals, 
  notifications, 
  auditLogs, 
  fileAttachments, 
  vendorDocuments 
} from "../db/schema";
import { count, eq, sql } from "drizzle-orm";

/**
 * Immutable Baseline Definition (Original 2-Request Production Snapshot)
 */
export interface DatabaseSnapshot {
  counts: {
    purchaseRequests: number;
    paymentInstallments: number;
    approvals: number;
    notifications: number;
    auditLogs: number;
    users: number;
    vendors: number;
    departments: number;
    subPurposes: number;
    purposeCategories: number;
    fileAttachments: number;
    vendorDocuments: number;
  };
  knownRequestIds: number[];
  knownInstallmentIds: number[];
  knownApprovalIds: number[];
}

export const ORIGINAL_PROD_BASELINE: DatabaseSnapshot = {
  counts: {
    purchaseRequests: 2,
    paymentInstallments: 3,
    approvals: 6,
    notifications: 18,
    auditLogs: 36,
    users: 23,
    vendors: 12,
    departments: 13,
    subPurposes: 16,
    purposeCategories: 4,
    fileAttachments: 21,
    vendorDocuments: 10
  },
  knownRequestIds: [68, 69],
  knownInstallmentIds: [88, 93, 94],
  knownApprovalIds: [70, 71, 72, 73, 74, 75]
};

/**
 * Capture current live database snapshot (Strictly Read-Only)
 */
export async function captureLiveSnapshot(): Promise<{
  snapshot: DatabaseSnapshot;
  liveRequests: Array<{ id: number; requestNumber: string; title: string; status: string; totalEstimatedCost: string }>;
  liveInstallments: Array<{ id: number; requestId: number | null; calculatedAmount: string; status: string }>;
  liveApprovals: Array<{ id: number; requestId: number | null; status: string }>;
}> {
  const [prCount] = await db.select({ val: count() }).from(purchaseRequests);
  const [uCount] = await db.select({ val: count() }).from(users);
  const [vCount] = await db.select({ val: count() }).from(vendors);
  const [dCount] = await db.select({ val: count() }).from(departments);
  const [spCount] = await db.select({ val: count() }).from(subPurposes);
  const [pcCount] = await db.select({ val: count() }).from(purposeCategories);
  const [piCount] = await db.select({ val: count() }).from(paymentInstallments);
  const [appCount] = await db.select({ val: count() }).from(approvals);
  const [notifCount] = await db.select({ val: count() }).from(notifications);
  const [auditCount] = await db.select({ val: count() }).from(auditLogs);
  const [attCount] = await db.select({ val: count() }).from(fileAttachments);
  const [docCount] = await db.select({ val: count() }).from(vendorDocuments);

  const reqs = await db.select({
    id: purchaseRequests.id,
    requestNumber: purchaseRequests.requestNumber,
    title: purchaseRequests.title,
    status: purchaseRequests.status,
    totalEstimatedCost: purchaseRequests.totalEstimatedCost
  }).from(purchaseRequests).orderBy(purchaseRequests.id);

  const insts = await db.select({
    id: paymentInstallments.id,
    requestId: paymentInstallments.requestId,
    calculatedAmount: paymentInstallments.calculatedAmount,
    status: paymentInstallments.status
  }).from(paymentInstallments).orderBy(paymentInstallments.id);

  const apprs = await db.select({
    id: approvals.id,
    requestId: approvals.requestId,
    status: approvals.status
  }).from(approvals).orderBy(approvals.id);

  return {
    snapshot: {
      counts: {
        purchaseRequests: Number(prCount.val),
        paymentInstallments: Number(piCount.val),
        approvals: Number(appCount.val),
        notifications: Number(notifCount.val),
        auditLogs: Number(auditCount.val),
        users: Number(uCount.val),
        vendors: Number(vCount.val),
        departments: Number(dCount.val),
        subPurposes: Number(spCount.val),
        purposeCategories: Number(pcCount.val),
        fileAttachments: Number(attCount.val),
        vendorDocuments: Number(docCount.val)
      },
      knownRequestIds: reqs.map(r => r.id),
      knownInstallmentIds: insts.map(i => i.id),
      knownApprovalIds: apprs.map(a => a.id)
    },
    liveRequests: reqs,
    liveInstallments: insts,
    liveApprovals: apprs
  };
}

/**
 * Compare live snapshot against an explicit baseline
 */
export function compareSnapshots(
  live: DatabaseSnapshot, 
  baseline: DatabaseSnapshot
): {
  isIdentical: boolean;
  addedRequests: number[];
  removedRequests: number[];
  addedInstallments: number[];
  removedInstallments: number[];
  addedApprovals: number[];
  removedApprovals: number[];
  countDeltas: Record<string, { baseline: number; live: number; delta: number }>;
} {
  const addedRequests = live.knownRequestIds.filter(id => !baseline.knownRequestIds.includes(id));
  const removedRequests = baseline.knownRequestIds.filter(id => !live.knownRequestIds.includes(id));

  const addedInstallments = live.knownInstallmentIds.filter(id => !baseline.knownInstallmentIds.includes(id));
  const removedInstallments = baseline.knownInstallmentIds.filter(id => !live.knownInstallmentIds.includes(id));

  const addedApprovals = live.knownApprovalIds.filter(id => !baseline.knownApprovalIds.includes(id));
  const removedApprovals = baseline.knownApprovalIds.filter(id => !live.knownApprovalIds.includes(id));

  const countDeltas: Record<string, { baseline: number; live: number; delta: number }> = {};
  let isIdentical = true;

  for (const key of Object.keys(baseline.counts) as Array<keyof typeof baseline.counts>) {
    const baseVal = baseline.counts[key];
    const liveVal = live.counts[key];
    const delta = liveVal - baseVal;
    countDeltas[key] = { baseline: baseVal, live: liveVal, delta };
    if (delta !== 0) {
      isIdentical = false;
    }
  }

  return {
    isIdentical,
    addedRequests,
    removedRequests,
    addedInstallments,
    removedInstallments,
    addedApprovals,
    removedApprovals,
    countDeltas
  };
}

async function runIntegrityAudit() {
  console.log("=================================================");
  console.log(" READ-ONLY SNAPSHOT AUDIT & DRIFT RECONCILIATION ");
  console.log("=================================================\n");

  const { snapshot: liveSnapshot, liveRequests } = await captureLiveSnapshot();

  console.log("Live Database Record Counts:");
  for (const [table, count] of Object.entries(liveSnapshot.counts)) {
    console.log(`- ${table.padEnd(20)}: ${count}`);
  }

  console.log("\n--- Comparison Against Original 2-Request Production Baseline ---");
  const diff = compareSnapshots(liveSnapshot, ORIGINAL_PROD_BASELINE);

  if (diff.isIdentical) {
    console.log("✅ Live database matches original 2-request baseline exactly.");
  } else {
    console.log("⚠️  RECORD DRIFT DETECTED AGAINST ORIGINAL BASELINE:");
    for (const [table, deltaInfo] of Object.entries(diff.countDeltas)) {
      if (deltaInfo.delta !== 0) {
        console.log(`   * ${table}: Baseline=${deltaInfo.baseline}, Live=${deltaInfo.live} (Delta: ${deltaInfo.delta > 0 ? '+' : ''}${deltaInfo.delta})`);
      }
    }

    if (diff.addedRequests.length > 0) {
      console.log(`\n   Added Request IDs:      [${diff.addedRequests.join(", ")}]`);
    }
    if (diff.addedInstallments.length > 0) {
      console.log(`   Added Installment IDs:  [${diff.addedInstallments.join(", ")}]`);
    }
    if (diff.addedApprovals.length > 0) {
      console.log(`   Added Approval IDs:     [${diff.addedApprovals.join(", ")}]`);
    }
  }

  // Verify Baseline Requests 68 & 69 integrity
  console.log("\n--- Verification of Baseline Requests (PR 68 & PR 69) ---");
  const r69 = liveRequests.find(r => r.id === 69);
  const r68 = liveRequests.find(r => r.id === 68);

  const baselineIntact = 
    r69?.requestNumber === "BACKTOSC-MKT-20260816-0002" &&
    Number(r69?.totalEstimatedCost) === 7250 &&
    r69?.status === "partially_approved" &&
    r68?.requestNumber === "URBANARE-MKT-20260812-0035" &&
    Number(r68?.totalEstimatedCost) === 2000 &&
    r68?.status === "partially_approved";

  if (baselineIntact) {
    console.log("✅ Baseline Requests PR 68 & PR 69 remain 100% genuine and unaltered.");
  } else {
    console.error("❌ Baseline Requests PR 68 or PR 69 have been mutated!");
  }

  console.log("\n=================================================");
  console.log("Audit complete. Strictly read-only; zero database records modified.");
}

runIntegrityAudit().catch(err => {
  console.error("Integrity audit failed:", err);
  process.exit(1);
});
