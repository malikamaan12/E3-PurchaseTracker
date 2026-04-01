import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

/**
 * PurchaseTracker Database Layer (Neon HTTP Optimized)
 * Standardized on Neon HTTP for maximum stability in Vercel Serverless environments.
 * This avoids connection pool exhaustion common with traditional Postgres drivers.
 */
function getDatabaseConnectionString(): string {
  // Use the standard DATABASE_URL which should point to Neon
  const connectionString = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("CRITICAL: DATABASE_URL is not set. Please add your Neon connection string to Vercel Environment Variables.");
  }

  // Safety check: Neon HTTP driver requires a specific URL format (usually starts with postgres:// or postgresql://)
  if (!connectionString.startsWith("postgres") && !connectionString.startsWith("http")) {
    console.warn("WARNING: Database connection string format looks unusual for Neon.");
  }

  return connectionString;
}

const connectionString = getDatabaseConnectionString();

// Initialize Neon HTTP Client
// Note: This driver uses fetch() under the hood, making it ideal for stateless serverless functions.
const client = neon(connectionString);
export const db = drizzleNeon(client, { schema });

/**
 * Connection Health Check
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT 1 as connection_test`);
    return !!result;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code
    });
    return false;
  }
}