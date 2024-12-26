import { drizzle } from "drizzle-orm/neon-http";
import { neon, type NeonHttpDatabase } from '@neondatabase/serverless';
import * as schema from "@db/schema";
import { analyzeError } from "../server/utils/anthropic-client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize database connection with retry logic
async function createNeonClient(retries = 3, baseDelay = 1000): Promise<NeonHttpDatabase> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt}/${retries}`);

      // Configure Neon client with SSL
      const sql = neon(process.env.DATABASE_URL!, { 
        ssl: true,
        poolSize: 1
      });

      // Test the connection
      await sql`SELECT 1`;
      console.log('Database connection established successfully');
      return sql;
    } catch (error: any) {
      lastError = error;
      const analysis = await analyzeError(error, "Database connection");

      console.error(`Connection attempt ${attempt} failed:`, {
        error: error.message,
        analysis
      });

      if (attempt === retries) {
        throw new Error(`Failed to connect to database: ${analysis}`);
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Failed to connect to database');
}

// Initialize database connection
let sql: NeonHttpDatabase;
try {
  sql = await createNeonClient();
} catch (error: any) {
  console.error('Failed to initialize database connection:', error);
  throw error;
}

// Initialize Drizzle with the database connection
export const db = drizzle(sql, { schema });

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error: any) {
    const analysis = await analyzeError(error, "Database connection test");
    console.error('Database connection test failed:', {
      error: error.message,
      analysis
    });
    return false;
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error: any) {
    const analysis = await analyzeError(error, "Database health check");
    console.error("Database health check failed:", {
      error: error.message,
      analysis
    });
    return false;
  }
}