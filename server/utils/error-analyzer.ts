import { AppError, ErrorContext } from './errors';
import { Anthropic } from '@anthropic-ai/sdk';
import { z } from 'zod';

// Validation schema for AI suggestions
const errorAnalysisSchema = z.object({
  prediction: z.string(),
  suggestions: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  preventiveMeasures: z.array(z.string()),
  databaseRecommendations: z.array(z.string()).optional(),
  schemaValidation: z.object({
    hasSchemaIssue: z.boolean(),
    affectedColumns: z.array(z.string())
  }).optional()
});

type ErrorAnalysis = z.infer<typeof errorAnalysisSchema>;

// Initialize Anthropic client with error handling
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

    const prompt = `Analyze this error and provide detailed recommendations:
Error: ${JSON.stringify(errorContext, null, 2)}

Please analyze for:
1. Potential root causes with focus on database schema and validation
2. Specific suggestions to fix the issue
3. Severity assessment
4. Preventive measures
5. If database related, specific schema recommendations
6. Schema validation issues if present

Format as JSON:
{
  "prediction": "string",
  "suggestions": ["string"],
  "severity": "low|medium|high|critical",
  "preventiveMeasures": ["string"],
  "databaseRecommendations": ["string"],
  "schemaValidation": {
    "hasSchemaIssue": boolean,
    "affectedColumns": ["string"]
  }
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [{ 
        role: 'user', 
        content: prompt 
      }]
    });

    // Handle the response content properly
    if (!response.content || !response.content[0] || typeof response.content[0].text !== 'string') {
      throw new Error('Invalid response format from Anthropic API');
    }

    const analysisText = response.content[0].text;
    // Parse and validate the response
    const analysis = JSON.parse(analysisText);
    return errorAnalysisSchema.parse(analysis);
  } catch (analysisError) {
    console.error('Error analysis failed:', analysisError);
    // Provide a fallback analysis if AI fails
    return {
      prediction: 'Unable to analyze error',
      suggestions: ['Please check the error message and stack trace'],
      severity: 'medium',
      preventiveMeasures: ['Ensure all validation is in place', 'Check input data'],
      databaseRecommendations: ['Verify schema consistency', 'Check column definitions'],
      schemaValidation: {
        hasSchemaIssue: true,
        affectedColumns: []
      }
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
        preventiveMeasures: analysis.preventiveMeasures,
        databaseRecommendations: analysis.databaseRecommendations,
        schemaValidation: analysis.schemaValidation
      }
    }
  };
}