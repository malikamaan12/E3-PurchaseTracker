import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";
import Anthropic from '@anthropic-ai/sdk';
// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeDbError(error: Error): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this database error and provide a clear explanation of what might be wrong and how to fix it. Error: ${error.message}`
      }]
    });

    // Handle the content array properly
    const content = response.content[0];
    return content && 'text' in content ? content.text : "An unexpected database error occurred. Please try again later.";
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

export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Add a function to test the connection
export async function testConnection() {
  try {
    // Use a simple query to test the connection
    const result = await db.select({ test: sql`1` }).from(schema.users).limit(1);
    console.log('Database connection test successful');
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    // Get detailed analysis of the error
    const analysis = await analyzeDbError(error);
    console.error('Error analysis:', analysis);
    return false;
  }
}

// Add a function to execute a database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}