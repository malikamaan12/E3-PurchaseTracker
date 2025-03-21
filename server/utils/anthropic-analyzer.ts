import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from './anthropic-config';

// Use the standardized Anthropic client
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
  validationErrors?: string[];
  suggestion?: string;
}

export async function analyzeFormSubmission(context: AnalysisContext): Promise<AnalysisResult> {
  try {
    const prompt = `Analyze this purchase request form submission context and identify potential issues:
    Form Data: ${JSON.stringify(context.formData, null, 2)}
    Error: ${context.error?.message || 'No error'}
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
      "issue_type": "validation"|"navigation"|"data"|"authentication"|"other",
      "description": "detailed description of the issue",
      "recommendation": "user-friendly recommendation to fix the issue",
      "severity": "low"|"medium"|"high",
      "suggestion": "brief, actionable suggestion for the user",
      "validationErrors": ["list", "of", "validation", "errors"],
      "autofix": {
        "fieldName": "correctedValue" // Optional: provide automatic fixes for fields
      }
    }`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    // Safely extract content from the response
    let analysisText = '';
    if (response.content && Array.isArray(response.content)) {
      analysisText = response.content.find(block => 'text' in block)?.text || '';
    }

    const analysis = JSON.parse(analysisText) as AnalysisResult;

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

    // Ensure all required properties are present
    return {
      issue_detected: analysis.issue_detected,
      issue_type: analysis.issue_type,
      description: analysis.description,
      recommendation: analysis.recommendation,
      severity: analysis.severity,
      autofix: analysis.autofix,
      validationErrors: analysis.validationErrors || [],
      suggestion: analysis.suggestion || analysis.recommendation
    };
  } catch (error) {
    console.error('Error analyzing form submission:', error);
    return {
      issue_detected: true,
      issue_type: "other", // Changed from "analysis_error" to match the type
      description: "Failed to analyze form submission",
      recommendation: "Please try submitting the form again. If the issue persists, contact support.",
      severity: "high",
      validationErrors: [],
      suggestion: "Please try again or contact support if the issue continues."
    };
  }
}