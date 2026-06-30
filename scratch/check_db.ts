import { db } from "../db/index";
import { purchaseRequests, approvals } from "../db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const reqs = await db.select().from(purchaseRequests).where(eq(purchaseRequests.status, "approved"));
  for (const r of reqs) {
    const apps = await db.select().from(approvals).where(eq(approvals.requestId, r.id));
    console.log(`Request ID: ${r.id}, Status: ${r.status}`);
    apps.forEach(a => {
      console.log(`  Approval ID: ${a.id}, Dept: ${a.department}, Status: ${a.status}, isMandatory: ${a.isMandatory}`);
    });
  }
  process.exit(0);
}
run();
