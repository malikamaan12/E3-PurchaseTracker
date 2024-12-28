import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    const result = await db.execute(sql`SELECT 1 as connection_test`);
    // Safely handle potential null result
    return result && typeof result.rowCount === 'number' && result.rowCount > 0;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });
    return false;
  }
}