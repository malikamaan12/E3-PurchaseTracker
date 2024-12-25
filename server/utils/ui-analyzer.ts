import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ 
        role: "user", 
        content: prompt 
      }],
    });

    return JSON.parse(response.content[0].text);
  } catch (error) {
    console.error('Error analyzing UI interaction:', error);
    return {
      issues: ['Failed to analyze component'],
      recommendations: ['Manual review required'],
    };
  }
}
