import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

// Database connection logic supporting both Replit/Neon and DigitalOcean
function getDatabaseConnection() {
  // Check for production DigitalOcean database first
  const prodConnectionString = process.env.PROD_DATABASE_URL;
  const devConnectionString = process.env.DATABASE_URL;
  
  const connectionString = prodConnectionString || devConnectionString;
  
  if (!connectionString) {
    throw new Error("Neither PROD_DATABASE_URL nor DATABASE_URL is set");
  }
  
  const dbType = prodConnectionString ? 'DigitalOcean (Production)' : 'Replit/Neon (Development)';
  console.log(`Using database: ${dbType}`);
  
  return connectionString;
}

const connectionString = getDatabaseConnection();

export const db = drizzle({
  connection: connectionString,
  schema,
  ws: ws,
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    const result = await db.execute(sql`SELECT 1 as connection_test`);
    // Safely handle potential null result
    return result && typeof result.rowCount === 'number' && result.rowCount > 0;
  } catch (error: any) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail || error.hint
    });
    return false;
  }
}