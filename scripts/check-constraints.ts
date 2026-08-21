import { db } from "../db/index";
import { sql } from "drizzle-orm";

async function checkConstraints() {
  const res = await db.execute(
    sql`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'vendor_upload_intents'::regclass;`
  );
  console.log("Constraints on vendor_upload_intents:", res.rows);
}

checkConstraints()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
