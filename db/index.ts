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

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    console.log('Testing database connection...');
    console.log('Using connection URL pattern:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

    // Try to execute a simple query
    const result = await db.execute<{ server_time: Date }>(sql`SELECT current_timestamp AS server_time`);
    console.log('Database connection test successful:', result[0]?.server_time);

    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });

    // Enhanced error reporting for specific issues
    if (error.code === '28P01') {
      console.error('Authentication failed. Please check your database credentials.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Please check your database host configuration.');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Please check your database name.');
    }

    return false;
  }
}