import { AppError, ErrorContext } from './errors';
import { Anthropic } from '@anthropic-ai/sdk';
import { z } from 'zod';

// Validation schema for AI suggestions
const errorAnalysisSchema = z.object({
  prediction: z.string(),
  suggestions: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  preventiveMeasures: z.array(z.string())
});

type ErrorAnalysis = z.infer<typeof errorAnalysisSchema>;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function analyzeError(error: Error | AppError): Promise<ErrorAnalysis> {
  try {
    const errorContext = error instanceof AppError ? error.toJSON() : {
      message: error.message,
      stack: error.stack,
      name: error.name
    };

    // Generate analysis prompt
    const prompt = `Analyze this error and provide suggestions:
Error: ${JSON.stringify(errorContext, null, 2)}

Provide a JSON response with:
1. Brief prediction of potential root causes
2. List of suggestions to fix
3. Severity level (low/medium/high/critical)
4. List of preventive measures

Format: {
  "prediction": "string",
  "suggestions": ["string"],
  "severity": "low|medium|high|critical",
  "preventiveMeasures": ["string"]
}`;

    // Get AI analysis
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [{ 
        role: 'user', 
        content: prompt 
      }]
    });

    // Parse and validate the response
    const analysis = JSON.parse(response.content[0].text);
    return errorAnalysisSchema.parse(analysis);
  } catch (analysisError) {
    console.error('Error analysis failed:', analysisError);
    // Provide a fallback analysis if AI fails
    return {
      prediction: 'Unable to analyze error',
      suggestions: ['Please check the error message and stack trace'],
      severity: 'medium',
      preventiveMeasures: ['Ensure all validation is in place', 'Check input data']
    };
  }
}

export async function enhanceErrorContext(error: AppError): Promise<ErrorContext> {
  const analysis = await analyzeError(error);
  return {
    ...error.toJSON(),
    details: {
      ...error.details,
      analysis: {
        prediction: analysis.prediction,
        suggestions: analysis.suggestions,
        preventiveMeasures: analysis.preventiveMeasures
      }
    }
  };
}
