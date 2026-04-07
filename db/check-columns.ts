import { neon } from '@neondatabase/serverless';

/**
 * Investigates the real columns of the payment_installments table to fix seeding errors phase 6.0
 */
async function check() {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payment_installments';
  `;
  console.log('Columns for payment_installments:', JSON.stringify(result, null, 2));
}

check().catch(console.error);
