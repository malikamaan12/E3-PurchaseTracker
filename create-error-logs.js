import { db } from './db/index.js';
import { errorLogs } from './db/schema.js';
import { sql } from 'drizzle-orm';

async function createErrorLogsTable() {
  try {
    // Create the error_logs table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        code TEXT,
        severity TEXT NOT NULL,
        path TEXT,
        user_id INTEGER REFERENCES users(id),
        details TEXT,
        ai_analysis TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('error_logs table created or already exists');
  } catch (error) {
    console.error('Error creating error_logs table:', error);
  } finally {
    process.exit(0);
  }
}

createErrorLogsTable();