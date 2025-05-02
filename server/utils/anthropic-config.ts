/**
 * Standardized configuration for Anthropic API usage
 * This file centralizes all Anthropic API configuration to ensure consistency
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { AppError } from './errors';

// Note: The newest model available in our @anthropic-ai/sdk version is "claude-3-sonnet-20240229"
// This will be updated to "claude-3-7-sonnet-20250219" once the SDK is updated
export const MODEL = 'claude-3-sonnet-20240229';

// Standard token and temperature settings
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 0.7;

// Maximum retry attempts for API calls
export const MAX_RETRIES = 3;

// Create and export a singleton Anthropic client
const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Error type for Anthropic API calls
 */
export interface AnthropicError extends Error {
  status?: number;
  type?: string;
  param?: string;
  code?: string;
}

/**
 * Helper function to execute Anthropic API calls with retry logic
 * @param apiCallFn - Function that makes the actual API call
 * @param options - Options for controlling retry behavior
 */
export async function executeWithRetry<T>(
  apiCallFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryStatusCodes?: number[];
    onRetry?: (error: any, attemptNumber: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    retryStatusCodes = [429, 500, 502, 503, 504],
    onRetry = (error, attemptNumber) => console.warn(`Anthropic API retry ${attemptNumber}/${maxRetries}:`, error.message || error)
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries + 1; attempt++) {
    try {
      return await apiCallFn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry based on the error
      const statusCode = error.status || (error.response?.status);
      const shouldRetry = 
        attempt < maxRetries && 
        (retryStatusCodes.includes(statusCode) || !statusCode); // Retry on network errors (no status)
      
      if (!shouldRetry) {
        break;
      }
      
      // Call onRetry callback
      onRetry(error, attempt + 1);
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * (2 ** attempt), 10000) * (0.8 + Math.random() * 0.4);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Format a more helpful error
  const formattedError = new Error(
    `Anthropic API error after ${maxRetries} retries: ${lastError.message || 'Unknown error'}`
  ) as AnthropicError;
  
  // Copy properties
  if (lastError.status) formattedError.status = lastError.status;
  if (lastError.type) formattedError.type = lastError.type;
  if (lastError.param) formattedError.param = lastError.param;
  if (lastError.code) formattedError.code = lastError.code;
  
  throw formattedError;
}

/**
 * Check if the Anthropic API key is configured
 */
export function checkApiKeyConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Verify the API key is valid by making a simple request
 */
export async function verifyApiKey(): Promise<boolean> {
  if (!checkApiKeyConfigured()) {
    return false;
  }
  
  try {
    await executeWithRetry(() => 
      anthropicClient.messages.create({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      })
    );
    return true;
  } catch (error) {
    console.error('Anthropic API key verification failed:', error);
    return false;
  }
}

export { anthropicClient };