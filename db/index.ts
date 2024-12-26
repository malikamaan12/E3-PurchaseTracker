import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize the Neon SQL connection with WebSocket support
const sql = neon(process.env.DATABASE_URL, { 
  webSocketConstructor: ws 
});

// Initialize Drizzle with the SQL connection
export const db = drizzle(sql, { schema });

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 AS test`;
    console.log('Database connection test successful:', result);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 AS health_check`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}