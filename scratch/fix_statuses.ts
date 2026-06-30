import { db } from "../db/index";
import { purchaseRequests, approvals } from "../db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const reqs = await db.select().from(purchaseRequests);
  let fixedCount = 0;

  for (const request of reqs) {
    if (request.status === 'draft' || request.status === 'rejected' || request.status === 'changes_requested') {
      continue;
    }

    const updatedApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, request.id));

    if (updatedApprovals.length === 0) continue;

    const mandatoryApprovals = updatedApprovals.filter(a => a.isMandatory);
    const additionalApprovals = updatedApprovals.filter(a => !a.isMandatory);

    const allMandatoryApproved = mandatoryApprovals.every(a => a.status === 'approved');
    const allAdditionalApproved = additionalApprovals.every(a => a.status === 'approved');

    let correctStatus = "pending";
    if (allMandatoryApproved && allAdditionalApproved) {
      correctStatus = "approved";
    } else {
      const anyApproved = updatedApprovals.some(a => a.status === 'approved');
      correctStatus = anyApproved ? "partially_approved" : "pending";
    }

    // Special case for variation pending
    if (request.status === 'VARIATION_PENDING') {
      correctStatus = 'VARIATION_PENDING';
    }

    if (request.status !== correctStatus && request.status !== 'VARIATION_PENDING') {
      console.log(`Fixing Request ID: ${request.id}. Old: ${request.status}, New: ${correctStatus}`);
      await db.update(purchaseRequests).set({ status: correctStatus as any }).where(eq(purchaseRequests.id, request.id));
      fixedCount++;
    }
  }

  console.log(`Fixed ${fixedCount} requests.`);
  process.exit(0);
}
run();
