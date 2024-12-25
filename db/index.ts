import { drizzle } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a new postgres connection with keep-alive and retry settings
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Export the database instance
export const db = drizzle(queryClient, { schema });

// Test the connection
queryClient`SELECT current_timestamp`
  .then(() => console.log('Database connection successful'))
  .catch(err => {
    console.error('Database connection error:', err);
    // Log but don't exit, let the connection retry
  });