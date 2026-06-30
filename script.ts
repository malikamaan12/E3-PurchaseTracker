
import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_grDGf8biOC3m@ep-old-pond-amv5ogye-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  await sql('UPDATE users SET password = \', ['\\\']);
  console.log('Done');
}
run();

