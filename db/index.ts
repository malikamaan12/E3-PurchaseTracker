import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import ws from "ws";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

/**
 * PurchaseTracker Database Layer
 * - db: Neon HTTP client for stateless operations
 * - transactionDb: WebSocket-backed Pool for interactive transactions and row locking
 */
neonConfig.fetchConnectionCache = true;
neonConfig.webSocketConstructor = ws;

function getDatabaseConnectionString(): string {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    try {
      for (const file of [".env.local", ".env"]) {
        const p = path.resolve(process.cwd(), file);
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith("DATABASE_URL=")) {
              let val = trimmed.slice("DATABASE_URL=".length).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              connectionString = val;
              process.env.DATABASE_URL = val;
              break;
            }
          }
        }
        if (connectionString) break;
      }
    } catch {}
  }
  
  if (!connectionString) {
    throw new Error("CRITICAL: DATABASE_URL is not set. Database operations will fail.");
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
 * Transaction-Capable Neon Client Instance
 * Uses WebSocket Pool to support interactive transactions and SELECT ... FOR UPDATE.
 */
declare global {
  var __neon_pool: Pool | undefined;
}

function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return new Pool({ connectionString });
  }
  if (!global.__neon_pool) {
    global.__neon_pool = new Pool({ connectionString });
  }
  return global.__neon_pool;
}

export const pool = getPool();
export const transactionDb = drizzleServerless(pool, { schema });

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