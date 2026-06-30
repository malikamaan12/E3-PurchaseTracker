import { db } from "@db";
import { purchaseRequests, approvals } from "@db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const reqs = await db.select().from(purchaseRequests).where(eq(purchaseRequests.status, "approved"));
  for (const r of reqs) {
    const apps = await db.select().from(approvals).where(eq(approvals.requestId, r.id));
    const pendingApps = apps.filter(a => a.status === "pending");
    if (pendingApps.length > 0) {
      console.log(`Request ${r.id} is APPROVED but has pending approvals:`, pendingApps.map(a => a.department));
    }
  }
  console.log("Done");
  process.exit(0);
}
main().catch(console.error);
