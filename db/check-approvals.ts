import { neon } from '@neondatabase/serverless';

async function check() {
  const sql = neon(process.env.DATABASE_URL!);
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'approvals';
  `;
  console.log('\nApprovals Table Structure:');
  columns.forEach(c => {
    console.log(` - ${c.column_name} (${c.data_type}) ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
  });
}

check().catch(console.error);
