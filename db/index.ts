import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize Neon SQL connection with WebSocket support
const sql = neon(process.env.DATABASE_URL, { 
  webSocketConstructor: ws 
});

// Initialize Drizzle with the SQL connection and schema
export const db = drizzle(sql, { schema });

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT current_timestamp AS server_time`;
    console.log('Database connection test successful:', result);
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return false;
  }
}

// Database health check with improved error handling
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await sql`SELECT current_timestamp AS server_time`;
    console.log('Database health check successful:', result);
    return true;
  } catch (error: any) {
    console.error('Database health check failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return false;
  }
}