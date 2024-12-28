import { getAnthropicClient } from './anthropic-client';

interface UIComponentAnalysis {
  issues: string[];
  recommendations: string[];
  fixedCode?: string;
}

export async function analyzeUIInteraction(
  componentCode: string,
  interactionType: string,
  errorDescription: string
): Promise<UIComponentAnalysis> {
  const prompt = `Analyze this React component's ${interactionType} interaction and identify issues:

Component code:
${componentCode}

Error description:
${errorDescription}

Consider:
1. Event handling and propagation
2. State management
3. Component lifecycle
4. Navigation/routing
5. TypeScript type safety

Provide a JSON response with:
{
  "issues": [list of identified problems],
  "recommendations": [specific fixes to implement],
  "fixedCode": "corrected implementation focusing on the problematic section"
}`;

  try {
    const client = await getAnthropicClient();
    if (!client) {
      return {
        issues: ['AI analysis service unavailable'],
        recommendations: ['Manual review required']
      };
    }

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ 
        role: "user", 
        content: prompt 
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Error analyzing UI interaction:', error);
    return {
      issues: ['Failed to analyze component'],
      recommendations: ['Manual review required'],
    };
  }
}