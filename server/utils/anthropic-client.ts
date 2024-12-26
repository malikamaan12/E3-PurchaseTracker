import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
let anthropicClient: Anthropic | null = null;

export function initializeAnthropicClient() {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("ANTHROPIC_API_KEY not set. AI-powered analysis will be disabled.");
      return null;
    }

    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    return anthropicClient;
  } catch (error) {
    console.error("Failed to initialize Anthropic client:", error);
    return null;
  }
}

export function getAnthropicClient(): Anthropic | null {
  if (!anthropicClient) {
    return initializeAnthropicClient();
  }
  return anthropicClient;
}

export async function analyzeError(error: Error | string | unknown, context: string): Promise<string> {
  const client = getAnthropicClient();
  if (!client) {
    return `Error occurred in ${context}. Please check application logs for details.`;
  }

  try {
    // Convert error to string representation for analysis
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this error from context "${context}" and provide a clear, actionable explanation:

        Error: ${errorMessage}
        Stack: ${errorStack || 'No stack trace available'}

        Consider:
        1. Common causes
        2. Potential fixes
        3. Impact on the system

        Provide a concise, user-friendly explanation.`
      }]
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      return `Error occurred in ${context}. Please check application logs for details.`;
    }
    return content.text;
  } catch (analysisError) {
    console.error("Error analyzing with Anthropic:", analysisError);
    return `Error occurred in ${context}. Please check application logs for details.`;
  }
}

interface AnalysisOptions {
  maxTokens?: number;
  temperature?: number;
}

export async function analyzePurchaseRequest(request: any): Promise<{
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  score: number;
  recommendations?: string[];
}> {
  const client = getAnthropicClient();
  if (!client) {
    return {
      priority: 'medium',
      reason: 'Unable to analyze request - AI service unavailable',
      score: 50
    };
  }

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this purchase request and determine its priority level:
        ${JSON.stringify(request, null, 2)}

        Provide a JSON response with:
        - priority: one of ["low", "medium", "high", "urgent"]
        - reason: explanation for the priority level
        - score: numerical priority score (0-100)
        - recommendations: optional array of suggestions`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Error analyzing purchase request:', error);
    return {
      priority: 'medium',
      reason: 'Failed to analyze priority - defaulting to medium',
      score: 50
    };
  }
}

export async function analyzeUIComponent(componentCode: string, errorDescription: string): Promise<{
  issues: string[];
  recommendations: string[];
  fixedCode?: string;
}> {
  const client = getAnthropicClient();
  if (!client) {
    return {
      issues: ['AI analysis unavailable'],
      recommendations: ['Manual review required']
    };
  }

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this React component and identify issues:

Component code:
${componentCode}

Error description:
${errorDescription}

Consider:
1. Event handling and propagation
2. State management
3. Component lifecycle
4. TypeScript type safety

Provide a JSON response with:
{
  "issues": [list of identified problems],
  "recommendations": [specific fixes to implement],
  "fixedCode": "corrected implementation focusing on the problematic section"
}`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Error analyzing UI component:', error);
    return {
      issues: ['Analysis failed'],
      recommendations: ['Manual review required']
    };
  }
}