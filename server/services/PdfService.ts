/**
 * PDF Service
 * 
 * A centralized service for PDF generation, management, and analysis.
 * This service abstracts all PDF-related functionality to ensure consistency
 * and avoid code duplication across the application.
 * 
 * Features:
 * - Standardized PDF generation with consolidated format
 * - PDF settings management
 * - AI-powered PDF template optimization
 * - PDF audit logging
 * - Export validation and tracking
 */

import { db } from '@db/index';
import { pdfSettings, auditLogs, purchaseRequests } from '@db/schema';
import { eq, desc } from 'drizzle-orm';
import { AppError, ValidationError } from '../utils/errors';
import { Request } from 'express';
import { anthropicClient, MODEL } from '../utils/anthropic-config';
import { PurchaseRequestWithRelations } from '@db/schema';

// PDF Template configuration interface
export interface PdfTemplateConfig {
  name: string;
  type: string;
  layout: string;
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
  showWatermark: boolean;
  securityLevel: string;
  headerColor?: number[];
  accentColor?: number[];
  watermarkOpacity?: number;
  watermarkText?: string;
  showApprovalFlow?: boolean;
  showSignatureLines?: boolean;
  showAttachments?: boolean;
  showTotalsTable?: boolean;
  customFields?: Record<string, boolean>;
}

// Default template configuration
export const DEFAULT_TEMPLATE_CONFIG: PdfTemplateConfig = {
  name: 'Standard Template',
  type: 'standard',
  layout: 'portrait',
  showHeader: true,
  showFooter: true,
  showLogo: true,
  showWatermark: true,
  securityLevel: 'internal',
  headerColor: [111, 42, 230], // Default purple
  accentColor: [31, 211, 219], // Default teal
  watermarkOpacity: 0.08,
  watermarkText: 'INTERNAL USE',
  showApprovalFlow: true,
  showSignatureLines: true,
  showAttachments: true,
  showTotalsTable: true
};

// Audit action types
export type PdfAuditAction = 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' | 'pdf_analyzed';

// PDF settings with template configuration
export interface PdfSettingsWithTemplate {
  id?: number;
  headerTitle: string;
  headerSubtitle: string;
  headerColor: string;
  footerText: string;
  footerColor: string;
  pageNumbering: boolean;
  fontSize?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  headerHeight?: number;
  footerHeight?: number;
  headerImage?: string | null;
  footerImage?: string | null;
  logo?: string | null;
  loginLogo?: string | null;
  watermarkOpacity?: number;
  templateConfig: PdfTemplateConfig;
}

/**
 * Singleton PDF Service class
 */
export class PdfService {
  private static instance: PdfService;

  /**
   * Get the singleton instance
   */
  public static getInstance(): PdfService {
    if (!PdfService.instance) {
      PdfService.instance = new PdfService();
    }
    return PdfService.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get PDF settings with template configuration
   */
  public async getPdfSettings(): Promise<PdfSettingsWithTemplate> {
    // Fetch the latest PDF settings
    const settings = await db.query.pdfSettings.findMany({
      orderBy: [desc(pdfSettings.updatedAt)],
      limit: 1
    });

    // Default settings
    const defaultSettings: Omit<PdfSettingsWithTemplate, 'templateConfig'> = {
      headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
      headerSubtitle: 'PURCHASE REQUEST',
      headerColor: '#6F2AE6', // Purple
      footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
      footerColor: '#6F2AE6',
      pageNumbering: true,
      watermarkOpacity: 10,
    };

    if (settings.length > 0) {
      const settingsData = settings[0];
      
      // Try to parse template configuration
      let templateConfig: PdfTemplateConfig = DEFAULT_TEMPLATE_CONFIG;
      if (settingsData.templateConfig) {
        try {
          templateConfig = JSON.parse(settingsData.templateConfig);
        } catch (error) {
          console.error('Failed to parse template configuration:', error);
          // Continue with default template
        }
      }

      // Return settings with template configuration
      return {
        ...settingsData,
        templateConfig
      };
    }

    // Return default settings
    return {
      ...defaultSettings,
      templateConfig: DEFAULT_TEMPLATE_CONFIG
    };
  }

  /**
   * Save PDF settings to the database
   */
  public async savePdfSettings(settings: Partial<PdfSettingsWithTemplate>, userId: number): Promise<PdfSettingsWithTemplate> {
    // Extract template configuration
    let { templateConfig, ...restSettings } = settings;
    
    // Convert template configuration to string
    const templateConfigStr = templateConfig ? JSON.stringify(templateConfig) : undefined;
    
    // Find existing settings
    const existingSettings = await db.query.pdfSettings.findMany({
      orderBy: [desc(pdfSettings.updatedAt)],
      limit: 1
    });
    
    let result;
    
    if (existingSettings.length > 0) {
      // Update existing settings
      const settingId = existingSettings[0].id;
      [result] = await db.update(pdfSettings)
        .set({
          ...restSettings,
          templateConfig: templateConfigStr,
          updatedAt: new Date()
        })
        .where(eq(pdfSettings.id, settingId))
        .returning();
    } else {
      // Create new settings
      [result] = await db.insert(pdfSettings).values({
        headerTitle: settings.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES',
        headerSubtitle: settings.headerSubtitle || 'PURCHASE REQUEST',
        headerColor: settings.headerColor || '#6F2AE6',
        footerText: settings.footerText || 'CONFIDENTIAL - ALL RIGHTS RESERVED',
        footerColor: settings.footerColor || '#6F2AE6',
        pageNumbering: settings.pageNumbering ?? true,
        templateConfig: templateConfigStr || JSON.stringify(DEFAULT_TEMPLATE_CONFIG),
        ...restSettings,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
    }
    
    // Parse template configuration
    let parsedTemplateConfig: PdfTemplateConfig = DEFAULT_TEMPLATE_CONFIG;
    try {
      if (result.templateConfig) {
        parsedTemplateConfig = JSON.parse(result.templateConfig);
      }
    } catch (error) {
      console.error('Failed to parse template configuration:', error);
    }
    
    // Return settings with template configuration
    return {
      ...result,
      templateConfig: parsedTemplateConfig
    };
  }

  /**
   * Log PDF audit event
   */
  public async logPdfAudit(
    req: Request,
    action: PdfAuditAction,
    resourceId: number | string,
    details: Record<string, any> = {},
    type: 'user' | 'approver' | 'admin' = 'user'
  ): Promise<boolean> {
    try {
      // Validate and convert resourceId to a number
      let validatedResourceId: number | null = null;
      
      if (resourceId !== null && resourceId !== undefined) {
        // Convert to number if string
        const numericId = typeof resourceId === 'string' ? parseInt(resourceId.trim(), 10) : resourceId;
        
        // Verify it's a valid positive number
        if (!isNaN(Number(numericId)) && Number(numericId) > 0) {
          validatedResourceId = Number(numericId);
        } else {
          console.error('Invalid resource ID for PDF audit logging:', resourceId);
          return false;
        }
      } else {
        console.error('Missing resource ID for PDF audit logging');
        return false;
      }
      
      // Add timestamp to details if not provided
      const enrichedDetails = {
        ...details,
        timestamp: details?.timestamp || new Date().toISOString(),
        userType: type || 'user',
        trackingSource: details?.trackingId ? 'tracked' : 'untracked'
      };
      
      // Try to insert audit log entry with the user ID if authenticated
      if (req.isAuthenticated() && req.user) {
        await db.insert(auditLogs).values({
          userId: req.user.id,
          action,
          resourceId: validatedResourceId,
          resourceType: 'pdf',
          details: enrichedDetails,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date()
        });
        
        console.log(`[PDF Audit] Authenticated user ${req.user.id} ${action} for request ${validatedResourceId}`);
        return true;
      } else {
        // Handle anonymous users - try to get user ID from details if provided
        const userIdFromDetails = details?.userId ? 
          parseInt(details.userId as string, 10) : null;
        
        await db.insert(auditLogs).values({
          userId: userIdFromDetails, // May be null for anonymous access
          action,
          resourceId: validatedResourceId,
          resourceType: 'pdf',
          details: enrichedDetails,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date()
        });
        
        console.log(`[PDF Audit] Anonymous ${action} for request ${validatedResourceId}, implied user: ${userIdFromDetails || 'none'}`);
        return true;
      }
    } catch (error) {
      console.error('Error logging PDF audit event:', error);
      return false;
    }
  }

  /**
   * Get purchase request data for PDF generation
   */
  public async getPurchaseRequestForPdf(requestId: number, isPreview: boolean = false): Promise<{
    data: PurchaseRequestWithRelations;
    pdfSettings: any;
  }> {
    // Check if request exists
    const request = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, requestId),
      with: {
        requester: true,
        approvals: {
          with: {
            approver: true
          }
        },
        subPurpose: true,
        attachments: true,
        vendor: true
      }
    });
    
    if (!request) {
      throw new AppError(`Purchase request with ID ${requestId} not found`, 404);
    }
    
    // Get PDF settings
    const pdfSettingsData = await this.getPdfSettings();
    
    return {
      data: request,
      pdfSettings: pdfSettingsData
    };
  }

  /**
   * Analyze PDF template issues using Anthropic API
   */
  public async analyzePdfTemplateIssue(
    templateConfig: PdfTemplateConfig,
    errorMessage: string
  ): Promise<{
    analysis: string;
    recommendations: string[];
    fixedTemplate?: PdfTemplateConfig;
  }> {
    try {
      // Use Anthropic Claude API for analysis
      const message = await anthropicClient.messages.create({
        model: MODEL,
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
      console.error('Error analyzing PDF template issue:', error);
      
      // Local fallback analysis
      return {
        analysis: 'Could not analyze the template issue with AI. There may be invalid field values or incompatible settings.',
        recommendations: [
          'Ensure all color values are in the correct format (arrays with 3 values for RGB)',
          'Check that boolean fields like showHeader, showFooter, etc. are actual boolean values',
          'Verify that numeric fields like watermarkOpacity have valid numeric values',
          'Make sure all required fields are present in the template configuration'
        ]
      };
    }
  }

  /**
   * Log PDF generation error with AI analysis
   */
  public async logPdfGenerationError(
    error: Error,
    requestId: number,
    templateConfig: PdfTemplateConfig
  ): Promise<{
    error: string;
    analysis: string;
    recommendations: string[];
  }> {
    try {
      // Use Anthropic Claude API for analysis
      const message = await anthropicClient.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: "You're an expert in PDF generation and troubleshooting. Analyze the provided error and template configuration to identify issues and suggest fixes.",
        messages: [
          {
            role: 'user',
            content: `
              I encountered an error when generating a PDF for purchase request ${requestId}.
              
              Error: ${error.message}
              ${error.stack ? `Stack trace: ${error.stack}` : ''}
              
              Template configuration:
              ${JSON.stringify(templateConfig, null, 2)}
              
              Please analyze what might be causing this issue and provide specific recommendations to fix it.
              Format your response with:
              1. Brief analysis of the root cause
              2. A bulleted list of specific recommendations to fix the issue
              3. Whether this is likely a data problem, template configuration problem, or code problem
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
      
      // Log the error for future analysis
      await db.insert(auditLogs).values({
        userId: null,
        action: 'pdf_analyzed',
        resourceId: requestId,
        resourceType: 'error_analysis',
        details: {
          error: error.message,
          stack: error.stack,
          analysis: content.text,
          recommendations,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      });
      
      return {
        error: error.message,
        analysis: content.text,
        recommendations
      };
    } catch (analyzeError) {
      console.error('Error analyzing PDF generation error:', analyzeError);
      
      return {
        error: error.message,
        analysis: 'Failed to analyze the error with AI. This may be due to connectivity issues or API limitations.',
        recommendations: [
          'Check the error message for clues about what went wrong',
          'Verify that the template configuration is valid',
          'Check for missing or invalid data in the purchase request',
          'Try regenerating the PDF with default settings'
        ]
      };
    }
  }
}

// Export singleton instance
export const pdfService = PdfService.getInstance();