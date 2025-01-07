import axios from 'axios';
import { debug } from '../utils/debug';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export class DeepseekService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.REPLIT_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }
  }

  async chat(params: ChatCompletionParams) {
    try {
      const response = await axios.post(
        `${DEEPSEEK_API_URL}/chat/completions`,
        params,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      debug('Error in Deepseek chat completion:', error);
      throw this.handleError(error);
    }
  }

  async getCompletion(prompt: string, options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }) {
    const defaultOptions = {
      temperature: 0.7,
      max_tokens: 1000,
      model: 'deepseek-chat'
    };

    const params = {
      ...defaultOptions,
      ...options,
      messages: [
        {
          role: 'user' as const,
          content: prompt
        }
      ]
    };

    return this.chat(params);
  }

  async analyze(text: string, options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }) {
    const defaultOptions = {
      temperature: 0.7,
      max_tokens: 1000,
      model: 'deepseek-chat'
    };

    const params = {
      ...defaultOptions,
      ...options,
      messages: [
        {
          role: 'user' as const,
          content: text
        }
      ]
    };

    return this.chat(params);
  }

  private handleError(error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      switch (status) {
        case 401:
          return new Error('Invalid Deepseek API key');
        case 429:
          return new Error('Rate limit exceeded');
        case 500:
          return new Error('Deepseek API server error');
        default:
          return new Error(`Deepseek API error: ${message}`);
      }
    }
    return error;
  }
}

// Create a singleton instance
export const deepseekService = new DeepseekService();