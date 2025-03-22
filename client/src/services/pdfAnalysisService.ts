/**
 * PDF Analysis Service
 * 
 * Uses Anthropic Claude to analyze PDF generation issues and make suggestions
 * for improvements. This service centralizes AI-powered PDF analysis and optimization.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { PdfSettings, PdfTemplateConfig, DEFAULT_PDF_SETTINGS } from './pdfService';
import axios from 'axios';

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
      this.anthropic = new Anthropic({ apiKey }) as unknown as AnthropicClient;
      this.apiKeySet = true;
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
      this.apiKeySet = false;
    }
  }

  /**
   * Analyze PDF template issues
   */
  public async analyzeTemplateIssue(
    templateConfig: PdfTemplateConfig,
    error?: Error
  ): Promise<TemplateAnalysisResult> {
    if (!this.apiKeySet || !this.anthropic) {
      return this.performLocalAnalysis(templateConfig, error);
    }

    try {
      const prompt = `
      You are a PDF template analysis assistant. Please analyze the following PDF template configuration for issues:
      
      Template Configuration:
      ${JSON.stringify(templateConfig, null, 2)}
      
      ${error ? `Error encountered: ${error.message}` : ''}
      
      Please provide:
      1. A brief analysis of any issues in the template configuration
      2. A list of recommendations to improve the template
      3. A fixed version of the template as a JSON object
      
      Format your response as a JSON object with these keys: 
      "analysis", "recommendations" (as an array of strings), and "fixedTemplate" (as an object).
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as TemplateAnalysisResult;
        return result;
      }

      throw new Error('Could not parse Claude response');
    } catch (error) {
      console.error('Error analyzing PDF template with Claude:', error);
      return this.performLocalAnalysis(templateConfig, error as Error);
    }
  }

  /**
   * Perform local analysis of template issues (fallback when AI is unavailable)
   */
  private performLocalAnalysis(
    templateConfig: PdfTemplateConfig,
    error?: Error
  ): TemplateAnalysisResult {
    // Basic validation logic - check for required fields and sensible values
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for required fields
    if (!templateConfig.name) {
      issues.push('Template name is missing');
      recommendations.push('Add a name to the template for identification');
    }

    if (!templateConfig.layout) {
      issues.push('Template layout is not specified');
      recommendations.push('Choose a layout type (portrait or landscape)');
    }

    // Check for logical configuration issues
    if (templateConfig.showHeader === false && templateConfig.showLogo === true) {
      issues.push('Logo is enabled but header is disabled');
      recommendations.push('Either enable the header or disable the logo');
    }

    if (templateConfig.showWatermark && 
        (!templateConfig.watermarkText || templateConfig.watermarkOpacity === undefined)) {
      issues.push('Watermark is enabled but watermark text or opacity is not set');
      recommendations.push('Add watermark text and set an appropriate opacity (e.g., 0.2)');
    }

    // Create fixed template based on issues found
    const fixedTemplate: PdfTemplateConfig = {
      ...templateConfig,
      name: templateConfig.name || 'Default Template',
      type: templateConfig.type || 'standard',
      layout: templateConfig.layout || 'portrait',
      showHeader: templateConfig.showHeader !== false, // Default to true if undefined
      showFooter: templateConfig.showFooter !== false, // Default to true if undefined
      showLogo: templateConfig.showLogo !== false, // Default to true if undefined
      showWatermark: Boolean(templateConfig.showWatermark),
      securityLevel: templateConfig.securityLevel || 'standard',
      watermarkText: templateConfig.showWatermark ? (templateConfig.watermarkText || 'CONFIDENTIAL') : undefined,
      watermarkOpacity: templateConfig.showWatermark ? (templateConfig.watermarkOpacity || 0.2) : undefined
    };

    // Create a simple analysis message
    const analysis = issues.length > 0
      ? `Found ${issues.length} issues with the PDF template configuration: ${issues.join(', ')}.`
      : 'No major issues found with the PDF template configuration.';

    return {
      analysis,
      recommendations,
      fixedTemplate
    };
  }

  /**
   * Analyze PDF generation error
   */
  public async analyzePdfError(
    error: Error,
    pdfSettings?: PdfSettings
  ): Promise<PdfErrorAnalysisResult> {
    if (!this.apiKeySet || !this.anthropic) {
      return this.createBasicErrorAnalysis(error, pdfSettings);
    }

    try {
      const prompt = `
      You are a PDF generation troubleshooting assistant. Please analyze the following error:
      
      Error: ${error.message}
      ${error.stack ? `Stack: ${error.stack}` : ''}
      
      ${pdfSettings ? `PDF Settings: ${JSON.stringify(pdfSettings, null, 2)}` : ''}
      
      Please provide:
      1. A brief analysis of what might be causing this error
      2. A categorization of the likely issue (data, template, code, network, permissions, or unknown)
      3. A list of recommendations to fix the issue
      
      Format your response as a JSON object with these keys: 
      "error", "analysis", "recommendations" (as an array of strings), and "likelyIssue".
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as PdfErrorAnalysisResult;
        return result;
      }

      throw new Error('Could not parse Claude response');
    } catch (error) {
      console.error('Error analyzing PDF error with Claude:', error);
      return this.createBasicErrorAnalysis(error as Error, pdfSettings);
    }
  }

  /**
   * Create basic error analysis when AI is unavailable
   */
  private createBasicErrorAnalysis(
    error: Error,
    pdfSettings?: PdfSettings
  ): PdfErrorAnalysisResult {
    // Analyze error message for common patterns
    const errorMsg = error.message.toLowerCase();
    let likelyIssue: 'data' | 'template' | 'code' | 'network' | 'permissions' | 'unknown' = 'unknown';
    const recommendations: string[] = [];

    if (errorMsg.includes('undefined') || errorMsg.includes('null')) {
      likelyIssue = 'data';
      recommendations.push('Check for missing or undefined values in the PDF settings');
      recommendations.push('Initialize all required settings with default values');
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('request')) {
      likelyIssue = 'network';
      recommendations.push('Verify network connectivity');
      recommendations.push('Check if the API endpoint is accessible');
    } else if (errorMsg.includes('permission') || errorMsg.includes('access') || errorMsg.includes('denied')) {
      likelyIssue = 'permissions';
      recommendations.push('Verify you have the correct permissions to access the resource');
    } else if (errorMsg.includes('template') || errorMsg.includes('layout')) {
      likelyIssue = 'template';
      recommendations.push('Check the PDF template configuration for errors');
      recommendations.push('Verify all required template fields are specified');
    } else {
      recommendations.push('Check the console for detailed error information');
      recommendations.push('Verify all PDF settings are properly initialized');
    }

    return {
      error: error.message,
      analysis: `The error appears to be related to ${likelyIssue} issues. ${error.message}`,
      recommendations,
      likelyIssue
    };
  }

  /**
   * Analyze PDF settings for improvement
   */
  public async analyzePdfSettings(
    settings: Partial<PdfSettings>
  ): Promise<PdfAnalysisResult> {
    if (!this.apiKeySet || !this.anthropic) {
      return this.createBasicSettingsAnalysis(settings);
    }

    try {
      const prompt = `
      You are a PDF settings optimization assistant. Please analyze the following PDF settings:
      
      PDF Settings:
      ${JSON.stringify(settings, null, 2)}
      
      Please provide:
      1. A brief analysis of the current settings
      2. A severity assessment (low, medium, high, critical) of any issues
      3. A list of recommendations to improve the settings
      4. Suggested fixed settings as a JSON object
      
      Format your response as a JSON object with these keys: 
      "analysis", "severity", "recommendations" (as an array of strings), and "fixedSettings" (as an object).
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as PdfAnalysisResult;
        return result;
      }

      throw new Error('Could not parse Claude response');
    } catch (error) {
      console.error('Error analyzing PDF settings with Claude:', error);
      return this.createBasicSettingsAnalysis(settings);
    }
  }

  /**
   * Create basic settings analysis when AI is unavailable
   */
  private createBasicSettingsAnalysis(
    settings: Partial<PdfSettings>
  ): PdfAnalysisResult {
    // Basic validation logic - check for required fields and sensible values
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for required fields
    if (!settings.headerTitle) {
      recommendations.push('Add a header title for better document identification');
      severity = 'medium';
    }

    // Create improved settings based on best practices
    const improvedSettings: Partial<PdfSettings> = {
      ...settings,
      headerTitle: settings.headerTitle || 'Purchase Request',
      pageNumbering: settings.pageNumbering !== false, // Default to true
      fontSize: settings.fontSize || 10,
      marginTop: settings.marginTop || 25,
      marginBottom: settings.marginBottom || 25,
      marginLeft: settings.marginLeft || 25,
      marginRight: settings.marginRight || 25,
    };

    // Add relevant recommendations
    if (!settings.logo && settings.showLogo !== false) {
      recommendations.push('Add a company logo for better branding');
    }

    if (!settings.watermarkText && settings.useWatermark) {
      recommendations.push('Add watermark text for documents that need confidentiality marking');
    }

    // Create analysis message
    const analysis = recommendations.length > 0
      ? `Found ${recommendations.length} potential improvements for your PDF settings.`
      : 'Your PDF settings look good, but there are still minor improvements possible.';

    return {
      analysis,
      recommendations,
      severity,
      fixedSettings: improvedSettings
    };
  }

  /**
   * Analyze PDF settings server-side (uses backend route)
   */
  public async analyzeSettingsWithBackend(
    settings: Partial<PdfSettings>
  ): Promise<PdfAnalysisResult> {
    try {
      const response = await axios.post('/api/pdf/analyze-settings', { settings });
      return response.data as PdfAnalysisResult;
    } catch (error) {
      console.error('Error analyzing PDF settings with backend:', error);
      return this.createBasicSettingsAnalysis(settings);
    }
  }
}

export const pdfAnalysisService = PdfAnalysisService.getInstance();