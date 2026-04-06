import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Starting mandatory Phase 6 schema migration...");
  try {
    // 1. Create Purpose Categories Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS purpose_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ purpose_categories created/verified");

    // 2. Create Sub-Purposes Table (Upgraded)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sub_purposes (
        id SERIAL PRIMARY KEY,
        purpose_category_id INTEGER REFERENCES purpose_categories(id),
        name TEXT NOT NULL,
        purpose_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        total_budget INTEGER NOT NULL DEFAULT 0,
        is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ sub_purposes created/verified");

    // 3. Create Sub-Purpose Budgets Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sub_purpose_budgets (
        id SERIAL PRIMARY KEY,
        sub_purpose_id INTEGER NOT NULL REFERENCES sub_purposes(id),
        department_id INTEGER NOT NULL REFERENCES departments(id),
        allocated_amount INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ sub_purpose_budgets created/verified");

    console.log("Migration complete. All governance structures are synchronized.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
}

migrate();
