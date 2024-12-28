import Anthropic from '@anthropic-ai/sdk';
import { AppError } from './errors';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = 'claude-3-5-sonnet-20241022';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new AppError('ANTHROPIC_API_KEY environment variable is not set');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PriorityAnalysisResult {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  score: number;
  reason: string;
  recommendations: string;
}

export async function analyzePurchaseRequestPriority(request: {
  title: string;
  description: string;
  purpose?: string;
  purposeType: string;
  totalEstimatedCost: number;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
  }>;
}): Promise<PriorityAnalysisResult> {
  try {
    const prompt = `Analyze this purchase request and determine its priority level. Consider:
- Title: ${request.title}
- Description: ${request.description}
- Purpose Type: ${request.purposeType}
- Total Cost: ${request.totalEstimatedCost}
- Items:
${request.items.map(item => `  * ${item.name} (${item.quantity} x ${item.estimatedCost})`).join('\n')}

Provide a JSON response with:
- priority: (low/medium/high/urgent)
- score: (0-1 confidence score)
- reason: (brief explanation)
- recommendations: (suggestions for improvement or alternatives)`;

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const response = JSON.parse(message.content[0].text);

    // Validate response format
    if (!response.priority || !response.score || !response.reason || !response.recommendations) {
      throw new Error('Invalid response format from Anthropic API');
    }

    return {
      priority: response.priority,
      score: Math.max(0, Math.min(1, response.score)), // Ensure score is between 0 and 1
      reason: response.reason,
      recommendations: response.recommendations,
    };
  } catch (error: any) {
    if (error.status === 401) {
      throw new AppError('Invalid Anthropic API key', 500);
    }
    if (error.status === 429) {
      throw new AppError('Anthropic API rate limit exceeded', 429);
    }
    console.error('Anthropic API error:', error);
    throw new AppError('Failed to analyze purchase request priority');
  }
}