import { db } from '../db';
import { sql } from 'drizzle-orm';

async function repair() {
  console.log('--- Database Schema Repair ---');
  
  try {
    console.log('Creating system_settings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by INTEGER
      )
    `);
    console.log('✓ system_settings table ready.');

    console.log('Creating pdf_settings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pdf_settings (
        id SERIAL PRIMARY KEY,
        header_title TEXT NOT NULL,
        header_subtitle TEXT,
        header_color TEXT NOT NULL,
        footer_text TEXT,
        footer_color TEXT NOT NULL,
        page_numbering BOOLEAN NOT NULL DEFAULT TRUE,
        page_number_position TEXT DEFAULT 'bottom-right',
        watermark_opacity INTEGER NOT NULL DEFAULT 10,
        watermark_text TEXT DEFAULT 'CONFIDENTIAL',
        margin_top INTEGER NOT NULL DEFAULT 20,
        margin_bottom INTEGER NOT NULL DEFAULT 20,
        margin_left INTEGER NOT NULL DEFAULT 25,
        margin_right INTEGER NOT NULL DEFAULT 25,
        font_size INTEGER NOT NULL DEFAULT 11,
        font_family TEXT DEFAULT 'helvetica',
        header_image TEXT,
        footer_image TEXT,
        logo TEXT,
        logo_position TEXT DEFAULT 'left',
        login_logo TEXT,
        header_height INTEGER NOT NULL DEFAULT 100,
        footer_height INTEGER NOT NULL DEFAULT 50,
        company_address TEXT,
        company_phone TEXT,
        company_email TEXT,
        company_website TEXT,
        show_basic_info BOOLEAN DEFAULT TRUE,
        show_requester_details BOOLEAN DEFAULT TRUE,
        show_date_of_request BOOLEAN DEFAULT TRUE,
        show_purpose_info BOOLEAN DEFAULT TRUE,
        show_vendor_details BOOLEAN DEFAULT TRUE,
        show_items BOOLEAN DEFAULT TRUE,
        show_approvals BOOLEAN DEFAULT TRUE,
        show_attachments BOOLEAN DEFAULT TRUE,
        show_audit_info BOOLEAN DEFAULT FALSE,
        show_signatures BOOLEAN DEFAULT TRUE,
        template_config TEXT,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ pdf_settings table ready.');

    console.log('--- Repair Complete ---');
    process.exit(0);
  } catch (err) {
    console.error('Schema Repair Failed:', err);
    process.exit(1);
  }
}

repair();
