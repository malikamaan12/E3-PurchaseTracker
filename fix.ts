import { db } from "./db";
import { sql } from "drizzle-orm";

async function fixSchema() {
  console.log("Adding 'can_manage_vendors' column...");
  try {
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS can_manage_vendors BOOLEAN NOT NULL DEFAULT false
    `);
    console.log("Success: Column added.");
    
    // Verify
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'can_manage_vendors'
    `);
    console.log("Verification:", JSON.stringify(result.rows, null, 2));
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
}

fixSchema();
