import { db } from "./db";
import { sql } from "drizzle-orm";

async function check() {
  try {
    const res = await db.execute(sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'purpose_categories')`);
    console.log("purpose_categories exists:", res[0]);
    
    const res2 = await db.execute(sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sub_purposes')`);
    console.log("sub_purposes exists:", res2[0]);
  } catch (e) {
    console.error("Diagnostic failed:", e);
  }
}

check();
