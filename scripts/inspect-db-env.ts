import { db } from "../db/index";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

async function inspectDbEnvironment() {
  const envFiles = [".env.local", ".env", ".env.preview.local"];
  const envInfo: Record<string, string> = {};

  for (const f of envFiles) {
    const p = path.resolve(process.cwd(), f);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("DATABASE_URL=")) {
          const rawUrl = trimmed.slice("DATABASE_URL=".length).replace(/["']/g, "").trim();
          try {
            const parsed = new URL(rawUrl);
            envInfo[f] = `host: ${parsed.hostname}, db: ${parsed.pathname.slice(1)}, user: ${parsed.username.slice(0, 3)}***`;
          } catch {
            envInfo[f] = "invalid url format";
          }
        }
        if (trimmed.startsWith("NODE_ENV=")) {
          envInfo[`${f}_NODE_ENV`] = trimmed.slice("NODE_ENV=".length).trim();
        }
      }
    }
  }

  // Query actual connected database
  const dbResult = await db.execute(sql`
    SELECT current_database() as db_name, current_user as db_user, inet_server_addr() as server_ip, version() as pg_version
  `);

  console.log("=== ENVIRONMENT & DATABASE INSPECTION ===");
  console.log("Environment configuration files found:");
  console.log(JSON.stringify(envInfo, null, 2));
  console.log("Connected DB info (redacted):");
  console.log({
    databaseName: (dbResult.rows[0] as any)?.db_name,
    dbUser: `${String((dbResult.rows[0] as any)?.db_user).slice(0, 3)}***`,
    version: (dbResult.rows[0] as any)?.pg_version,
  });

  // Query table row counts
  const vendorCount = await db.execute(sql`SELECT count(*) FROM vendors`);
  const prCount = await db.execute(sql`SELECT count(*) FROM purchase_requests`);
  const usersCount = await db.execute(sql`SELECT count(*) FROM users`);
  const rulesCount = await db.execute(sql`SELECT count(*) FROM vendor_rule_definitions`);
  const rulesetCount = await db.execute(sql`SELECT count(*) FROM vendor_ruleset_versions`);

  console.log("Current Record Counts in Connected Database:");
  console.log({
    vendors: (vendorCount.rows[0] as any)?.count,
    purchase_requests: (prCount.rows[0] as any)?.count,
    users: (usersCount.rows[0] as any)?.count,
    vendor_rule_definitions: (rulesCount.rows[0] as any)?.count,
    vendor_ruleset_versions: (rulesetCount.rows[0] as any)?.count,
  });
}

inspectDbEnvironment()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Inspection error:", err);
    process.exit(1);
  });
