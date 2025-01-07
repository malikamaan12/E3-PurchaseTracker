import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a WebSocket connection for Neon serverless
const wsConnection = {
  connection: process.env.DATABASE_URL,
  ws: ws, // Pass the ws constructor
  ssl: true, // Enable SSL for secure connections
  connectionTimeoutMillis: 5000, // 5 second timeout
  max: 20, // Maximum number of clients in the pool
};

export const db = drizzle({
  ...wsConnection,
  schema,
});

// Test database connection with retry logic
export async function testConnection(retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Simple query to test connection
      const result = await db.execute(sql`SELECT 1 as connection_test`);
      // Safely handle potential null result
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

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
}

// Initialize database connection immediately
testConnection().catch(console.error);