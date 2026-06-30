import { db } from "../db/index";
import { approvalAuditLogs } from "../db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const logs = await db.select().from(approvalAuditLogs).where(eq(approvalAuditLogs.requestId, 58));
  logs.forEach(l => {
    console.log(`[${l.createdAt}] Approver: ${l.approverId}, Dept: ${l.department}, Old: ${l.oldStatus}, New: ${l.newStatus}`);
  });
  process.exit(0);
}
run();
