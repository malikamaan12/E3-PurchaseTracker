import { db } from "../db/index";
import { auditLogs } from "../db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, 58));
  logs.forEach(l => {
    console.log(`[${l.timestamp}] Action: ${l.action}, User: ${l.userId}, Details: ${JSON.stringify(l.details)}`);
  });
  process.exit(0);
}
run();
