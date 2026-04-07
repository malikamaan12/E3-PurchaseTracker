import { neon } from '@neondatabase/serverless';

async function dump() {
  const sql = neon(process.env.DATABASE_URL!);
  const tables = ['purchase_requests', 'approvals', 'audit_logs', 'notifications', 'error_logs'];
  
  console.log('--- Database Schema Dump ---');
  for (const table of tables) {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = ${table};
    `;
    console.log(`\nTable: ${table}`);
    columns.forEach(c => {
      console.log(` - ${c.column_name} (${c.data_type}) ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  }
}

dump().catch(console.error);
