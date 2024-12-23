import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface PriorityAnalysisInput {
  title: string;
  description: string;
  purpose: string;
  purposeType: string;
  totalEstimatedCost: number;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
  }>;
}

interface PriorityAnalysisResult {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  score: number;
  recommendations?: string[];
}

export async function analyzePurchaseRequestPriority(
  input: PriorityAnalysisInput
): Promise<PriorityAnalysisResult> {
  const prompt = `Analyze this purchase request and determine its priority level. Consider:
- Purpose type: ${input.purposeType}
- Total cost: ${input.totalEstimatedCost}
- Items requested: ${input.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
- Description: ${input.description}
- Purpose: ${input.purpose}

Provide a JSON response with:
- priority: one of ["low", "medium", "high", "urgent"]
- reason: explanation for the priority level
- score: numerical priority score (0-100)
- recommendations: optional array of suggestions

Base the priority on:
1. Business impact and urgency
2. Cost vs. benefit analysis
3. Alignment with purpose type
4. Resource availability and timing
5. Risk assessment`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ 
        role: "user", 
        content: prompt 
      }],
    });

    const result = JSON.parse(response.content[0].text);
    return {
      priority: result.priority,
      reason: result.reason,
      score: result.score,
      recommendations: result.recommendations
    };
  } catch (error) {
    console.error('Error analyzing request priority:', error);
    // Return medium priority as fallback
    return {
      priority: 'medium',
      reason: 'Failed to analyze priority, defaulting to medium',
      score: 50
    };
  }
}
