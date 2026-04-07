import { neon } from '@neondatabase/serverless';

/**
 * Diagnostic tool to check audit_logs columns phase 8.0
 */
async function check() {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'audit_logs';
  `;
  console.log('Columns for audit_logs:', JSON.stringify(result, null, 2));
}

check().catch(console.error);
