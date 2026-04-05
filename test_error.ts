import { db } from "./db/index";
import { errorLogs } from "./db/schema";
import { desc } from "drizzle-orm";

async function run() {
  const logs = await db.query.errorLogs.findMany({
    orderBy: [desc(errorLogs.createdAt)],
    limit: 5
  });
  console.log(JSON.stringify(logs, null, 2));
  process.exit();
}

run().catch(console.error);
