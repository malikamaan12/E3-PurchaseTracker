import axios from 'axios';
import type { ChatCompletionCreateParams } from 'openai/resources/chat';
import { debug } from '../utils/debug';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

export class DeepseekService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  async chat(params: ChatCompletionCreateParams) {
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

      return response.data;
    } catch (error) {
      debug(null, 'Error in Deepseek chat completion:', error);
      throw this.handleError(error);
    }
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
          role: 'user',
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
