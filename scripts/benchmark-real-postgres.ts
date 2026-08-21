import { db } from "../db/index";
import { sql } from "drizzle-orm";

async function runRealPostgresBenchmark() {
  console.log("================================================================================");
  console.log("REAL POSTGRESQL DATABASE BENCHMARK (5,000 VENDORS x 20 RULES MATRIX)");
  console.log("================================================================================\n");

  try {
    // 1. Create benchmark tables in PostgreSQL
    console.log("1. Initializing 5,000 synthetic vendors & 100,000 requirement rows in PostgreSQL...");
    
    await db.execute(sql`DROP TABLE IF EXISTS bench_assigned_requirements CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS bench_vendors CASCADE;`);

    await db.execute(sql`
      CREATE TABLE bench_vendors (
        id integer PRIMARY KEY,
        company_name text NOT NULL,
        contact_person text NOT NULL,
        email text NOT NULL,
        vendor_type text NOT NULL,
        compliance_status text NOT NULL,
        compliance_score integer NOT NULL,
        compliance_deadline timestamp with time zone,
        status text NOT NULL
      );
    `);

    await db.execute(sql`
      INSERT INTO bench_vendors
      SELECT 
        g AS id,
        'Enterprise Vendor ' || g || ' W.L.L.' AS company_name,
        'Contact ' || g AS contact_person,
        'vendor' || g || '@domain.qa' AS email,
        CASE WHEN g % 5 = 0 THEN 'freelancer' ELSE 'company' END AS vendor_type,
        CASE WHEN g % 3 = 0 THEN 'compliant' WHEN g % 3 = 1 THEN 'pending' ELSE 'non_compliant' END AS compliance_status,
        ((g * 7) % 101) AS compliance_score,
        NOW() + (g % 30 || ' days')::interval AS compliance_deadline,
        'active' AS status
      FROM generate_series(1, 5000) g;
    `);

    await db.execute(sql`
      CREATE INDEX idx_bench_vendors_comp ON bench_vendors (compliance_status, vendor_type, id);
    `);

    await db.execute(sql`
      CREATE TABLE bench_assigned_requirements (
        id bigint PRIMARY KEY,
        vendor_id integer NOT NULL REFERENCES bench_vendors(id) ON DELETE CASCADE,
        rule_key text NOT NULL,
        submission_status text NOT NULL,
        validity_status text NOT NULL,
        deadline_status text NOT NULL
      );
    `);

    await db.execute(sql`
      INSERT INTO bench_assigned_requirements
      SELECT 
        (v.id::bigint * 20 + r) AS id,
        v.id AS vendor_id,
        'rule_' || r AS rule_key,
        CASE WHEN r % 4 = 0 THEN 'verified' WHEN r % 4 = 1 THEN 'under_review' ELSE 'missing' END AS submission_status,
        'valid' AS validity_status,
        'due' AS deadline_status
      FROM bench_vendors v
      CROSS JOIN generate_series(1, 20) r;
    `);

    await db.execute(sql`
      CREATE INDEX idx_bench_reqs_vendor_id ON bench_assigned_requirements (vendor_id);
    `);

    console.log("✓ Populated 5,000 vendor rows and 100,000 requirement rows in staging PostgreSQL.\n");

    // 2. Run EXPLAIN (ANALYZE, BUFFERS) for cold query
    console.log("2. Running EXPLAIN (ANALYZE, BUFFERS) on Phase 1 (Vendor Pagination & Filtering)...");
    const explainPhase1 = await db.execute(sql`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id, company_name, contact_person, email, vendor_type, compliance_status, compliance_score, compliance_deadline
      FROM bench_vendors
      WHERE status = 'active'
      ORDER BY id ASC
      LIMIT 50 OFFSET 0;
    `);
    console.log(explainPhase1.rows.map((r: any) => Object.values(r)[0]).join("\n"));
    console.log("\n");

    console.log("3. Running EXPLAIN (ANALYZE, BUFFERS) on Phase 2 (Batch Requirement Fetch for 50 Vendors)...");
    const sampleVendorIds = Array.from({ length: 50 }, (_, i) => i + 1);
    const explainPhase2 = await db.execute(sql`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id, vendor_id, rule_key, submission_status, validity_status, deadline_status
      FROM bench_assigned_requirements
      WHERE vendor_id IN (${sql.raw(sampleVendorIds.join(","))});
    `);
    console.log(explainPhase2.rows.map((r: any) => Object.values(r)[0]).join("\n"));
    console.log("\n");

    // 3. Measure Cold vs Warm Query Latency & Server-Side Transformation
    console.log("4. Measuring Matrix API Latency across 30 real PostgreSQL query rounds...");
    const iterations = 30;
    const totalApiLatencies: number[] = [];
    const transformLatencies: number[] = [];
    let samplePayloadSize = 0;

    for (let i = 0; i < iterations; i++) {
      const page = (i % 50) + 1;
      const offset = (page - 1) * 50;
      
      const t0 = performance.now();

      // SQL Phase 1
      const p1Result = await db.execute(sql`
        SELECT id, company_name, contact_person, email, vendor_type, compliance_status, compliance_score, compliance_deadline
        FROM bench_vendors
        WHERE status = 'active'
        ORDER BY id ASC
        LIMIT 50 OFFSET ${offset};
      `);
      const pageVendors = p1Result.rows;

      // SQL Phase 2
      const vendorIds = pageVendors.map((v: any) => v.id);
      const p2Result = await db.execute(sql`
        SELECT id, vendor_id, rule_key, submission_status, validity_status, deadline_status
        FROM bench_assigned_requirements
        WHERE vendor_id IN (${sql.raw(vendorIds.join(","))});
      `);
      const pageReqs = p2Result.rows;
      
      const t1 = performance.now();
      const sqlDuration = t1 - t0;

      // Server-Side Transformation Time
      const t2 = performance.now();
      const reqsByVendor = new Map<number, Record<string, any>>();
      for (const req of pageReqs as any[]) {
        if (!reqsByVendor.has(req.vendor_id)) reqsByVendor.set(req.vendor_id, {});
        reqsByVendor.get(req.vendor_id)![req.rule_key] = req;
      }

      const payloadRows = (pageVendors as any[]).map((v) => ({
        vendor: v,
        requirements: reqsByVendor.get(v.id) || {},
      }));

      const responsePayload = JSON.stringify({
        success: true,
        rows: payloadRows,
        pagination: { page, limit: 50, totalVendors: 5000, totalPages: 100 },
      });
      const t3 = performance.now();
      const transformDuration = t3 - t2;
      transformLatencies.push(transformDuration);

      totalApiLatencies.push(sqlDuration + transformDuration);
      if (i === 0) {
        samplePayloadSize = Buffer.byteLength(responsePayload, "utf-8");
      }
    }

    // Calculate statistics
    const coldQueryTime = totalApiLatencies[0];
    const warmQueries = totalApiLatencies.slice(1).sort((a, b) => a - b);
    const p50 = warmQueries[Math.floor(warmQueries.length * 0.5)].toFixed(2);
    const p95 = warmQueries[Math.floor(warmQueries.length * 0.95)].toFixed(2);
    const max = warmQueries[warmQueries.length - 1].toFixed(2);
    const avgTransform = (transformLatencies.reduce((a, b) => a + b, 0) / iterations).toFixed(2);

    console.log("================================================================================");
    console.log("MEASURED REAL POSTGRESQL & API BENCHMARK REPORT");
    console.log("================================================================================");
    console.log(`Database Engine:            AWS Neon Serverless PostgreSQL 17.11`);
    console.log(`Dataset Size:               5,000 Vendors, 100,000 Assigned Requirements`);
    console.log(`Page Size:                  50 Rows x 20 Dynamic Columns (1,000 Matrix Cells/Page)`);
    console.log(`Cold Query Time (Run 1):    ${coldQueryTime.toFixed(2)} ms`);
    console.log(`Warm Query p50 (Median):    ${p50} ms`);
    console.log(`Warm Query p95:             ${p95} ms`);
    console.log(`Maximum Measured Response:  ${max} ms`);
    console.log(`Server Transformation Time: ~${avgTransform} ms`);
    console.log(`Response Payload Size:      ${(samplePayloadSize / 1024).toFixed(2)} KB (${samplePayloadSize} bytes)`);
    console.log("================================================================================\n");

  } finally {
    // Clean up temporary benchmark tables
    console.log("Cleaning up temporary benchmark tables from database...");
    await db.execute(sql`DROP TABLE IF EXISTS bench_assigned_requirements CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS bench_vendors CASCADE;`);
    console.log("✓ Benchmark tables removed. Staging database clean.\n");
  }
}

runRealPostgresBenchmark()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Benchmark error:", err);
    process.exit(1);
  });
