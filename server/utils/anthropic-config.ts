/**
 * Standardized configuration for Anthropic API usage
 * This file centralizes all Anthropic API configuration to ensure consistency
 */

import { Anthropic } from '@anthropic-ai/sdk';

// Export the latest Claude model
export const MODEL = 'claude-3-5-sonnet-20241022';

// Standard token and temperature settings
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 0.7;

// Create and export a singleton Anthropic client
const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export { anthropicClient };