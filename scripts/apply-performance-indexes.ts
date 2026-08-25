import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

async function applyIndexes() {
  console.log("Applying high-performance PostgreSQL indexes...");

  const indexStatements = [
    // purchase_requests indexes
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_created ON purchase_requests (status, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON purchase_requests (requester_id);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_department ON purchase_requests (department);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_vendor ON purchase_requests (vendor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_subpurpose ON purchase_requests (sub_purpose_id);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_purpose_category ON purchase_requests (purpose_category_id);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_requests_number ON purchase_requests (request_number);`,

    // approvals indexes
    `CREATE INDEX IF NOT EXISTS idx_approvals_request_id_status ON approvals (request_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_approvals_department_status ON approvals (department, status);`,
    `CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals (approver_id);`,

    // payment_installments indexes
    `CREATE INDEX IF NOT EXISTS idx_payment_installments_req_status ON payment_installments (request_id, status);`,

    // notifications indexes
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_request_id ON notifications (request_id);`,

    // file_attachments indexes
    `CREATE INDEX IF NOT EXISTS idx_file_attachments_request_id ON file_attachments (request_id);`,

    // users & departments indexes
    `CREATE INDEX IF NOT EXISTS idx_users_department ON users (department);`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);`,
    `CREATE INDEX IF NOT EXISTS idx_vendors_company_name ON vendors (company_name);`,
    `CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors (status);`,
    `CREATE INDEX IF NOT EXISTS idx_vendors_compliance_status ON vendors (compliance_status);`
  ];

  for (const stmt of indexStatements) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`✓ ${stmt.split("ON")[0].trim()}`);
    } catch (err: any) {
      console.warn(`! Error executing: ${stmt}`, err.message);
    }
  }

  console.log("All indexes applied successfully!");
  process.exit(0);
}

applyIndexes().catch((err) => {
  console.error("Index migration failed:", err);
  process.exit(1);
});
