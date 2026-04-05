import { db } from "./db/index.js";
import { sql } from "drizzle-orm";

async function createTable() {
  try {
    console.log("Checking if departments table exists...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL UNIQUE,
        "is_approver" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Successfully created or verified 'departments' table.");
  } catch (error) {
    console.error("Failed to create table:", error);
  } finally {
    process.exit(0);
  }
}

createTable();
