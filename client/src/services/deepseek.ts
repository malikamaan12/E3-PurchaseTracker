import axios from 'axios';

const DEEPSEEK_API_ENDPOINT = 'https://api.deepseek.com/v1';

export class DeepseekService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (!this.apiKey) {
      throw new Error('Deepseek API key not found in environment variables');
    }
  }

  private async makeRequest(endpoint: string, payload: any) {
    try {
      const response = await axios.post(`${DEEPSEEK_API_ENDPOINT}${endpoint}`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Deepseek API error: ${error.response.data.message || error.response.statusText}`);
      }
      throw error;
    }
  }

  async generateText(prompt: string) {
    return this.makeRequest('/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });
  }

  async generateImage(prompt: string) {
    return this.makeRequest('/images/generations', {
      prompt,
      n: 1,
      size: '1024x1024',
    });
  }

  async analyzeImage(imageUrl: string, prompt: string) {
    return this.makeRequest('/images/analysis', {
      image: imageUrl,
      prompt,
    });
  }

  async embeddingGeneration(text: string) {
    return this.makeRequest('/embeddings', {
      model: 'deepseek-embedding',
      input: text,
    });
  }
}

// Create a singleton instance
export const deepseekService = new DeepseekService();
