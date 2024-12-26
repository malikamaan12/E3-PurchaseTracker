import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. Please set it to your Supabase connection string.",
  );
}

// Initialize the postgres client with the connection string
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: 'require',
  connect_timeout: 10
});

// Initialize Drizzle with the postgres client and schema
export const db = drizzle(client, { schema });

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    console.log('Testing database connection...');
    const result = await client`SELECT current_timestamp AS server_time`;
    console.log('Database connection test successful:', result[0]);
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });

    // Additional logging for connection debugging
    if (error.code === '28P01') {
      console.error('Authentication failed. Please check your database credentials.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Please check your database host and network connection.');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Please check your database name.');
    } else if (error.message.includes('endpoint is disabled')) {
      console.error(`
Database endpoint is not accessible. Please verify:
1. Your Supabase project is active
2. The connection string is correct
3. Database password is properly set
4. SSL is enabled for the connection
`);
    }

    return false;
  }
}