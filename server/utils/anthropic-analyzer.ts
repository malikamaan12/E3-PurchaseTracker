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
  formState?: any;
}

interface AnalysisResult {
  issue_detected: boolean;
  issue_type: 'validation' | 'navigation' | 'data' | 'authentication' | 'other';
  description: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
  autofix?: Record<string, any>;
}

export async function analyzeFormSubmission(context: AnalysisContext): Promise<AnalysisResult> {
  try {
    const prompt = `Analyze this purchase request form submission context and identify potential issues:
    Form Data: ${JSON.stringify(context.formData, null, 2)}
    Error: ${context.error?.message || 'No error'}
    Navigation Target: ${context.navigationTarget}
    Form State: ${JSON.stringify(context.formState, null, 2)}
    Request ID: ${context.requestId}
    User ID: ${context.userId}

    Consider the following aspects:
    1. Data validation issues
    2. Required fields missing
    3. Format errors
    4. Common user mistakes
    5. Navigation problems
    6. Authentication issues

    Please provide analysis in JSON format with the following structure:
    {
      "issue_detected": boolean,
      "issue_type": "validation|navigation|data|authentication|other",
      "description": "detailed description of the issue",
      "recommendation": "user-friendly recommendation to fix the issue",
      "severity": "low|medium|high",
      "autofix": {
        "fieldName": "correctedValue" // Optional: provide automatic fixes for fields
      }
    }`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis = JSON.parse(response.content[0].text);

    // Add default autofix suggestions for common issues
    if (!analysis.autofix) {
      analysis.autofix = {};

      // Add automatic fixes based on issue type
      if (analysis.issue_type === 'validation') {
        if (context.formState?.errors?.items) {
          analysis.autofix.items = [{ name: "", quantity: 1, estimatedCost: 0, description: "" }];
        }
        if (context.formState?.errors?.vendorId) {
          analysis.autofix.vendorId = null;
        }
      }
    }

    return analysis;
  } catch (error) {
    console.error('Error analyzing form submission:', error);
    return {
      issue_detected: true,
      issue_type: "analysis_error",
      description: "Failed to analyze form submission",
      recommendation: "Please try submitting the form again. If the issue persists, contact support.",
      severity: "high"
    };
  }
}