/**
 * Vendor analyzer utilities using Anthropic API
 * This file provides utilities for analyzing vendor data using Claude API
 */

import { anthropicClient, MODEL, DEFAULT_MAX_TOKENS, executeWithRetry } from './anthropic-config';
import { AppError } from './errors';

// Define an interface that matches the structure of Anthropic Message responses
interface AnthropicMessageResponse {
  id: string;
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

// Helper function to extract JSON from response text
function extractJson(text: string): any {
  try {
    // Find the JSON portion of the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('Error parsing JSON response:', parseError);
    // Return the raw text if JSON parsing fails
    return { analysis: text };
  }
}

// Helper function to process API response
function processAnthropicResponse(response: any): any {
  // Type cast response since we know it's a non-streaming response which has the content property
  const messageResponse = response as AnthropicMessageResponse;
  
  // Find the content block with text
  const contentBlock = messageResponse.content.find(block => block.type === 'text');
  if (!contentBlock || contentBlock.type !== 'text' || !contentBlock.text) {
    throw new Error('Invalid response format from Claude');
  }
  
  return extractJson(contentBlock.text);
}

/**
 * Analyze vendor profile data
 * @param vendorData Vendor data to analyze
 * @returns Analysis of vendor profile
 */
export async function analyzeVendorProfile(vendorData: any): Promise<any> {
  try {
    if (!vendorData || Object.keys(vendorData).length === 0) {
      throw new AppError('Invalid vendor data provided', 400);
    }

    // Execute API call with retry logic
    const response = await executeWithRetry(() => 
      anthropicClient.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this vendor profile and provide strategic insights:

${JSON.stringify(vendorData, null, 2)}

Please provide the following in a structured JSON format:
1. Vendor strengths and weaknesses
2. Suggested areas for negotiation
3. Risk assessment
4. Strategic recommendations`
              }
            ]
          }
        ],
        temperature: 0.3, // Lower temperature for more factual analysis
        system: "You are an expert vendor analysis AI. Your task is to analyze vendor profiles and provide structured insights that help procurement teams make strategic decisions. Format your response as JSON."
      })
    );

    return processAnthropicResponse(response);
  } catch (error) {
    console.error('Error analyzing vendor profile:', error);
    throw new AppError(
      error instanceof Error ? error.message : 'Unknown error analyzing vendor profile',
      error instanceof AppError ? error.status : 500
    );
  }
}

/**
 * Analyze vendor performance data
 * @param performanceData Vendor performance data to analyze
 * @returns Performance analysis and recommendations
 */
export async function analyzeVendorPerformance(performanceData: any): Promise<any> {
  try {
    if (!performanceData || Object.keys(performanceData).length === 0) {
      throw new AppError('Invalid performance data provided', 400);
    }

    // Execute API call with retry logic
    const response = await executeWithRetry(() => 
      anthropicClient.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this vendor performance data and provide insights:

${JSON.stringify(performanceData, null, 2)}

Please provide the following in a structured JSON format:
1. Performance trend analysis
2. Key metrics evaluation
3. Comparative performance (if applicable)
4. Improvement recommendations`
              }
            ]
          }
        ],
        temperature: 0.2, // Lower temperature for more factual analysis
        system: "You are an expert vendor performance analyst. Your task is to analyze vendor performance data and provide structured insights that help procurement teams optimize vendor relationships. Format your response as JSON."
      })
    );

    return processAnthropicResponse(response);
  } catch (error) {
    console.error('Error analyzing vendor performance:', error);
    throw new AppError(
      error instanceof Error ? error.message : 'Unknown error analyzing vendor performance',
      error instanceof AppError ? error.status : 500
    );
  }
}

/**
 * Analyze vendor document (multimodal analysis)
 * @param documentBase64 Base64-encoded document
 * @param documentType Type of document (PDF, image, etc)
 * @param context Additional context about the document
 * @returns Document analysis and key insights
 */
export async function analyzeVendorDocument(
  documentBase64: string,
  documentType: string,
  context?: Record<string, any>
): Promise<any> {
  try {
    if (!documentBase64) {
      throw new AppError('No document data provided', 400);
    }

    // Determine media type from document type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'; // Default to JPEG for safety
    
    if (documentType.includes('jpeg') || documentType.includes('jpg')) {
      mediaType = 'image/jpeg';
    } else if (documentType.includes('png')) {
      mediaType = 'image/png';
    } else if (documentType.includes('gif')) {
      mediaType = 'image/gif';
    } else if (documentType.includes('webp')) {
      mediaType = 'image/webp';
    } else if (!documentType.startsWith('image/')) {
      // For PDFs and other non-image types, we need to convert/render them as images first
      // For now, throw an error for unsupported types
      throw new AppError('Unsupported document type: ' + documentType, 400);
    }

    // Execute API call with retry logic
    const response = await executeWithRetry(() => 
      anthropicClient.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS * 2, // Double tokens for document analysis
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this vendor document and extract key information:

${context ? JSON.stringify(context, null, 2) : 'Please extract all relevant information from this document.'}

Please provide the following in a structured JSON format:
1. Document type and purpose
2. Key information extracted
3. Contractual terms (if applicable)
4. Financial details (if applicable)
5. Action items and recommendations`
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: documentBase64
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        system: "You are an expert document analyst specializing in vendor management. Your task is to analyze vendor documents and extract key information that helps procurement teams make informed decisions. Format your response as JSON."
      })
    );

    return processAnthropicResponse(response);
  } catch (error) {
    console.error('Error analyzing vendor document:', error);
    throw new AppError(
      error instanceof Error ? error.message : 'Unknown error analyzing vendor document',
      error instanceof AppError ? error.status : 500
    );
  }
}
