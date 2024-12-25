import { neon } from '@neondatabase/serverless';
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create SQL client with HTTP pooling
const sql = neon(process.env.DATABASE_URL);

// Export the database instance
export const db = drizzle(sql, { schema });

// Test the connection and log the result
sql`SELECT version()`
  .then(() => console.log('Database connection successful'))
  .catch(err => {
    console.error('Database connection error:', err);
    // Log but don't exit to allow retries
  });