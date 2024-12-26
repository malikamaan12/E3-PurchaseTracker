import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Please check your database connection settings.",
  );
}

export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT current_timestamp AS server_time`);
    console.log('Database connection test successful:', result);
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });

    // Additional logging for connection debugging
    if (error.code === '28P01') {
      console.error('Authentication failed. Please check your database credentials.');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Please check your database name.');
    }

    return false;
  }
}

// Database health check with improved error handling
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT current_timestamp AS server_time`);
    console.log('Database health check successful:', result);
    return true;
  } catch (error: any) {
    console.error('Database health check failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });
    return false;
  }
}