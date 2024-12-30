import { Anthropic } from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeError(error: Error, context: any = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set, skipping error analysis');
    return null;
  }

  try {
    const errorContext = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ...context,
      // Add additional context for notification-specific errors
      notificationContext: context.userId ? {
        userId: context.userId,
        path: context.path,
        requestData: context.requestData,
        component: context.component,
        lastAction: context.lastAction
      } : undefined
    };

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `As an AI expert in debugging enterprise applications, analyze this error and provide detailed insights:

        Error Details:
        ${JSON.stringify(errorContext, null, 2)}

        Please provide a comprehensive analysis including:
        1. Root Cause Analysis:
           - What is the likely cause of this error?
           - Are there any patterns or common triggers?
           - Is this a system-level or application-level issue?

        2. Impact Assessment:
           - What components are affected?
           - Are there potential cascade effects?
           - What is the user experience impact?

        3. Resolution Steps:
           - Immediate fixes needed
           - Long-term solutions
           - Prevention strategies

        4. Technical Context:
           - Related system components
           - Configuration concerns
           - Performance implications

        Format your response as JSON with these keys:
        - rootCause: {
            primary: string,
            contributing: string[],
            systemLevel: boolean
          }
        - impact: {
            severity: "critical"|"high"|"medium"|"low",
            affectedComponents: string[],
            userImpact: string
          }
        - resolution: {
            immediate: string[],
            longTerm: string[],
            prevention: string[]
          }
        - technical: {
            components: string[],
            configuration: object,
            performance: string
          }
        `
      }]
    });

    return {
      analysis: message.content[0].text,
      timestamp: new Date().toISOString(),
      originalError: {
        message: error.message,
        name: error.name,
        stack: error.stack
      }
    };
  } catch (analysisError) {
    console.error('Error analyzing with Claude:', analysisError);
    return {
      error: 'Failed to analyze error with AI',
      timestamp: new Date().toISOString(),
      originalError: {
        message: error.message,
        name: error.name,
        stack: error.stack
      }
    };
  }
}

// Helper function for notification-specific error analysis
export async function analyzeNotificationError(error: Error, userId: number, component: string, action: string) {
  return analyzeError(error, {
    userId,
    component,
    lastAction: action,
    subsystem: 'notifications',
    context: {
      timestamp: new Date().toISOString(),
      component,
      action,
      userId
    }
  });
}