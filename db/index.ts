import { drizzle } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Postgres with connection pooling and better error handling
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Max idle time for connections
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Disable prepared statements for better compatibility
});

// Initialize Drizzle with the connection and schema
export const db = drizzle(queryClient, { schema });

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    const result = await queryClient`SELECT 1 AS test`;
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
    const result = await queryClient`SELECT current_timestamp AS server_time`;
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

// Explicitly handle cleanup on process exit
process.on('exit', () => {
  queryClient.end().catch(console.error);
});