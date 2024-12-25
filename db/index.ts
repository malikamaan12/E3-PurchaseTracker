
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Configure WebSocket for Neon serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500, // Add connection recycling
  maxLifetimeSeconds: 3600, // Max lifetime of 1 hour
  keepAlive: true,
  keepAliveTimeoutMillis: 30000,
  webSocketConstructor: ws, // Add WebSocket constructor
  ssl: {
    rejectUnauthorized: false,
    servername: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0]
  }
});

// Add retry logic and connection management
let retries = 5;
const connectWithRetry = async () => {
  while (retries) {
    try {
      await pool.connect();
      console.log('Database connection established');
      break;
    } catch (err) {
      retries--;
      console.error(`Database connection attempt failed. ${retries} retries left`);
      if (retries === 0) {
        console.error('All database connection attempts failed');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  if (!pool.ended) {
    connectWithRetry();
  }
});

// Export the database instance
export const db = drizzle(pool, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Initial connection
connectWithRetry().catch(err => {
  console.error('Failed to establish initial database connection:', err);
});
