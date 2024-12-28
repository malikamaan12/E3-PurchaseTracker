import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize the postgres client with proper connection pooling
const client = postgres(process.env.DATABASE_URL, {
  max: 10, // Maximum pool size
  min: 2,  // Minimum pool size 
  idle_timeout: 20,
  max_lifetime: 60 * 30, // Connection lifetime of 30 minutes
  ssl: { rejectUnauthorized: false },
});

// Create a single drizzle instance
export const db = drizzle(client, { schema });

let connectionTestInProgress = false;
let lastConnectionTest = 0;
const CONNECTION_TEST_INTERVAL = 30000; // 30 seconds

// Test database connection with caching and rate limiting
export async function testConnection(): Promise<boolean> {
  const now = Date.now();

  // Return cached result if recent
  if (now - lastConnectionTest < CONNECTION_TEST_INTERVAL) {
    return true;
  }

  // Prevent multiple simultaneous tests
  if (connectionTestInProgress) {
    return true;
  }

  try {
    connectionTestInProgress = true;
    const result = await client`SELECT 1 as connection_test`;
    lastConnectionTest = now;
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint // Preserving detail from original
    });
    // Enhanced error reporting for specific issues (from original)
    if (error.code === '28P01') {
      console.error('Authentication failed. Please check your database credentials.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Please check your database host configuration.');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Please check your database name.');
    }
    return false;
  } finally {
    connectionTestInProgress = false;
  }
}