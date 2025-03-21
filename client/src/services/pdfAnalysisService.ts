/**
 * PDF Analysis Service
 * 
 * Uses Anthropic Claude to analyze PDF generation issues and make suggestions
 * for improvements. This service centralizes AI-powered PDF analysis and optimization.
 */
import axios from 'axios';
import { PdfSettings, PdfTemplateConfig } from './pdfService';

// Import Anthropic SDK if available, or use a compatibility wrapper
let Anthropic: any;
try {
  // Try to import the official SDK
  const AnthropicModule = require('@anthropic-ai/sdk');
  Anthropic = AnthropicModule.default || AnthropicModule;
} catch (error) {
  // Fallback to a compatibility wrapper
  Anthropic = null;
}

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
      if (Anthropic) {
        this.anthropic = new Anthropic({ apiKey });
        this.apiKeySet = true;
      }
    } catch (error) {
      console.error('Error initializing Anthropic SDK:', error);
      this.anthropic = null;
      this.apiKeySet = false;
    }
  }

  /**
   * Analyze PDF template issues
   */
  public async analyzeTemplateIssue(
    templateConfig: PdfTemplateConfig,
    errorContext?: string
  ): Promise<TemplateAnalysisResult> {
    // If Anthropic is not available, perform a local analysis
    if (!this.anthropic || !this.apiKeySet) {
      return this.performLocalAnalysis(templateConfig, errorContext);
    }

    try {
      // Use server-side endpoint if available
      const response = await axios.post('/api/pdf/analyze-template', {
        templateConfig,
        errorContext
      });
      
      return response.data;
    } catch (error) {
      console.error('Error analyzing template with server-side AI:', error);
      
      // Fallback to local analysis
      return this.performLocalAnalysis(templateConfig, errorContext);
    }
  }

  /**
   * Perform local analysis of template issues (fallback when AI is unavailable)
   */
  private performLocalAnalysis(
    templateConfig: PdfTemplateConfig,
    errorContext?: string
  ): TemplateAnalysisResult {
    const recommendations: string[] = [];
    
    // Basic template validation
    if (!templateConfig.showHeader && !templateConfig.showFooter) {
      recommendations.push('Enable either header or footer for better document structure');
    }
    
    if (templateConfig.showWatermark && !templateConfig.watermarkText) {
      recommendations.push('Add watermark text since watermark display is enabled');
    }
    
    if (templateConfig.type === 'complex' && !templateConfig.showTotalsTable) {
      recommendations.push('Enable totals table for complex document types');
    }
    
    const analysisText = errorContext 
      ? `Template analysis based on error context: ${errorContext}`
      : 'Basic template analysis completed with limited capabilities';
    
    // Basic fixes for template issues
    const fixedTemplate: PdfTemplateConfig = {
      ...templateConfig
    };
    
    if (!templateConfig.showHeader && !templateConfig.showFooter) {
      fixedTemplate.showHeader = true;
    }
    
    if (templateConfig.showWatermark && !templateConfig.watermarkText) {
      fixedTemplate.watermarkText = 'CONFIDENTIAL';
    }
    
    return {
      analysis: analysisText,
      recommendations,
      fixedTemplate: recommendations.length > 0 ? fixedTemplate : undefined
    };
  }

  /**
   * Analyze PDF generation error
   */
  public async analyzePdfError(
    error: Error | string,
    context?: Record<string, any>,
    pdfSettings?: PdfSettings
  ): Promise<PdfErrorAnalysisResult> {
    // If Anthropic is not available, perform a local analysis
    if (!this.anthropic || !this.apiKeySet) {
      return this.createBasicErrorAnalysis(error, context);
    }
    
    try {
      // Use server-side endpoint if available
      const response = await axios.post('/api/pdf/analyze-error', {
        error: typeof error === 'string' ? error : error.message,
        stack: error instanceof Error ? error.stack : undefined,
        context,
        pdfSettings
      });
      
      return response.data;
    } catch (apiError) {
      console.error('Error analyzing PDF error with server-side AI:', apiError);
      
      // Fallback to local analysis
      return this.createBasicErrorAnalysis(error, context);
    }
  }

  /**
   * Create basic error analysis when AI is unavailable
   */
  private createBasicErrorAnalysis(
    error: Error | string,
    context?: Record<string, any>
  ): PdfErrorAnalysisResult {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    // Simple error classification based on keywords
    let likelyIssue: 'data' | 'template' | 'code' | 'network' | 'permissions' | 'unknown' = 'unknown';
    const recommendations: string[] = [];
    
    if (errorMessage.includes('permission') || errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
      likelyIssue = 'permissions';
      recommendations.push('Check if you have the necessary permissions to access the resource');
      recommendations.push('Verify your authentication credentials');
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      likelyIssue = 'network';
      recommendations.push('Check your internet connection');
      recommendations.push('Verify the server is reachable and responding');
    } else if (errorMessage.includes('template') || errorMessage.includes('layout')) {
      likelyIssue = 'template';
      recommendations.push('Verify template configuration is valid');
      recommendations.push('Check for missing required template properties');
    } else if (errorMessage.includes('data') || errorMessage.includes('missing') || errorMessage.includes('undefined')) {
      likelyIssue = 'data';
      recommendations.push('Ensure all required data is provided for PDF generation');
      recommendations.push('Check for null or undefined values in the data');
    } else if (errorMessage.includes('syntax') || errorMessage.includes('reference') || errorMessage.includes('type')) {
      likelyIssue = 'code';
      recommendations.push('Check for syntax errors in PDF generation code');
      recommendations.push('Verify all variable references are valid');
    }
    
    // If we couldn't classify it, provide generic recommendations
    if (recommendations.length === 0) {
      recommendations.push('Check server logs for more detailed error information');
      recommendations.push('Verify PDF settings configuration');
      recommendations.push('Ensure all required data is available for PDF generation');
    }
    
    return {
      error: errorMessage,
      analysis: `Basic error analysis: ${errorMessage}`,
      recommendations,
      likelyIssue
    };
  }

  /**
   * Analyze PDF settings for optimization
   */
  public async analyzePdfSettingsForOptimization(
    settings: PdfSettings
  ): Promise<PdfAnalysisResult> {
    // If Anthropic is not available, perform a local analysis
    if (!this.anthropic || !this.apiKeySet) {
      return this.createBasicSettingsAnalysis(settings);
    }
    
    try {
      // Use server-side endpoint if available
      const response = await axios.post('/api/pdf/analyze-settings', {
        settings
      });
      
      return response.data;
    } catch (error) {
      console.error('Error analyzing PDF settings with server-side AI:', error);
      
      // Fallback to local analysis
      return this.createBasicSettingsAnalysis(settings);
    }
  }

  /**
   * Create basic settings analysis when AI is unavailable
   */
  private createBasicSettingsAnalysis(settings: PdfSettings): PdfAnalysisResult {
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Basic settings validation
    if (!settings.headerTitle || settings.headerTitle.trim() === '') {
      recommendations.push('Add a header title for better document identification');
      severity = 'medium';
    }
    
    if (settings.useWatermark && (!settings.watermarkText || settings.watermarkText.trim() === '')) {
      recommendations.push('Add watermark text since watermark is enabled');
    }
    
    if (!settings.companyAddress && !settings.companyPhone && !settings.companyEmail && !settings.companyWebsite) {
      recommendations.push('Consider adding company contact information for more professional PDFs');
    }
    
    // Font size checks
    if (settings.fontSize && (settings.fontSize < 8 || settings.fontSize > 16)) {
      recommendations.push('Adjust font size to be between 8pt and 16pt for better readability');
    }
    
    // Check if the margins are set properly
    if (settings.marginLeft !== undefined && 
        settings.marginRight !== undefined && 
        settings.marginTop !== undefined && 
        settings.marginBottom !== undefined) {
      const totalHorizontalMargin = settings.marginLeft + settings.marginRight;
      const totalVerticalMargin = settings.marginTop + settings.marginBottom;
      
      if (totalHorizontalMargin > 80) {
        recommendations.push('Horizontal margins are too large, consider reducing them');
      }
      
      if (totalVerticalMargin > 80) {
        recommendations.push('Vertical margins are too large, consider reducing them');
      }
    }
    
    // Create the analysis result
    const analysisText = recommendations.length > 0
      ? 'Several opportunities for improvement were found in your PDF settings.'
      : 'Your PDF settings look good, no significant issues found.';
    
    return {
      analysis: analysisText,
      recommendations,
      severity,
      fixedSettings: recommendations.length > 0 ? this.createFixedSettings(settings, recommendations) : undefined
    };
  }

  /**
   * Create fixed settings based on recommendations
   */
  private createFixedSettings(
    settings: PdfSettings,
    recommendations: string[]
  ): Partial<PdfSettings> {
    const fixedSettings: Partial<PdfSettings> = { ...settings };
    
    // Apply fixes based on recommendations
    if (recommendations.some(r => r.includes('header title'))) {
      fixedSettings.headerTitle = 'Purchase Request';
    }
    
    if (recommendations.some(r => r.includes('watermark text'))) {
      fixedSettings.watermarkText = 'CONFIDENTIAL';
    }
    
    if (recommendations.some(r => r.includes('font size'))) {
      fixedSettings.fontSize = 10;
    }
    
    if (recommendations.some(r => r.includes('horizontal margins'))) {
      fixedSettings.marginLeft = 25;
      fixedSettings.marginRight = 25;
    }
    
    if (recommendations.some(r => r.includes('vertical margins'))) {
      fixedSettings.marginTop = 25;
      fixedSettings.marginBottom = 25;
    }
    
    return fixedSettings;
  }
}

export const pdfAnalysisService = PdfAnalysisService.getInstance();