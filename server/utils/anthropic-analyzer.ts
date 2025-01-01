import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalysisContext {
  formData?: any;
  error?: Error;
  navigationTarget?: string;
  requestId?: number;
  userId?: number;
}

export async function analyzeFormSubmission(context: AnalysisContext) {
  try {
    const prompt = `Analyze this form submission context and identify potential issues:
    Form Data: ${JSON.stringify(context.formData, null, 2)}
    Error: ${context.error?.message || 'No error'}
    Navigation Target: ${context.navigationTarget}
    Request ID: ${context.requestId}
    User ID: ${context.userId}

    Please provide analysis in JSON format with the following structure:
    {
      "issue_detected": boolean,
      "issue_type": "validation|navigation|data|authentication|other",
      "description": "detailed description of the issue",
      "recommendation": "recommended fix",
      "severity": "low|medium|high"
    }`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    return JSON.parse(response.content[0].text);
  } catch (error) {
    console.error('Error analyzing form submission:', error);
    return {
      issue_detected: true,
      issue_type: "analysis_error",
      description: "Failed to analyze form submission",
      recommendation: "Check Anthropic API configuration and try again",
      severity: "high"
    };
  }
}
