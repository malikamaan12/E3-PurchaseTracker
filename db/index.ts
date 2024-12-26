import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@db/schema";

if (!process.env.SUPABASE_API_KEY) {
  throw new Error(
    "SUPABASE_API_KEY must be set. Please check your Supabase connection settings.",
  );
}

// Format Supabase connection string
const connectionString = `postgresql://postgres:${process.env.SUPABASE_API_KEY}@db.yiybquqbtlwhojpzfzmc.supabase.co:5432/postgres`;

// Initialize postgres connection for Drizzle with proper SSL config
const client = postgres(connectionString, {
  max: 1,
  connect_timeout: 10,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Drizzle with the SQL connection and schema
export const db = drizzle(client, { schema });

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    const result = await client`SELECT current_timestamp AS server_time`;
    console.log('Database connection test successful:', result);
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
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Please check your database name.');
    }

    return false;
  }
}

// Database health check with improved error handling
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await client`SELECT current_timestamp AS server_time`;
    console.log('Database health check successful:', result);
    return true;
  } catch (error: any) {
    console.error('Database health check failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });
    return false;
  }
}