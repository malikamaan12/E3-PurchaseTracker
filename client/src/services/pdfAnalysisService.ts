/**
 * PDF Analysis Service
 * 
 * Uses Anthropic Claude to analyze PDF generation issues and make suggestions
 * for improvements. This service centralizes AI-powered PDF analysis and optimization.
 */
import { PdfSettings, PdfTemplateConfig } from './pdfService';

// The Anthropic client is imported from the organization's API
// We're creating a simple interface to abstract implementation details
interface AnthropicClient {
  messages: {
    create: (options: {
      model: string;
      max_tokens: number;
      temperature?: number;
      messages: {
        role: 'user' | 'assistant';
        content: string;
      }[];
    }) => Promise<{
      content: {
        text: string;
      }[];
    }>;
  };
}

export interface TemplateAnalysisResult {
  analysis: string;
  recommendations: string[];
  fixedTemplate?: PdfTemplateConfig;
}

export interface PdfAnalysisResult {
  analysis: string;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixedSettings?: Partial<PdfSettings>;
  fixedTemplate?: PdfTemplateConfig;
}

export interface PdfErrorAnalysisResult {
  error: string;
  analysis: string;
  recommendations: string[];
  likelyIssue: 'data' | 'template' | 'code' | 'network' | 'permissions' | 'unknown';
}

/**
 * PDF Analysis Service class
 */
class PdfAnalysisService {
  private static instance: PdfAnalysisService;
  private anthropic: AnthropicClient | null = null;
  private apiKeySet: boolean = false;

  /**
   * Get the singleton instance
   */
  public static getInstance(): PdfAnalysisService {
    if (!PdfAnalysisService.instance) {
      PdfAnalysisService.instance = new PdfAnalysisService();
    }
    return PdfAnalysisService.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Initialize Anthropic API key (can be called later if not available at construction)
   */
  public setAnthropicApiKey(apiKey: string): void {
    if (!apiKey) return;
    
    try {
      // Attempt to create Anthropic client with API key
      // This is a simplified implementation - in a real app, the actual Anthropic SDK would be used
      this.anthropic = {
        messages: {
          create: async ({ messages, model, max_tokens }) => {
            // Make actual API call to Anthropic here
            // For now, we'll return a placeholder response for simulation purposes
            
            // In a real implementation, this would use the actual Anthropic API
            const response = await fetch('/api/pdf/analyze-template', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages,
                model,
                max_tokens,
              }),
            });
            
            if (!response.ok) {
              throw new Error('Failed to analyze template');
            }
            
            return await response.json();
          }
        }
      };
      
      this.apiKeySet = true;
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
      this.anthropic = null;
      this.apiKeySet = false;
    }
  }

  /**
   * Analyze PDF template issues
   */
  public async analyzeTemplateIssue(
    templateConfig: PdfTemplateConfig,
    currentIssue?: string
  ): Promise<TemplateAnalysisResult> {
    if (!this.anthropic || !this.apiKeySet) {
      console.warn('Anthropic client not initialized, performing local analysis');
      return this.performLocalAnalysis(templateConfig, currentIssue);
    }

    try {
      // Make request to server to analyze with Claude
      const response = await fetch('/api/pdf/analyze-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateConfig,
          currentIssue
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze template');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error analyzing template with Anthropic:', error);
      // Fall back to local analysis
      return this.performLocalAnalysis(templateConfig, currentIssue);
    }
  }

  /**
   * Perform local analysis of template issues (fallback when AI is unavailable)
   */
  private performLocalAnalysis(
    templateConfig: PdfTemplateConfig,
    currentIssue?: string
  ): TemplateAnalysisResult {
    const analysis = currentIssue 
      ? `Analysis of template issue: ${currentIssue}`
      : 'Basic template analysis (AI-powered analysis unavailable)';
    
    const recommendations: string[] = [];
    
    // Check for basic issues
    if (!templateConfig.showHeader && !templateConfig.showFooter) {
      recommendations.push('Consider enabling either header or footer for better document structure');
    }
    
    if (templateConfig.showWatermark && !templateConfig.watermarkText) {
      recommendations.push('Watermark is enabled but no watermark text is specified');
    }
    
    if (templateConfig.showSignatureLines && !templateConfig.showApprovalFlow) {
      recommendations.push('Signature lines are enabled but approval flow is disabled');
    }

    // Prepare fixed template if needed
    const fixedTemplate: PdfTemplateConfig = {
      ...templateConfig,
      // Apply simple fixes
      watermarkText: templateConfig.showWatermark && !templateConfig.watermarkText 
        ? 'CONFIDENTIAL' 
        : templateConfig.watermarkText,
      showApprovalFlow: templateConfig.showSignatureLines 
        ? true 
        : templateConfig.showApprovalFlow
    };

    return {
      analysis,
      recommendations,
      fixedTemplate: recommendations.length > 0 ? fixedTemplate : undefined
    };
  }

  /**
   * Analyze PDF generation error
   */
  public async analyzePdfError(
    error: Error | string,
    pdfSettings?: PdfSettings
  ): Promise<PdfErrorAnalysisResult> {
    if (!this.anthropic || !this.apiKeySet) {
      console.warn('Anthropic client not initialized, performing basic error analysis');
      return this.createBasicErrorAnalysis(error);
    }

    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      
      // Make request to server to analyze with Claude
      const response = await fetch('/api/pdf/analyze-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: errorMessage,
          settings: pdfSettings
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze PDF error');
      }
      
      const result = await response.json();
      return result;
    } catch (e) {
      console.error('Error analyzing PDF error with Anthropic:', e);
      // Fall back to basic analysis
      return this.createBasicErrorAnalysis(error);
    }
  }

  /**
   * Create basic error analysis when AI is unavailable
   */
  private createBasicErrorAnalysis(error: any): PdfErrorAnalysisResult {
    const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
    
    let likelyIssue: 'data' | 'template' | 'code' | 'network' | 'permissions' | 'unknown' = 'unknown';
    const recommendations: string[] = [];
    
    // Simple pattern matching for common errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
      likelyIssue = 'network';
      recommendations.push('Check your network connection');
      recommendations.push('Verify the server is running and accessible');
    } else if (errorMessage.includes('permission') || errorMessage.includes('access denied') || errorMessage.includes('unauthorized')) {
      likelyIssue = 'permissions';
      recommendations.push('Verify you have the necessary permissions');
      recommendations.push('Check if authentication is required');
    } else if (errorMessage.includes('template') || errorMessage.includes('layout')) {
      likelyIssue = 'template';
      recommendations.push('Review the PDF template configuration');
      recommendations.push('Ensure all required template fields are properly set');
    } else if (errorMessage.includes('data') || errorMessage.includes('missing field') || errorMessage.includes('undefined')) {
      likelyIssue = 'data';
      recommendations.push('Check that all required data is provided');
      recommendations.push('Verify data formats and types are correct');
    }
    
    // If no specific recommendations, provide generic ones
    if (recommendations.length === 0) {
      recommendations.push('Try refreshing the page and attempting again');
      recommendations.push('Check server logs for more detailed error information');
    }
    
    return {
      error: errorMessage,
      analysis: `Basic analysis of error: ${errorMessage}`,
      recommendations,
      likelyIssue
    };
  }

  /**
   * Analyze PDF settings for optimization
   */
  public async analyzePdfSettingsForOptimization(
    pdfSettings: PdfSettings
  ): Promise<PdfAnalysisResult> {
    if (!this.anthropic || !this.apiKeySet) {
      console.warn('Anthropic client not initialized, skipping PDF settings optimization');
      return {
        analysis: 'PDF settings optimization not available (AI service not initialized)',
        recommendations: [],
        severity: 'low'
      };
    }

    try {
      // Make request to server to analyze with Claude
      const response = await fetch('/api/pdf/analyze-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: pdfSettings
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze PDF settings');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error analyzing PDF settings with Anthropic:', error);
      
      // Return a simple result when AI analysis fails
      return {
        analysis: 'PDF settings analysis unavailable at this time',
        recommendations: [
          'Ensure header and footer text are appropriate for your organization',
          'Consider adding company contact information to improve professional appearance'
        ],
        severity: 'low'
      };
    }
  }
}

export const pdfAnalysisService = PdfAnalysisService.getInstance();