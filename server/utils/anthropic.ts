import { AppError } from './errors';
import { anthropicClient as anthropic, MODEL } from './anthropic-config';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new AppError('ANTHROPIC_API_KEY environment variable is not set', 500, 'critical');
}

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

        Provide a detailed validation analysis in this exact JSON format:
        {
          "isValid": boolean,
          "score": number between 0-1,
          "suggestions": array of improvement suggestions,
          "risks": array of potential risks or concerns,
          "priority": "low" | "medium" | "high" | "urgent"
        }

        Consider these validation rules:
        - Title must be clear and descriptive
        - Description should explain the purpose and necessity
        - Items should have clear names and reasonable quantities/costs
        - Total cost should align with items and purpose
        - Priority should match the business impact`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Purchase request validation failed:', error);
    // Fail open with warnings to not block valid requests
    return {
      isValid: true,
      score: 0.5,
      suggestions: ['Manual review recommended due to validation error'],
      risks: ['Automated validation unavailable'],
      priority: 'medium'
    };
  }
}