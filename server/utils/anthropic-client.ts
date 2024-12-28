import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
let anthropicClient: Anthropic | null = null;
let initializationAttempts = 0;
const MAX_RETRIES = 3;

// Simple in-memory cache
const cache = new Map<string, {
  result: any,
  timestamp: number
}>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;
const RATE_LIMIT_DELAY = 200; // 200ms between requests

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      await request();
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  isProcessingQueue = false;
}

export async function initializeAnthropicClient(): Promise<Anthropic | null> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("ANTHROPIC_API_KEY not set. AI-powered analysis will be disabled.");
      return null;
    }

    if (anthropicClient) {
      return anthropicClient;
    }

    if (initializationAttempts >= MAX_RETRIES) {
      console.error(`Failed to initialize Anthropic client after ${MAX_RETRIES} attempts`);
      return null;
    }

    initializationAttempts++;

    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    return anthropicClient;
  } catch (error) {
    console.error("Failed to initialize Anthropic client:", error);
    if (initializationAttempts < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000 * initializationAttempts));
      return initializeAnthropicClient();
    }
    return null;
  }
}

export async function getAnthropicClient(): Promise<Anthropic | null> {
  if (!anthropicClient) {
    return initializeAnthropicClient();
  }
  return anthropicClient;
}

function getCacheKey(action: string, params: any): string {
  return `${action}:${JSON.stringify(params)}`;
}

async function queueRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await request();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    processQueue();
  });
}

export async function analyzeError(error: Error | string | unknown, context: string): Promise<string> {
  const cacheKey = getCacheKey('analyzeError', { error: String(error), context });
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  const client = await getAnthropicClient();
  if (!client) {
    return `Error occurred in ${context}. AI analysis unavailable.`;
  }

  return queueRequest(cacheKey, async () => {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Analyze this error from context "${context}":
          Error: ${errorMessage}
          Stack: ${errorStack || 'No stack trace available'}`
        }]
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response format');
      }

      const result = content.text;
      cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error("Error analyzing with Anthropic:", error);
      return `Error occurred in ${context}. Analysis failed.`;
    }
  });
}

interface AnalysisResult {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  score: number;
  recommendations?: string[];
}

export async function analyzePurchaseRequest(request: any): Promise<AnalysisResult> {
  const cacheKey = getCacheKey('analyzePurchaseRequest', request);
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  const client = await getAnthropicClient();
  if (!client) {
    return {
      priority: 'medium',
      reason: 'Unable to analyze request - AI service unavailable',
      score: 50
    };
  }

  return queueRequest(cacheKey, async () => {
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

      const result = JSON.parse(content.text);
      cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error analyzing purchase request:', error);
      return {
        priority: 'medium',
        reason: 'Failed to analyze priority - defaulting to medium',
        score: 50
      };
    }
  });
}

export async function analyzeUIComponent(
  componentCode: string,
  errorDescription: string
): Promise<{
  issues: string[];
  recommendations: string[];
  fixedCode?: string;
}> {
  const cacheKey = getCacheKey('analyzeUIComponent', { componentCode, errorDescription });
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  const client = await getAnthropicClient();
  if (!client) {
    return {
      issues: ['AI analysis unavailable'],
      recommendations: ['Manual review required']
    };
  }

  return queueRequest(cacheKey, async () => {
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

      const result = JSON.parse(content.text);
      cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error analyzing UI component:', error);
      return {
        issues: ['Analysis failed'],
        recommendations: ['Manual review required']
      };
    }
  });
}