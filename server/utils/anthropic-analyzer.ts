import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
export const CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type AnthropicImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/**
 * Analyzes text using Anthropic's Claude model
 * @param text The text to analyze
 * @param maxTokens Maximum number of tokens to generate in the response
 * @returns The analysis result
 */
export async function analyzeText(text: string, maxTokens: number = 1024): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: text }],
    });
    
    return response.content;
  } catch (error) {
    console.error('Error analyzing text with Anthropic:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred during text analysis');
  }
}

/**
 * Analyzes an image using Anthropic's Claude model
 * @param imagePath The path to the image file
 * @param prompt The prompt to accompany the image analysis
 * @param maxTokens Maximum number of tokens to generate in the response
 * @returns The analysis result
 */
export async function analyzeImage(imagePath: string, prompt: string = 'Describe this image in detail', maxTokens: number = 1024): Promise<any> {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Get file extension and determine mime type
    const fileExt = imagePath.split('.').pop()?.toLowerCase() || '';
    let mimeType: AnthropicImageMediaType = 'image/jpeg';
    
    if (fileExt === 'png') {
      mimeType = 'image/png';
    } else if (fileExt === 'gif') {
      mimeType = 'image/gif';
    } else if (fileExt === 'webp') {
      mimeType = 'image/webp';
    }
    
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
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
              media_type: mimeType,
              data: base64Image
            }
          }
        ]
      }]
    });
    
    return response.content;
  } catch (error) {
    console.error('Error analyzing image with Anthropic:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred during image analysis');
  }
}

/**
 * Checks if the Anthropic API is available and working
 * @returns Status information about the API
 */
export async function checkApiStatus(): Promise<{ available: boolean; apiWorking: boolean; model: string; }> {
  try {
    // Simple API check
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Respond with the exact text: "Anthropic API is working correctly."' }],
    });
    
    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    
    const isWorking = contentBlock.text.includes('Anthropic API is working correctly');
    
    return {
      available: true,
      apiWorking: isWorking,
      model: CLAUDE_MODEL
    };
  } catch (error) {
    console.error('Error checking Anthropic API status:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred while checking API status');
  }
}
