import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure database connection with proper WebSocket handling
const db = drizzle({
  connectionString: process.env.DATABASE_URL,
  schema,
  driver: {
    ws,
    options: {
      connectionTimeoutMillis: 5000,
      max: 20,
      ssl: true
    }
  }
});

// Test database connection with retry logic
export async function testConnection(retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await db.execute(sql`SELECT 1 as connection_test`);
      if (result && typeof result.rowCount === 'number' && result.rowCount > 0) {
        console.log('Database connection established successfully');
        return true;
      }
      throw new Error('Invalid response from database');
    } catch (error: any) {
      console.error(`Database connection attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        detail: error.detail || error.hint
      });

      if (attempt === retries) {
        console.error('All database connection attempts failed');
        return false;
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 10000)));
    }
  }
  return false;
}

// Initialize database connection immediately
testConnection().catch(console.error);

export { db };