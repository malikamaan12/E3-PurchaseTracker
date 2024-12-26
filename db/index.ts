import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from '@neondatabase/serverless';
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

// Configure neon to use fetch API
neonConfig.fetchConnectionCache = true;
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

// Add a function to test the connection with better error handling
export async function testConnection() {
  try {
    // Use a simple query to test the connection
    await sql`SELECT 1`;
    console.log('Database connection test successful');
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    if (anthropic) {
      // Only attempt error analysis if Anthropic client is available
      const analysis = await analyzeDbError(error);
      console.error('Error analysis:', analysis);
    }
    return false;
  }
}

// Add a function to execute a database health check with proper error handling
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}