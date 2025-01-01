import Anthropic from '@anthropic-ai/sdk';
import { AppError } from './errors';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = 'claude-3-5-sonnet-20241022';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new AppError('ANTHROPIC_API_KEY environment variable is not set', 500, 'critical');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ErrorAnalysisResult {
  rootCause: {
    primary: string;
    contributing: string[];
    systemLevel: boolean;
  };
  impact: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedComponents: string[];
    userImpact: string;
  };
  resolution: {
    immediate: string[];
    longTerm: string[];
    prevention: string[];
  };
  technical: {
    components: string[];
    configuration: Record<string, any>;
    performance: string;
  };
}

export async function analyzeError(error: Error, context: Record<string, any> = {}): Promise<ErrorAnalysisResult> {
  try {
    const errorContext = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ...context
    };

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `As an AI expert in debugging enterprise applications, analyze this error and provide detailed insights:

        Error Details:
        ${JSON.stringify(errorContext, null, 2)}

        Please provide analysis in this exact JSON format:
        {
          "rootCause": {
            "primary": "string",
            "contributing": ["string"],
            "systemLevel": boolean
          },
          "impact": {
            "severity": "critical" | "high" | "medium" | "low",
            "affectedComponents": ["string"],
            "userImpact": "string"
          },
          "resolution": {
            "immediate": ["string"],
            "longTerm": ["string"],
            "prevention": ["string"]
          },
          "technical": {
            "components": ["string"],
            "configuration": {},
            "performance": "string"
          }
        }`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (analysisError) {
    console.error('Error analyzing with Claude:', analysisError);
    return {
      rootCause: {
        primary: 'Error analysis failed',
        contributing: ['AI service unavailable'],
        systemLevel: false
      },
      impact: {
        severity: 'low',
        affectedComponents: ['error-analysis'],
        userImpact: 'No direct user impact'
      },
      resolution: {
        immediate: ['Check error manually'],
        longTerm: ['Improve error analysis resilience'],
        prevention: ['Add fallback analysis methods']
      },
      technical: {
        components: ['anthropic-client'],
        configuration: {},
        performance: 'degraded'
      }
    };
  }
}

export interface PurchaseRequestValidationResult {
  isValid: boolean;
  score: number;
  suggestions: string[];
  risks: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export async function validatePurchaseRequest(request: any): Promise<PurchaseRequestValidationResult> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this purchase request and provide validation insights:

        Request Details:
        ${JSON.stringify(request, null, 2)}

        Provide analysis in this exact JSON format:
        {
          "isValid": boolean,
          "score": number,
          "suggestions": ["string"],
          "risks": ["string"],
          "priority": "low" | "medium" | "high" | "urgent"
        }`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Purchase request validation failed:', error);
    return {
      isValid: true, // Fail open to not block valid requests
      score: 0.5,
      suggestions: ['Manual review recommended due to validation error'],
      risks: ['Automated validation unavailable'],
      priority: 'medium'
    };
  }
}