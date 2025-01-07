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

      // Enhanced error analysis using Anthropic
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

          Please provide:
          1. Detailed analysis of the error cause
          2. Technical solutions to fix the preview issue
          3. Alternative preview methods if available
          4. Best practices for handling this file type`
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

      // Enhanced PDF validation using Anthropic
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Analyze this PDF URL and its structure:
          URL: ${pdfUrl}

          Please provide:
          1. URL structure validation for PDF viewing
          2. Required headers and configurations
          3. Security considerations
          4. Cross-browser compatibility requirements
          5. Best practices for PDF embedding
          6. Alternative viewing methods if needed

          Format the response as specific technical recommendations.`
        }]
      });

      const content = response.content[0];
      let analysisText = '';
      if ('text' in content) {
        analysisText = content.text;
      }

      // Parse the analysis into structured suggestions
      const lines = analysisText.split('\n').filter((line: string) => line.trim().length > 0);

      return {
        isValid: !analysisText.toLowerCase().includes('invalid') && !analysisText.toLowerCase().includes('error'),
        suggestions: lines.map(line => line.trim())
      };
    } catch (err) {
      log('Error validating PDF structure:', err instanceof Error ? err.message : String(err));
      throw new FileAnalysisError('Failed to validate PDF structure', err);
    }
  }
}

// Create and export a singleton instance
export const fileAnalysisService = new FileAnalysisService();