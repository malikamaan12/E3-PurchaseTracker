import Anthropic from '@anthropic-ai/sdk';
import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { errorLogs } from '../../db/schema';

// The newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
export const ANTHROPIC_MODEL = 'claude-3-7-sonnet-20250219';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Error class for Anthropic API errors
export class AnthropicError extends Error {
  statusCode: number;
  errorCode: string;
  details: any;
  
  constructor(message: string, statusCode: number = 500, errorCode: string = 'anthropic_error', details: any = {}) {
    super(message);
    this.name = 'AnthropicError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

// Custom middleware for error handling
export const anthropicErrorHandler = async (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AnthropicError) {
    console.error(`Anthropic API Error: ${err.message}`, err.details);
    
    // Log error to database
    try {
      await db.insert(errorLogs).values({
        errorType: 'ANTHROPIC_API',
        errorMessage: err.message,
        errorDetails: JSON.stringify(err.details),
        stackTrace: err.stack,
        userId: req.user?.id,
        createdAt: new Date(),
      });
    } catch (logError) {
      console.error('Failed to log error to database:', logError);
    }
    
    return res.status(err.statusCode).json({
      error: true,
      code: err.errorCode,
      message: err.message,
    });
  }
  
  next(err);
};

// Helper for text analysis with retry logic
export async function analyzeText(prompt: string, options: {
  maxTokens?: number;
  temperature?: number;
  system?: string;
  maxRetries?: number;
  retryDelay?: number;
} = {}): Promise<string> {
  const {
    maxTokens = 1024,
    temperature = 0.7,
    system = "You're a helpful AI assistant analyzing business data. Be concise and focus on key insights.",
    maxRetries = 3,
    retryDelay = 1000,
  } = options;
  
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries <= maxRetries) {
    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      
      if (!response.content || response.content.length === 0) {
        throw new AnthropicError('Received empty response from Anthropic API', 500, 'empty_response');
      }
      
      return response.content[0].text;
    } catch (error: any) {
      lastError = error;
      
      // Check if the error is retryable
      const isRateLimitError = error.status === 429;
      const isServerError = error.status >= 500 && error.status < 600;
      const isNetworkError = !error.status && (error.message.includes('ECONNRESET') || error.message.includes('timeout'));
      
      if (isRateLimitError || isServerError || isNetworkError) {
        retries++;
        if (retries <= maxRetries) {
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, retries - 1);
          console.log(`Retrying Anthropic API call (${retries}/${maxRetries}) after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      
      // Not retryable or max retries reached
      const errorDetails = {
        originalError: error.message,
        status: error.status,
        type: error.type,
      };
      
      throw new AnthropicError(
        `Anthropic API error: ${error.message}`,
        error.status || 500,
        error.type || 'api_error',
        errorDetails
      );
    }
  }
  
  // This should never happen, but just in case
  throw lastError || new AnthropicError('Unknown error when calling Anthropic API');
}

// Function for multimodal analysis with image
export async function analyzeImage(base64Image: string, prompt: string, options: {
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  retryDelay?: number;
} = {}): Promise<string> {
  const {
    maxTokens = 1024,
    temperature = 0.7,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;
  
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries <= maxRetries) {
    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }]
      });
      
      if (!response.content || response.content.length === 0) {
        throw new AnthropicError('Received empty response from Anthropic API for image analysis', 500, 'empty_response');
      }
      
      return response.content[0].text;
    } catch (error: any) {
      lastError = error;
      
      // Same retry logic as text analysis
      const isRateLimitError = error.status === 429;
      const isServerError = error.status >= 500 && error.status < 600;
      const isNetworkError = !error.status && (error.message.includes('ECONNRESET') || error.message.includes('timeout'));
      
      if (isRateLimitError || isServerError || isNetworkError) {
        retries++;
        if (retries <= maxRetries) {
          const delay = retryDelay * Math.pow(2, retries - 1);
          console.log(`Retrying Anthropic image analysis (${retries}/${maxRetries}) after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      
      // Not retryable or max retries reached
      const errorDetails = {
        originalError: error.message,
        status: error.status,
        type: error.type,
      };
      
      throw new AnthropicError(
        `Anthropic image analysis error: ${error.message}`,
        error.status || 500,
        error.type || 'api_error',
        errorDetails
      );
    }
  }
  
  // This should never happen, but just in case
  throw lastError || new AnthropicError('Unknown error when calling Anthropic API for image analysis');
}

// Function to perform document analysis
export async function analyzeDocument(document: string, options: {
  maxTokens?: number;
  temperature?: number;
  system?: string;
  documentType?: string;
} = {}): Promise<any> {
  const {
    maxTokens = 2048,
    temperature = 0.3, // Lower temperature for more consistent analysis
    system = "You're a document analysis expert. Extract key information and provide a structured analysis.",
    documentType = "business document",
  } = options;
  
  const prompt = `
Analyze the following ${documentType} and extract key information:

${document}

Please provide a structured analysis with the following:
1. Summary (100 words max)
2. Key entities mentioned (people, organizations)
3. Important dates and numbers
4. Main topics or themes
5. Recommendations or next steps (if applicable)
  `;
  
  try {
    const result = await analyzeText(prompt, {
      maxTokens,
      temperature,
      system,
    });
    
    return {
      success: true,
      analysis: result,
    };
  } catch (error) {
    if (error instanceof AnthropicError) {
      throw error; // Re-throw AnthropicError as is
    }
    
    // Convert other errors to AnthropicError
    throw new AnthropicError(
      `Failed to analyze document: ${(error as Error).message}`,
      500,
      'document_analysis_failed',
      { originalError: error }
    );
  }
}

// Utility function to format data for vendor analysis
export async function analyzeVendorPerformance(vendorData: any): Promise<any> {
  const prompt = `
Analyze the following vendor performance data and provide actionable insights:

Vendor Data:
${JSON.stringify(vendorData, null, 2)}

Please provide:
1. Overall performance rating on a scale of 1-10
2. Key strengths and weaknesses
3. Trend analysis (improving, declining, or stable)
4. Recommendations for vendor management
5. Risk assessment (low, medium, high)
  `;
  
  try {
    const result = await analyzeText(prompt, {
      maxTokens: 1500,
      temperature: 0.4,
      system: "You're a vendor management expert. Analyze vendor performance data and provide actionable insights.",
    });
    
    return {
      success: true,
      analysis: result,
    };
  } catch (error) {
    if (error instanceof AnthropicError) {
      throw error;
    }
    
    throw new AnthropicError(
      `Failed to analyze vendor performance: ${(error as Error).message}`,
      500,
      'vendor_analysis_failed',
      { originalError: error }
    );
  }
}

// Export the anthropic client for direct use if needed
export default anthropic;