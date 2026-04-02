import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

/**
 * PurchaseTracker Database Layer (Neon HTTP Optimized)
 * Standardized on Neon HTTP for maximum stability in Vercel Serverless environments.
 * We enable 'fetchConnectionCache' to avoid repeated TCP handshakes during cold starts.
 */
neonConfig.fetchConnectionCache = true;

function getDatabaseConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("CRITICAL: DATABASE_URL is not set. Database operations will fail.");
  }

  // Diagnostic: Warn if using a standard Postgres port with the Neon HTTP driver
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
 */
export async function testConnection(): Promise<boolean> {
  try {
    console.log('[DB] Running health check...');
    const result = await db.execute(sql`SELECT 1 as health_check`);
    return !!result;
  } catch (error: any) {
    console.error('[DB] CRITICAL: Connection failed!', {
      msg: error.message,
      code: error.code
    });
    return false;
  }
}