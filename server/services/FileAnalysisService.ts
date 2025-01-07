import Anthropic from '@anthropic-ai/sdk';
import { log } from '../vite';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class FileAnalysisError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'FileAnalysisError';
  }
}

export class FileAnalysisService {
  static async analyzeFilePreviewError(error: Error, fileType: string, preview: any): Promise<string> {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new FileAnalysisError('Anthropic API key not configured');
      }

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Analyze this file preview error and suggest solutions:
          Error: ${error.message}
          Stack: ${error.stack}
          File Type: ${fileType}
          Preview Context: ${JSON.stringify(preview)}

          Please provide a technical analysis of what might be wrong and how to fix it.`
        }]
      });

      const content = response.content[0];
      if ('text' in content) {
        return content.text;
      }
      return 'No analysis available';
    } catch (err) {
      log('Error analyzing file preview:', err instanceof Error ? err.message : String(err));
      throw new FileAnalysisError('Failed to analyze file preview error', err);
    }
  }

  static async validatePDFStructure(pdfUrl: string): Promise<{
    isValid: boolean;
    suggestions: string[];
  }> {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new FileAnalysisError('Anthropic API key not configured');
      }

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Analyze this PDF URL and its structure:
          URL: ${pdfUrl}

          Please check:
          1. If the URL structure is correct for PDF viewing
          2. What headers and configurations might be needed
          3. Best practices for embedding this PDF

          Provide specific technical recommendations.`
        }]
      });

      const content = response.content[0];
      let analysisText = '';
      if ('text' in content) {
        analysisText = content.text;
      }

      const lines = analysisText.split('\n').filter((line: string) => line.trim().length > 0);

      return {
        isValid: !analysisText.toLowerCase().includes('invalid') && !analysisText.toLowerCase().includes('error'),
        suggestions: lines
      };
    } catch (err) {
      log('Error validating PDF structure:', err instanceof Error ? err.message : String(err));
      throw new FileAnalysisError('Failed to validate PDF structure', err);
    }
  }
}

// Create and export a singleton instance
export const fileAnalysisService = new FileAnalysisService();