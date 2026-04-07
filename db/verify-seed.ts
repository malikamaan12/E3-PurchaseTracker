import { neon } from '@neondatabase/serverless';

/**
 * Final verification of seeded data counts phase 6.0
 */
async function verify() {
  const sql = neon(process.env.DATABASE_URL!);
  
  const depts = await sql`SELECT count(*) FROM departments`;
  const users = await sql`SELECT count(*) FROM users`;
  const requests = await sql`SELECT count(*) FROM purchase_requests`;
  const installments = await sql`SELECT count(*) FROM payment_installments`;

  console.log('--- Seeding Verification ---');
  console.log(`Departments: ${depts[0].count}`);
  console.log(`Users:       ${users[0].count}`);
  console.log(`Requests:    ${requests[0].count}`);
  console.log(`Installments: ${installments[0].count}`);
}

verify().catch(console.error);
