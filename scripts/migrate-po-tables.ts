import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Creating purchase_orders and purchase_order_events tables if not exist...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE RESTRICT,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
      created_by_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'draft',
      items_snapshot JSONB NOT NULL,
      currency TEXT NOT NULL DEFAULT 'QAR',
      subtotal_amount NUMERIC(12, 2) NOT NULL,
      freight_amount NUMERIC(12, 2) DEFAULT '0',
      tax_amount NUMERIC(12, 2) DEFAULT '0',
      total_amount NUMERIC(12, 2) NOT NULL,
      payment_terms TEXT NOT NULL,
      expected_delivery_date TIMESTAMP,
      delivery_address TEXT NOT NULL,
      billing_address TEXT NOT NULL,
      special_instructions TEXT,
      terms_and_conditions TEXT,
      token_hash TEXT,
      token_expires_at TIMESTAMP,
      token_status TEXT DEFAULT 'active',
      acknowledged_at TIMESTAMP,
      acknowledged_by TEXT,
      acknowledgment_notes TEXT,
      issued_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      cancellation_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_po_request_id ON purchase_orders(request_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON purchase_orders(vendor_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_po_token_hash ON purchase_orders(token_hash)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS purchase_order_events (
      id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id INTEGER REFERENCES users(id),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_po_events_po_id ON purchase_order_events(po_id)`);

  console.log("✓ purchase_orders and purchase_order_events tables created successfully!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
