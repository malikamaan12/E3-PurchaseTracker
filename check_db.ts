import { db } from "./db";
import { sql } from "drizzle-orm";

async function checkColumns() {
  try {
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log("Columns in 'users' table:", result.rows.map(r => (r as any).column_name));
  } catch (error) {
    console.error("Error checking columns:", error);
  } finally {
    process.exit();
  }
}

checkColumns();
