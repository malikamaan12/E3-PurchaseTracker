import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function check() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }
  
  const sqlClient = neon(url);
  const db = drizzle(sqlClient);

  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log("Columns:", JSON.stringify(result.rows, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

check();
