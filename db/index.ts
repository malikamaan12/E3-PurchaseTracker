import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

// Database connection logic supporting both Replit/Neon and DigitalOcean
function getDatabaseConnection() {
  // Check for production DigitalOcean database first
  const prodConnectionString = process.env.PROD_DATABASE_URL;
  const devConnectionString = process.env.DATABASE_URL;
  
  const connectionString = prodConnectionString || devConnectionString;
  
  if (!connectionString) {
    throw new Error("Neither PROD_DATABASE_URL nor DATABASE_URL is set");
  }
  
  const dbType = prodConnectionString ? 'DigitalOcean (Production)' : 'Replit/Neon (Development)';
  console.log(`Using database: ${dbType}`);
  
  if (prodConnectionString && process.env.VERCEL === "1") {
    if (!prodConnectionString.includes("25061") && !prodConnectionString.includes("pooler")) {
      console.warn("\n[WARNING] Serverless Deployment Detected!");
      console.warn("You are connecting to DigitalOcean Standard DB (Port 25060) from Vercel.");
      console.warn("This may cause Connection Pool Exhaustion. Please update PROD_DATABASE_URL to use PgBouncer (usually Port 25061) to manage transient connections.\n");
    }
  }
  
  return connectionString;
}

const connectionString = getDatabaseConnection();
const isProduction = !!process.env.PROD_DATABASE_URL;

// Standard Neon HTTP connection for Serverless stability
const client = neon(connectionString);
export const db = drizzleNeon(client, { schema });

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