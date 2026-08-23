import { Client } from "pg";
import { readFileSync } from "fs";

const urls: Record<string, string> = {
  DATABASE_URL:      readFileSync("C:\\Users\\Admin\\.gemini\\tmp_DATABASE_URL.txt", "utf8").trim(),
  PROD_DATABASE_URL: readFileSync("C:\\Users\\Admin\\.gemini\\tmp_PROD_DATABASE_URL.txt", "utf8").trim(),
};

function fingerprint(url: string): string {
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^/?]+)(\/[^?]*)?/);
  if (!m) return "[unparseable]";
  return `host=${m[3]} db=${m[4] ?? "/neondb"}`;
}

async function auditDb(label: string, url: string) {
  console.log("\n" + "=".repeat(70));
  console.log(`DATABASE: ${label}`);
  console.log(`FINGERPRINT: ${fingerprint(url)}`);
  console.log("=".repeat(70));
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    const tables: string[] = tablesRes.rows.map((r: any) => r.table_name as string);
    console.log(`TABLES (${tables.length}): ${tables.join(", ")}`);

    if (tables.includes("purchase_requests")) {
      const pr = await client.query("SELECT COUNT(*) as count, MAX(id) as max_id, MIN(id) as min_id FROM purchase_requests");
      const { count, max_id, min_id } = pr.rows[0];
      console.log(`\npurchase_requests: count=${count}  max_id=${max_id}  min_id=${min_id}`);
      const latest = await client.query("SELECT id, request_number, status, created_at FROM purchase_requests ORDER BY id DESC LIMIT 20");
      console.log("Latest 20 PRs (newest first):");
      latest.rows.forEach((r: any) => console.log(`  id=${r.id}  rn=${r.request_number}  status=${r.status}  created=${r.created_at?.toISOString?.() ?? r.created_at}`));
      const synth = await client.query("SELECT id, request_number, status FROM purchase_requests WHERE id IN (86,87,88) ORDER BY id");
      if (synth.rows.length > 0) {
        console.log("!!! SYNTHETIC id 86/87/88 PRESENT:");
        synth.rows.forEach((r: any) => console.log(`  id=${r.id} rn=${r.request_number} status=${r.status}`));
      } else { console.log("[OK] No records with id 86/87/88"); }
    } else { console.log("purchase_requests: TABLE NOT FOUND"); }

    if (tables.includes("vendors")) {
      const v = await client.query("SELECT COUNT(*) as count, MAX(id) as max_id FROM vendors");
      console.log(`vendors: count=${v.rows[0].count}  max_id=${v.rows[0].max_id}`);
    }
    const at = tables.find((t: string) => t.includes("approval"));
    if (at) { const a = await client.query(`SELECT COUNT(*) as count FROM "${at}"`); console.log(`${at}: count=${a.rows[0].count}`); }
    const it = tables.find((t: string) => t.includes("item"));
    if (it) { const i = await client.query(`SELECT COUNT(*) as count FROM "${it}"`); console.log(`${it}: count=${i.rows[0].count}`); }
    const pt = tables.find((t: string) => t.includes("payment") || t.includes("installment"));
    if (pt) { const p = await client.query(`SELECT COUNT(*) as count FROM "${pt}"`); console.log(`${pt}: count=${p.rows[0].count}`); }
    if (tables.includes("vendor_onboarding_tokens")) {
      const vt = await client.query("SELECT COUNT(*) as count FROM vendor_onboarding_tokens");
      console.log(`vendor_onboarding_tokens: count=${vt.rows[0].count}`);
    }
  } catch (err: any) { console.log(`ERROR: ${err.message}`); }
  finally { await client.end(); }
}

const seen = new Set<string>();
for (const [label, url] of Object.entries(urls)) {
  const fp = fingerprint(url);
  const isDup = seen.has(fp);
  seen.add(fp);
  await auditDb(label + (isDup ? " [SAME ENDPOINT]" : ""), url);
}
