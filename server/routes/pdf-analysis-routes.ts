/**
 * PDF Analysis Routes
 * 
 * These routes handle AI-powered PDF analysis and optimization
 * using Anthropic Claude for intelligent PDF settings suggestions.
 */

import { Express, Request, Response, NextFunction } from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import { AppError } from '../utils/errors';
import { PdfTemplateConfig } from '../services/PdfService';
import { defaultIfEmpty } from '../utils/helpers';

// Prevent rate limiting by throttling requests
const THROTTLE_MS = 500;
const lastRequestTime: Record<string, number> = {};

// Create Anthropic client
const anthropic = process.env.ANTHROPIC_API_KEY ? 
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Fallback local analysis if Anthropic is not available
function createLocalAnalysis(templateConfig: any, error?: Error) {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Basic validation
  if (!templateConfig || Object.keys(templateConfig).length === 0) {
    issues.push('Empty or invalid template configuration');
    recommendations.push('Provide a valid template configuration');
  } else {
    // Check required fields
    if (!templateConfig.name) {
      issues.push('Template name is missing');
      recommendations.push('Add a name to the template');
    }
    
    if (!templateConfig.layout) {
      issues.push('Template layout is not specified');
      recommendations.push('Specify a layout (portrait or landscape)');
    }
    
    // Check for logical inconsistencies
    if (templateConfig.showHeader === false && templateConfig.showLogo === true) {
      issues.push('Logo enabled but header disabled');
      recommendations.push('Either enable header or disable logo');
    }
    
    if (templateConfig.showWatermark && !templateConfig.watermarkText) {
      issues.push('Watermark enabled but no watermark text specified');
      recommendations.push('Add watermark text or disable watermark');
    }
  }

  // Create a fixed template with best practices
  const fixedTemplate = templateConfig ? {
    ...templateConfig,
    name: templateConfig.name || 'Standard Template',
    type: templateConfig.type || 'standard',
    layout: templateConfig.layout || 'portrait',
    showHeader: defaultIfEmpty(templateConfig.showHeader, true),
    showFooter: defaultIfEmpty(templateConfig.showFooter, true),
    showLogo: defaultIfEmpty(templateConfig.showLogo, true),
    securityLevel: templateConfig.securityLevel || 'standard'
  } : undefined;

  return {
    analysis: issues.length > 0 ? 
      `Found ${issues.length} issues with template: ${issues.join(', ')}` : 
      'No significant issues found with template configuration.',
    recommendations,
    fixedTemplate
  };
}

// Function to throttle requests to prevent rate limiting
function throttleRequest(id: string): Promise<void> {
  const now = Date.now();
  const lastRequest = lastRequestTime[id] || 0;
  const timeSinceLast = now - lastRequest;
  
  if (timeSinceLast < THROTTLE_MS) {
    const waitTime = THROTTLE_MS - timeSinceLast;
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime[id] = now;
  return Promise.resolve();
}

export function registerPdfAnalysisRoutes(app: Express) {
  /**
   * Analyze a PDF template configuration with Claude AI
   */
  app.post('/api/pdf/analyze-template', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateConfig, error } = req.body;
      
      // Throttle to prevent rate limiting
      await throttleRequest('analyze-template');
      
      // If Anthropic is not available, use local analysis
      if (!anthropic) {
        return res.json(createLocalAnalysis(templateConfig, error));
      }
      
      // Create prompt for Claude
      const prompt = `
      You are a PDF template analysis assistant. Please analyze the following PDF template configuration for issues:
      
      Template Configuration:
      ${JSON.stringify(templateConfig, null, 2)}
      
      ${error ? `Error encountered: ${error}` : ''}
      
      Please provide:
      1. A brief analysis of any issues in the template configuration
      2. A list of recommendations to improve the template
      3. A fixed version of the template as a JSON object
      
      Format your response as a JSON object with these keys: 
      "analysis", "recommendations" (as an array of strings), and "fixedTemplate" (as an object).
      `;
      
      // Send request to Claude
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      // Parse Claude's response
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysisResult = JSON.parse(jsonMatch[0]);
        return res.json(analysisResult);
      }
      
      throw new Error('Could not parse Claude response');
    } catch (error) {
      console.error('Error analyzing PDF template:', error);
      // Fallback to local analysis on error
      return res.json(createLocalAnalysis(req.body.templateConfig, req.body.error));
    }
  });
  
  /**
   * Analyze PDF settings with Claude AI
   */
  app.post('/api/pdf/analyze-settings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { settings } = req.body;
      
      // Throttle to prevent rate limiting
      await throttleRequest('analyze-settings');
      
      // If Anthropic is not available, use local analysis
      if (!anthropic) {
        return res.json({
          analysis: 'Basic analysis performed (Claude AI not available)',
          recommendations: [
            'Ensure all required fields are populated',
            'Consider adding company branding elements like logos',
            'Use watermarks for confidential documents'
          ],
          severity: 'low',
          fixedSettings: settings
        });
      }
      
      // Create prompt for Claude
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
      
      // Send request to Claude
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      // Parse Claude's response
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysisResult = JSON.parse(jsonMatch[0]);
        return res.json(analysisResult);
      }
      
      throw new Error('Could not parse Claude response');
    } catch (error) {
      console.error('Error analyzing PDF settings:', error);
      // Return a basic response on error
      return res.json({
        analysis: 'Error performing advanced analysis',
        recommendations: ['Check for undefined or missing values in settings'],
        severity: 'medium',
        fixedSettings: req.body.settings
      });
    }
  });
  
  /**
   * Analyze PDF generation error with Claude AI
   */
  app.post('/api/pdf/analyze-error', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, settings } = req.body;
      
      // Throttle to prevent rate limiting
      await throttleRequest('analyze-error');
      
      // If Anthropic is not available, use local analysis
      if (!anthropic) {
        return res.json({
          error: error.message,
          analysis: 'Basic error analysis (Claude AI not available)',
          recommendations: ['Check for undefined values', 'Verify template configuration'],
          likelyIssue: 'unknown'
        });
      }
      
      // Create prompt for Claude
      const prompt = `
      You are a PDF generation troubleshooting assistant. Please analyze the following error:
      
      Error: ${error.message}
      ${error.stack ? `Stack: ${error.stack}` : ''}
      
      ${settings ? `PDF Settings: ${JSON.stringify(settings, null, 2)}` : ''}
      
      Please provide:
      1. A brief analysis of what might be causing this error
      2. A categorization of the likely issue (data, template, code, network, permissions, or unknown)
      3. A list of recommendations to fix the issue
      
      Format your response as a JSON object with these keys: 
      "error", "analysis", "recommendations" (as an array of strings), and "likelyIssue".
      `;
      
      // Send request to Claude
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      // Parse Claude's response
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysisResult = JSON.parse(jsonMatch[0]);
        return res.json(analysisResult);
      }
      
      throw new Error('Could not parse Claude response');
    } catch (error) {
      console.error('Error analyzing PDF error:', error);
      // Return a basic response on error
      return res.json({
        error: req.body.error?.message || 'Unknown error',
        analysis: 'Error performing advanced analysis',
        recommendations: ['Check console for detailed error information'],
        likelyIssue: 'unknown'
      });
    }
  });
}