import { Anthropic } from '@anthropic-ai/sdk';
import { debug } from '../routes';

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
      ...context
    };

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `As an AI expert in debugging enterprise applications, analyze this error and provide insights:

        Error Details:
        ${JSON.stringify(errorContext, null, 2)}

        Please analyze:
        1. What might have caused this error?
        2. How can it be fixed?
        3. How to prevent similar errors?
        
        Format your response as JSON with these keys:
        - cause: Likely cause of the error
        - solution: Recommended fix
        - prevention: How to prevent similar errors
        - severity: (critical|high|medium|low)
        `
      }]
    });

    const analysis = JSON.parse(message.content[0].text);
    return {
      ...analysis,
      timestamp: new Date().toISOString()
    };
  } catch (analysisError) {
    console.error('Error analyzing with Claude:', analysisError);
    return null;
  }
}
