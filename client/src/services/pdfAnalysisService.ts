/**
 * PDF Analysis Service
 * 
 * Uses Anthropic Claude to analyze PDF generation issues and make suggestions
 * for improvements. This service centralizes AI-powered PDF analysis and optimization.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { PdfSettings, PdfTemplateConfig } from './pdfService';
import axios from 'axios';

// PDF Analysis result types
export interface PdfAnalysisResult {
  analysis: string;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixedSettings?: Partial<PdfSettings>;
  fixedTemplate?: PdfTemplateConfig;
}

export interface TemplateAnalysisResult {
  analysis: string;
  recommendations: string[];
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
  private anthropic: Anthropic | null = null;
  
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
  private constructor() {
    // Initialize Anthropic client if API key is available
    const anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: anthropicApiKey
      });
    }
  }
  
  /**
   * Initialize Anthropic API key (can be called later if not available at construction)
   */
  public setAnthropicApiKey(apiKey: string): void {
    if (apiKey) {
      this.anthropic = new Anthropic({
        apiKey
      });
    }
  }
  
  /**
   * Analyze PDF template issues
   */
  public async analyzeTemplateIssue(
    templateConfig: PdfTemplateConfig,
    errorMessage: string
  ): Promise<TemplateAnalysisResult> {
    if (!this.anthropic) {
      return this.performLocalAnalysis(templateConfig, errorMessage);
    }
    
    try {
      // Use Anthropic API for analysis
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: "You're an expert in PDF template configuration and generation issues. Analyze the provided template configuration and error message, then provide a concise explanation of the issue and practical recommendations to fix it.",
        messages: [
          {
            role: 'user',
            content: `
              I'm having an issue with a PDF template configuration. Here's the configuration:
              ${JSON.stringify(templateConfig, null, 2)}
              
              And here's the error message:
              ${errorMessage}
              
              Please analyze what might be causing this issue and provide specific recommendations to fix it.
              Format your response with:
              1. Brief analysis of the problem
              2. A bulleted list of specific recommendations to fix the issue
              3. A fixed version of the template configuration in JSON format
            `
          }
        ]
      });
      
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Expected text response from Anthropic API');
      }
      
      // Extract recommendations
      const recommendations: string[] = [];
      const recommendationsMatch = content.text.match(/Recommendations?([\s\S]*?)(?:\n\n|$)/i);
      if (recommendationsMatch) {
        const recText = recommendationsMatch[1];
        const bullets = recText.match(/[•\-\*]\s*([^\n]*)/g);
        if (bullets) {
          recommendations.push(...bullets.map(b => b.replace(/^[•\-\*]\s*/, '')));
        }
      }
      
      // Extract fixed template configuration
      let fixedTemplate: PdfTemplateConfig | undefined;
      const jsonMatch = content.text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch) {
        try {
          fixedTemplate = JSON.parse(jsonMatch[1]);
        } catch (error) {
          console.error('Failed to parse fixed template configuration:', error);
        }
      }
      
      return {
        analysis: content.text,
        recommendations,
        fixedTemplate
      };
    } catch (error) {
      console.error('Error analyzing PDF template issue with Anthropic:', error);
      return this.performLocalAnalysis(templateConfig, errorMessage);
    }
  }
  
  /**
   * Perform local analysis of template issues (fallback when AI is unavailable)
   */
  private performLocalAnalysis(
    templateConfig: PdfTemplateConfig,
    errorMessage: string
  ): TemplateAnalysisResult {
    console.log('Performing local analysis of PDF template issue');
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check for common issues
    if (!templateConfig.name) {
      issues.push('Missing template name');
      recommendations.push('Add a name for the template');
    }
    
    if (!templateConfig.type) {
      issues.push('Missing template type');
      recommendations.push('Set a valid template type (e.g., "standard", "compact")');
    }
    
    // Check for color format issues
    if (templateConfig.headerColor && !Array.isArray(templateConfig.headerColor)) {
      issues.push('Invalid header color format');
      recommendations.push('Ensure headerColor is an array with three RGB values [r, g, b]');
    }
    
    if (templateConfig.accentColor && !Array.isArray(templateConfig.accentColor)) {
      issues.push('Invalid accent color format');
      recommendations.push('Ensure accentColor is an array with three RGB values [r, g, b]');
    }
    
    // Check for watermark issues
    if (templateConfig.showWatermark && typeof templateConfig.watermarkOpacity !== 'number') {
      issues.push('Invalid watermark opacity');
      recommendations.push('Set watermarkOpacity to a number between 0 and 1');
    }
    
    if (templateConfig.showWatermark && !templateConfig.watermarkText) {
      issues.push('Missing watermark text');
      recommendations.push('Add watermarkText when showWatermark is true');
    }
    
    // Create a fixed version of the template
    const fixedTemplate: PdfTemplateConfig = {
      ...templateConfig,
      name: templateConfig.name || 'Standard Template',
      type: templateConfig.type || 'standard',
      layout: templateConfig.layout || 'portrait',
      showHeader: templateConfig.showHeader !== false,
      showFooter: templateConfig.showFooter !== false,
      showLogo: templateConfig.showLogo !== false,
      securityLevel: templateConfig.securityLevel || 'internal',
    };
    
    // Fix colors if needed
    if (templateConfig.headerColor && !Array.isArray(templateConfig.headerColor)) {
      fixedTemplate.headerColor = [111, 42, 230]; // Default purple
    }
    
    if (templateConfig.accentColor && !Array.isArray(templateConfig.accentColor)) {
      fixedTemplate.accentColor = [31, 211, 219]; // Default teal
    }
    
    // Fix watermark if needed
    if (templateConfig.showWatermark) {
      if (typeof templateConfig.watermarkOpacity !== 'number') {
        fixedTemplate.watermarkOpacity = 0.08;
      }
      
      if (!templateConfig.watermarkText) {
        fixedTemplate.watermarkText = 'INTERNAL USE';
      }
    }
    
    return {
      analysis: `Analysis of template issues: ${issues.join(', ')}`,
      recommendations,
      fixedTemplate
    };
  }
  
  /**
   * Analyze PDF generation error
   */
  public async analyzePdfError(
    error: any,
    requestId: number,
    pdfSettings?: PdfSettings
  ): Promise<PdfErrorAnalysisResult> {
    if (!this.anthropic) {
      return this.createBasicErrorAnalysis(error);
    }
    
    try {
      // Get error details
      const errorMessage = error.message || String(error);
      const errorStack = error.stack || '';
      
      // If settings weren't provided, try to fetch them
      let settings = pdfSettings;
      if (!settings) {
        try {
          const settingsResponse = await axios.get('/api/pdf/print-settings');
          settings = settingsResponse.data;
        } catch (settingsError) {
          console.error('Error fetching PDF settings for error analysis:', settingsError);
        }
      }
      
      // Send to Anthropic for analysis
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: "You're an expert in PDF generation troubleshooting. Analyze the provided error and suggest practical solutions.",
        messages: [
          {
            role: 'user',
            content: `
              I encountered an error when generating a PDF for purchase request ${requestId}.
              
              Error: ${errorMessage}
              ${errorStack ? `Stack trace: ${errorStack}` : ''}
              
              PDF Settings: ${settings ? JSON.stringify(settings, null, 2) : 'Not available'}
              
              Please analyze what might be causing this issue and provide specific recommendations to fix it.
              Format your response with:
              1. Brief analysis of the root cause
              2. A bulleted list of specific recommendations to fix the issue
              3. Categorize the likely issue as one of: "data", "template", "code", "network", "permissions", or "unknown"
            `
          }
        ]
      });
      
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Expected text response from Anthropic API');
      }
      
      // Extract recommendations
      const recommendations: string[] = [];
      const recommendationsMatch = content.text.match(/Recommendations?([\s\S]*?)(?:\n\n|$)/i);
      if (recommendationsMatch) {
        const recText = recommendationsMatch[1];
        const bullets = recText.match(/[•\-\*]\s*([^\n]*)/g);
        if (bullets) {
          recommendations.push(...bullets.map(b => b.replace(/^[•\-\*]\s*/, '')));
        }
      }
      
      // Extract likely issue category
      let likelyIssue: 'data' | 'template' | 'code' | 'network' | 'permissions' | 'unknown' = 'unknown';
      const categoryMatch = content.text.match(/likely issue.*?[:"]\s*["']?(\w+)["']?/i);
      if (categoryMatch && categoryMatch[1]) {
        const category = categoryMatch[1].toLowerCase();
        if (['data', 'template', 'code', 'network', 'permissions'].includes(category)) {
          likelyIssue = category as typeof likelyIssue;
        }
      }
      
      // Log the analysis
      try {
        await axios.post('/api/pdf/audit', {
          requestId,
          action: 'pdf_analyzed',
          details: {
            error: errorMessage,
            analysis: content.text,
            recommendations,
            likelyIssue,
            timestamp: new Date().toISOString()
          }
        });
      } catch (auditError) {
        console.error('Error logging PDF error analysis:', auditError);
      }
      
      return {
        error: errorMessage,
        analysis: content.text,
        recommendations,
        likelyIssue
      };
    } catch (analyzeError) {
      console.error('Error analyzing PDF error with Anthropic:', analyzeError);
      return this.createBasicErrorAnalysis(error);
    }
  }
  
  /**
   * Create basic error analysis when AI is unavailable
   */
  private createBasicErrorAnalysis(error: any): PdfErrorAnalysisResult {
    const errorMessage = error.message || String(error);
    
    // Try to determine the issue type from the error message
    let likelyIssue: 'data' | 'template' | 'code' | 'network' | 'permissions' | 'unknown' = 'unknown';
    let recommendations: string[] = [];
    
    if (errorMessage.match(/network|connection|timeout|fetch|axios/i)) {
      likelyIssue = 'network';
      recommendations = [
        'Check your internet connection',
        'Verify the server is running and accessible',
        'Try again after a few moments'
      ];
    } else if (errorMessage.match(/permission|unauthorized|forbidden|auth/i)) {
      likelyIssue = 'permissions';
      recommendations = [
        'Verify you have permission to access this resource',
        'Try logging out and logging back in',
        'Contact an administrator if the issue persists'
      ];
    } else if (errorMessage.match(/template|settings|config|invalid/i)) {
      likelyIssue = 'template';
      recommendations = [
        'Check the PDF template configuration for errors',
        'Try using default template settings',
        'Reset the PDF settings and try again'
      ];
    } else if (errorMessage.match(/data|missing|undefined|null|empty/i)) {
      likelyIssue = 'data';
      recommendations = [
        'Verify all required data is available',
        'Check that the request exists and is accessible',
        'Ensure the request has all necessary fields completed'
      ];
    } else if (errorMessage.match(/jspdf|blob|file|save|download/i)) {
      likelyIssue = 'code';
      recommendations = [
        'Refresh the page and try again',
        'Try using a different browser',
        'Clear your browser cache and cookies'
      ];
    } else {
      recommendations = [
        'Refresh the page and try again',
        'Try using a different browser',
        'Check the browser console for more detailed error information'
      ];
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
    if (!this.anthropic) {
      return {
        analysis: 'AI analysis not available',
        recommendations: [
          'Ensure header and footer colors match your company branding',
          'Set appropriate security level based on document sensitivity',
          'Add a watermark for confidential documents'
        ],
        severity: 'low'
      };
    }
    
    try {
      // Send to Anthropic for analysis
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        system: "You're an expert in PDF design and configuration for enterprise systems. Analyze the provided PDF settings and suggest optimizations for improved readability, professional appearance, and consistency.",
        messages: [
          {
            role: 'user',
            content: `
              Please analyze these PDF settings for our enterprise vendor management system and suggest optimizations:
              
              ${JSON.stringify(pdfSettings, null, 2)}
              
              These settings control how our purchase request PDFs look. I want to ensure they:
              - Have a professional, consistent appearance
              - Follow design best practices for business documents
              - Properly highlight our brand elements
              - Have appropriate security measures
              
              Format your response with:
              1. Brief analysis of the current configuration
              2. A bulleted list of specific optimization recommendations
              3. Severity of issues (low/medium/high/critical)
              4. Suggested updated settings in JSON format for any fields that should be changed
            `
          }
        ]
      });
      
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Expected text response from Anthropic API');
      }
      
      // Extract recommendations
      const recommendations: string[] = [];
      const recommendationsMatch = content.text.match(/Recommendations?([\s\S]*?)(?:\n\n|$)/i);
      if (recommendationsMatch) {
        const recText = recommendationsMatch[1];
        const bullets = recText.match(/[•\-\*]\s*([^\n]*)/g);
        if (bullets) {
          recommendations.push(...bullets.map(b => b.replace(/^[•\-\*]\s*/, '')));
        }
      }
      
      // Extract severity
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      const severityMatch = content.text.match(/severity[:\s]*["']?(\w+)["']?/i);
      if (severityMatch && severityMatch[1]) {
        const extracted = severityMatch[1].toLowerCase();
        if (['low', 'medium', 'high', 'critical'].includes(extracted)) {
          severity = extracted as typeof severity;
        }
      }
      
      // Extract suggested settings
      let fixedSettings: Partial<PdfSettings> | undefined;
      const jsonMatch = content.text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch) {
        try {
          fixedSettings = JSON.parse(jsonMatch[1]);
        } catch (error) {
          console.error('Failed to parse suggested PDF settings:', error);
        }
      }
      
      // Extract suggested template settings
      let fixedTemplate: PdfTemplateConfig | undefined;
      if (fixedSettings?.templateConfig) {
        fixedTemplate = fixedSettings.templateConfig as PdfTemplateConfig;
        // Remove from fixedSettings to avoid duplication
        delete fixedSettings.templateConfig;
      }
      
      return {
        analysis: content.text,
        recommendations,
        severity,
        fixedSettings,
        fixedTemplate
      };
    } catch (error) {
      console.error('Error analyzing PDF settings with Anthropic:', error);
      
      return {
        analysis: 'Failed to perform AI analysis of PDF settings',
        recommendations: [
          'Ensure header and footer colors match your company branding',
          'Set appropriate security level based on document sensitivity',
          'Add a watermark for confidential documents'
        ],
        severity: 'low'
      };
    }
  }
}

// Export singleton instance
export const pdfAnalysisService = PdfAnalysisService.getInstance();