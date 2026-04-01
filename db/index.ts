import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

// Optimization: Ensure fetch is available for Neon HTTP (required for serverless)
if (typeof fetch === 'undefined') {
  console.warn('[DB] "fetch" is missing from the global environment. This may cause issues on older Node.js runtimes.');
}

/**
 * PurchaseTracker Database Layer (Neon HTTP Optimized)
 */
function getDatabaseConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("CRITICAL: DATABASE_URL is not set. Database operations will fail.");
  }

  // Diagnostic: Check for a protocol that isn't compatible with the Neon HTTP driver
  // If the user is still using the old DigitalOcean PG URL (port 25060), this will warn them.
  if (connectionString.includes(":25060") || connectionString.includes(":25061")) {
    console.warn("DANGER: You are likely using a standard Postgres port with the Neon HTTP driver. This WILL cause timeouts.");
  }

  return connectionString;
}

const connectionString = getDatabaseConnectionString();

/**
 * Neon HTTP Client Instance
 * Standardized on stateless HTTP for maximum serverless reliability.
 */
const client = neon(connectionString);
export const db = drizzleNeon(client, { schema });

/**
 * Connection Health Check
 * Used by the API bridge during startup to identify connectivity issues early.
 */
export async function testConnection(): Promise<boolean> {
  try {
    console.log('[DB] Running connection health check...');
    const startTime = Date.now();
    const result = await db.execute(sql`SELECT 1 as health_check`);
    console.log(`[DB] Health check successful (${Date.now() - startTime}ms)`);
    return !!result;
  } catch (error: any) {
    console.error('[DB] CRITICAL: Database connection failed!', {
      msg: error.message,
      code: error.code,
      hint: "Verify your DATABASE_URL in Vercel settings and ensure it is a Neon HTTP-compatible string (no port 25060)."
    });
    return false;
  }
}