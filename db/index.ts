import { drizzle } from "drizzle-orm/neon-http";
import { neon } from '@neondatabase/serverless';
import * as schema from "@db/schema";
import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
let anthropic: Anthropic | null = null;

try {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set. AI-powered error analysis will be disabled.");
  } else {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
} catch (error) {
  console.error("Failed to initialize Anthropic client:", error);
}

async function analyzeDbError(error: Error): Promise<string> {
  if (!anthropic) {
    return "Error analysis unavailable. Please check the application logs for details.";
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this database error and provide a clear explanation of what might be wrong and how to fix it. Error: ${error.message}`
      }]
    });

    const content = response.content[0];
    return content.type === 'text'
      ? content.text
      : "An unexpected database error occurred. Please try again later.";
  } catch (anthropicError) {
    console.error("Error analyzing database error:", anthropicError);
    return "An unexpected error occurred while analyzing the database error. Please try again later.";
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize Neon client with connection retry logic
async function createNeonClient(retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Connection attempt ${attempt}/${retries}...`);
      const sql = neon(process.env.DATABASE_URL!);
      // Test the connection
      await sql`SELECT 1`;
      console.log('Database connection established successfully');
      return sql;
    } catch (error: any) {
      console.error(`Connection attempt ${attempt} failed:`, error.message);

      if (attempt === retries) {
        const analysis = await analyzeDbError(error);
        console.error("Database connection analysis:", analysis);
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
    }
  }
  throw new Error('Failed to connect to database after multiple attempts');
}

// Initialize database connection
let sql: ReturnType<typeof neon>;
try {
  sql = neon(process.env.DATABASE_URL);
} catch (error: any) {
  console.error('Failed to initialize database connection:', error);
  throw error;
}

// Initialize Drizzle with the Neon client
export const db = drizzle(sql, { schema });

// Add a function to test the connection
export async function testConnection() {
  try {
    console.log('Testing database connection...');
    await sql`SELECT 1`;
    console.log('Database connection test successful');
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    if (anthropic) {
      const analysis = await analyzeDbError(error);
      console.error('Error analysis:', analysis);
    }
    return false;
  }
}

// Add a function to execute a database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}