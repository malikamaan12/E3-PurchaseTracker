import { db } from "../db/index";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runRawDatabaseAudit() {
  console.log("=== RAW ENVIRONMENT & DATABASE AUDIT ===");

  // 1. Filesystem .env inspection
  const envFiles = [".env.local", ".env", ".env.preview.local", ".env.production", ".env.staging"];
  const parsedEnv: Record<string, string> = {};

  for (const f of envFiles) {
    const fullPath = path.resolve(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("DATABASE_URL=")) {
          const rawUrl = trimmed.slice("DATABASE_URL=".length).replace(/["']/g, "").trim();
          try {
            const u = new URL(rawUrl);
            parsedEnv[f] = `host: ${u.hostname}, db: ${u.pathname.replace(/^\//, "")}, user: ${u.username.slice(0, 3)}***`;
          } catch {
            parsedEnv[f] = "invalid URL";
          }
        }
      }
    } else {
      parsedEnv[f] = "FILE_NOT_PRESENT";
    }
  }

  console.log("\n[1] Environment Files in Workspace:");
  console.log(JSON.stringify(parsedEnv, null, 2));

  // 2. Connected Database metadata
  const connMeta = await db.execute(sql`
    SELECT 
      current_database() as database_name,
      current_user as database_user,
      version() as postgres_version,
      inet_server_addr() as server_ip
  `);

  console.log("\n[2] Connected PostgreSQL Session Metadata:");
  console.log(connMeta.rows[0]);

  // 3. Exact row counts and maximum IDs in connected database
  const queries = [
    { table: "vendors", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM vendors` },
    { table: "purchase_requests", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM purchase_requests` },
    { table: "vendor_banking_submissions", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM vendor_banking_submissions` },
    { table: "vendor_onboarding_tokens", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM vendor_onboarding_tokens` },
    { table: "vendor_assigned_requirements", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM vendor_assigned_requirements` },
    { table: "purchase_request_compliance_snapshots", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM purchase_request_compliance_snapshots` },
    { table: "vendor_ruleset_versions", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM vendor_ruleset_versions` },
    { table: "active_vendor_ruleset", sql: sql`SELECT count(*)::int as count, max(id)::int as max_id FROM active_vendor_ruleset` },
  ];

  const tableStats: Record<string, { count: number; max_id: number | null }> = {};
  for (const q of queries) {
    try {
      const res = await db.execute(q.sql);
      tableStats[q.table] = res.rows[0] as any;
    } catch (err: any) {
      tableStats[q.table] = { count: -1, max_id: null };
    }
  }

  console.log("\n[3] Connected Database Counts and Maximum IDs:");
  console.log(JSON.stringify(tableStats, null, 2));

  // 4. Breakdown of vendors by status / remarks
  const vendorBreakdown = await db.execute(sql`
    SELECT 
      compliance_status,
      status,
      count(*)::int as count,
      min(id)::int as min_id,
      max(id)::int as max_id
    FROM vendors
    GROUP BY compliance_status, status
    ORDER BY min_id
  `);

  console.log("\n[4] Vendor Breakdown by Compliance Status and Lifecycle Status:");
  console.log(vendorBreakdown.rows);

  // 5. Check migration records / drizzle migrations table
  let drizzleMigrations: any[] = [];
  try {
    const migRes = await db.execute(sql`
      SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC
    `);
    drizzleMigrations = migRes.rows;
  } catch {
    drizzleMigrations = [{ error: "__drizzle_migrations table not found" }];
  }

  console.log("\n[5] Drizzle Migrations Table:");
  console.log(drizzleMigrations);
}

runRawDatabaseAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Audit error:", err);
    process.exit(1);
  });
