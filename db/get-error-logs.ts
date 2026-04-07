import { neon } from '@neondatabase/serverless';

/**
 * Diagnostic tool to fetch the latest application errors phase 7.0
 */
async function check() {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql`SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 5`;
  console.log('Latest Errors:', JSON.stringify(result, null, 2));
}

check().catch(console.error);
