
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_grDGf8biOC3m@ep-old-pond-amv5ogye-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
pool.query('SELECT email, role, department FROM users').then(res => {
  console.log(res.rows);
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});

