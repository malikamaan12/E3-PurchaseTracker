import { neon } from '@neondatabase/serverless';

// Load env manually
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const dbUrl = envFile.split('\n').find((l: string) => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/^["']|["']$/g, '');

async function check() {
  const sql = neon(dbUrl);
  
  // Check actual columns in purchase_requests table
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'purchase_requests'
    ORDER BY ordinal_position
  `;
  console.log('purchase_requests columns:');
  cols.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default}`));

  // Check payment_installments columns
  const piCols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'payment_installments'
    ORDER BY ordinal_position
  `;
  console.log('\npayment_installments columns:');
  piCols.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default}`));
}

check().catch(console.error);
