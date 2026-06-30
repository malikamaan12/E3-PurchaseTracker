import { db } from "../db/index";
import { purchaseRequests, approvals } from "../db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const updatedApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, 58));

  const mandatoryApprovals = updatedApprovals.filter(a => a.isMandatory);
  const additionalApprovals = updatedApprovals.filter(a => !a.isMandatory);

  const allMandatoryApproved = mandatoryApprovals.every(a => a.status === 'approved');
  const allAdditionalApproved = additionalApprovals.every(a => a.status === 'approved');

  console.log(`Mandatory count: ${mandatoryApprovals.length}`);
  mandatoryApprovals.forEach(a => {
    console.log(`  Mandatory Dept: ${a.department}, Status: ${a.status}`);
  });

  console.log(`Additional count: ${additionalApprovals.length}`);
  console.log(`allMandatoryApproved: ${allMandatoryApproved}, allAdditionalApproved: ${allAdditionalApproved}`);

  let nextRequestStatus = "pending";
  if (allMandatoryApproved && allAdditionalApproved) {
    nextRequestStatus = "approved";
  } else {
    nextRequestStatus = "partially_approved";
  }
  console.log(`Computed nextRequestStatus: ${nextRequestStatus}`);

  process.exit(0);
}
run();
