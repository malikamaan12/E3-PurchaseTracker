import { Anthropic } from '@anthropic-ai/sdk';
import { AppError } from './errors';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = 'claude-3-5-sonnet-20241022';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new AppError('ANTHROPIC_API_KEY environment variable is not set', 500, 'critical');
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PriorityAnalysisResult {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  score: number;
  reason: string;
  recommendations: string[];
}

export interface PurchaseRequestInput {
  title: string;
  description: string;
  purpose?: string;
  purposeType: string;
  totalEstimatedCost: number;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }>;
}

export async function analyzePurchaseRequestPriority(request: PurchaseRequestInput): Promise<PriorityAnalysisResult> {
  try {
    // Validate input
    if (!request.title || !request.description || !request.items?.length) {
      throw new AppError('Invalid purchase request data', 400, 'warning');
    }

    const prompt = `Analyze this purchase request and determine its priority level. Consider:
- Title: ${request.title}
- Description: ${request.description}
- Purpose Type: ${request.purposeType}
- Total Cost: ${request.totalEstimatedCost}
- Items:
${request.items.map(item => `  * ${item.name} (${item.quantity} x ${item.estimatedCost}${item.description ? ` - ${item.description}` : ''})`).join('\n')}

Provide a JSON response with:
{
  "priority": "low" | "medium" | "high" | "urgent",
  "score": number between 0 and 1,
  "reason": detailed explanation string,
  "recommendations": array of string suggestions for improvement
}`;

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    // Handle the response content correctly for Claude-3 API
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new AppError('Expected text response from Anthropic API', 500, 'error');
    }

    let response;
    try {
      response = JSON.parse(content.text);
    } catch (parseError) {
      throw new AppError('Failed to parse Anthropic API response', 500, 'error');
    }

    // Validate response format
    if (!response.priority || !response.score || !response.reason || !Array.isArray(response.recommendations)) {
      throw new AppError('Invalid response format from Anthropic API', 500, 'error');
    }

    // Validate priority value
    if (!['low', 'medium', 'high', 'urgent'].includes(response.priority)) {
      throw new AppError('Invalid priority value from Anthropic API', 500, 'error');
    }

    return {
      priority: response.priority,
      score: Math.max(0, Math.min(1, response.score)), // Ensure score is between 0 and 1
      reason: response.reason,
      recommendations: response.recommendations,
    };
  } catch (error: any) {
    // Handle specific API errors
    if (error instanceof AppError) {
      throw error;
    }

    if (error.status === 401) {
      throw new AppError('Invalid Anthropic API key', 500, 'critical');
    }
    if (error.status === 429) {
      throw new AppError('Anthropic API rate limit exceeded', 429, 'error');
    }
    if (error.status === 500) {
      throw new AppError('Anthropic API server error', 500, 'critical');
    }

    // Set error details in the AppError's details property
    const appError = new AppError('Failed to analyze purchase request priority', 500, 'error');
    appError.details = error.message;
    appError.code = 'ANTHROPIC_API_ERROR';

    console.error('Anthropic API error:', error);
    throw appError;
  }
}