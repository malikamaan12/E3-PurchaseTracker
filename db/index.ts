import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the connection pool with correct options
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false // Required for Neon's SSL
  }
});

// Add error handling and connection management
pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process on connection errors, let the pool retry
  if (err.message.includes('Connection terminated')) {
    console.log('Connection terminated, pool will retry automatically');
    return;
  }
  process.exit(-1);
});

// Export the database instance with WebSocket configuration
export const db = drizzle(pool, { 
  schema,
  logger: true
});

// Test the connection
pool.connect()
  .then(() => console.log('Initial database connection successful'))
  .catch(err => {
    console.error('Failed to establish initial database connection:', err);
    // Don't exit, let the pool retry
  });