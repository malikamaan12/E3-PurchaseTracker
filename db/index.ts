import { drizzle } from "drizzle-orm/neon-http";
import { neon } from '@neondatabase/serverless';
import * as schema from "@db/schema";
import { analyzeError } from "../server/utils/anthropic-client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize database connection with retry logic
async function createDatabaseConnection(retries = 3, baseDelay = 1000) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt}/${retries}`);

      // Configure Neon client
      const sql = neon(process.env.DATABASE_URL);

      // Test the connection
      await sql`SELECT 1`;
      console.log('Database connection established successfully');
      return sql;
    } catch (error: any) {
      lastError = error;
      console.error(`Connection attempt ${attempt} failed:`, error.message);

      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to connect to database');
}

// Initialize database connection
let sql;
try {
  sql = await createDatabaseConnection();
} catch (error: any) {
  console.error('Failed to initialize database connection:', error);
  throw error;
}

// Initialize Drizzle with the database connection
export const db = drizzle(sql, { schema });

// Test database connection
export async function testConnection() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Database health check
export async function checkDatabaseHealth() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}