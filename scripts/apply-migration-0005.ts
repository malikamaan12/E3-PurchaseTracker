import { db } from "../db/index";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

async function applyMigration0005() {
  console.log("Applying migration 0005_vendor_management_redesign_v1_1.sql statement by statement...");
  const sqlPath = path.join(process.cwd(), "db", "migrations", "0005_vendor_management_redesign_v1_1.sql");
  const rawSql = fs.readFileSync(sqlPath, "utf-8");

  // Remove full-line comments and split into separate statements
  const cleanedSql = rawSql
    .split("\n")
    .map((line) => (line.trim().startsWith("--") ? "" : line))
    .join("\n");

  const statements = cleanedSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute.`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await db.execute(sql.raw(stmt));
      console.log(`[${i + 1}/${statements.length}] ✓ Executed statement`);
    } catch (err: any) {
      console.error(`[${i + 1}/${statements.length}] ✗ Error on statement:`, stmt.slice(0, 100));
      console.error("Error details:", err.message);
      throw err;
    }
  }

  console.log("\n================================================================================");
  console.log("✓ ALL MIGRATION 0005 STATEMENTS APPLIED SUCCESSFULLY.");
  console.log("================================================================================\n");
}

applyMigration0005()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
