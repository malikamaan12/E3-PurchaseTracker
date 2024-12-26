import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. Please set it to your Supabase connection string.",
  );
}

// Parse connection URL to handle Supabase format
const connectionString = process.env.DATABASE_URL;

// Initialize the postgres client with retries and proper SSL
const client = postgres(connectionString, {
  max: 3,
  idle_timeout: 20,
  connect_timeout: 30,
  ssl: true,
  connection: {
    application_name: 'purchase_management_system'
  },
  onnotice: () => {},
  max_retries: 3,
  retry_interval: 5000
});

// Initialize Drizzle with the postgres client and schema
export const db = drizzle(client, { schema });

// Test database connection with detailed error handling
export async function testConnection(): Promise<boolean> {
  try {
    console.log('Testing database connection...');
    console.log('Using connection URL pattern:', connectionString.replace(/:[^:@]+@/, ':****@'));

    // Try to execute a simple query
    const result = await client`SELECT current_timestamp AS server_time`;
    console.log('Database connection test successful:', result[0]);

    // Additional validation query to check schema access
    await client`SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
    ) as has_tables`;

    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });

    // Enhanced error reporting for Supabase-specific issues
    if (error.code === '28P01') {
      console.error('Authentication failed. Please check your Supabase database credentials.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Please check your Supabase host configuration.');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Please check your Supabase database name.');
    } else if (error.message.includes('endpoint is disabled')) {
      console.error(`
Database endpoint is not accessible. Please verify:
1. Your Supabase project is active
2. The database connection string is in the correct format:
   postgresql://postgres:[PASSWORD]@db.yiybquqbtlwhojpzfzmc.supabase.co:5432/postgres
3. The password is correctly set in the environment variables
4. SSL is enabled for the connection

Common fixes:
- Visit https://supabase.com/dashboard/project/_/settings/database
- Enable "Database API" in project settings
- Check if the database is paused and restart if necessary
- Verify the connection string format matches your Supabase project
`);
    }

    return false;
  }
}