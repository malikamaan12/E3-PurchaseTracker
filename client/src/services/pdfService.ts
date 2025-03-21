/**
 * PDF Service
 * 
 * A client-side service for PDF operations, providing a centralized interface
 * for PDF generation, export, and analysis.
 */

import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { useToast } from '../hooks/use-toast';

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

// PDF settings with template configuration
export interface PdfSettings {
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

// Export options
export interface PdfExportOptions {
  resourceId: number;
  format?: 'pdf' | 'zip';
  userType?: 'user' | 'approver' | 'admin';
  includeAttachments?: boolean;
  watermark?: string;
  fileName?: string;
}

// Audit log event type
export type PdfAuditAction = 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' | 'pdf_analyzed';

/**
 * PDF Service class
 */
class PdfService {
  private static instance: PdfService;
  private anthropic: Anthropic | null = null;
  
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
   * Get PDF settings from the server
   */
  public async getPdfSettings(): Promise<PdfSettings> {
    try {
      const response = await axios.get('/api/pdf/print-settings');
      return response.data;
    } catch (error) {
      console.error('Error fetching PDF settings:', error);
      throw error;
    }
  }
  
  /**
   * Save PDF settings to the server
   */
  public async savePdfSettings(settings: Partial<PdfSettings>): Promise<PdfSettings> {
    try {
      const response = await axios.post('/api/pdf/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      throw error;
    }
  }
  
  /**
   * Export a purchase request as PDF
   */
  public async exportRequestToPdf(requestId: number, userType: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
    try {
      console.log(`Starting PDF export for request #${requestId}`);
      
      // Fetch request data with full details
      const response = await axios.get(`/api/requests/${requestId}/pdf`);
      
      if (!response.data || !response.data.data) {
        throw new Error('Invalid response format from PDF API');
      }
      
      // Get data and settings
      const { data, pdfSettings } = response.data;
      
      // Import required utilities
      const { generatePurchaseRequestPDF } = await import('../lib/purchaseRequestPdf');
      const { validatePdfBrandingSettings, applySecurityWatermark, generatePdfTrackingId } = await import('../lib/pdfAuditUtils');
      
      // Validate settings
      const validatedSettings = validatePdfBrandingSettings(pdfSettings);
      
      // Generate PDF
      const doc = await generatePurchaseRequestPDF(data, {
        type: userType,
        showWatermark: validatedSettings.showWatermark !== false,
        watermarkText: validatedSettings.watermarkText || 'CONFIDENTIAL',
        watermarkOpacity: validatedSettings.watermarkOpacity,
        securityLevel: validatedSettings.securityLevel,
        headerColor: validatedSettings.headerColor,
        footerColor: validatedSettings.footerColor,
        headerImage: validatedSettings.headerImage,
        footerImage: validatedSettings.footerImage,
        footerText: validatedSettings.footerText,
        showApprovals: true,
        showAttachments: true,
        showSignatures: true,
        companyInfo: {
          name: validatedSettings.headerTitle,
          email: 'contact@e3.example.com',
          phone: '+974 1234 5678',
          website: 'www.e3.example.com'
        }
      });
      
      // Apply security watermark if needed
      if (validatedSettings.showWatermark !== false && validatedSettings.securityLevel) {
        applySecurityWatermark(
          doc, 
          validatedSettings.watermarkText || validatedSettings.securityLevel.toUpperCase(), 
          validatedSettings.watermarkOpacity || 0.1
        );
      }
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
      const fileName = `purchase-request-${data.requestNumber || data.id}-${timestamp}.pdf`;
      
      // Generate output blob
      const pdfOutput = doc.output('blob');
      
      // Generate tracking ID for audit
      const trackingId = generatePdfTrackingId(data.id);
      
      // Log the audit event
      try {
        await this.logPdfAudit(
          data.id,
          'pdf_downloaded',
          {
            trackingId,
            pdfType: userType,
            securityLevel: validatedSettings.securityLevel || 'internal',
            fileName,
            fileSize: pdfOutput.size,
            timestamp: new Date().toISOString()
          },
          userType
        );
      } catch (auditError) {
        console.error('Error logging PDF download audit:', auditError);
        // Continue with download even if audit fails
      }
      
      // Trigger the download
      saveAs(pdfOutput, fileName);
      
      return fileName;
    } catch (error) {
      console.error('Error exporting PDF:', error);
      
      // Analyze the error and try to provide helpful feedback
      const errorMessage = this.getPdfErrorMessage(error);
      
      // Log the error but don't show toast here - the component using this service should handle UI feedback
      console.error('PDF export failed:', errorMessage);
      
      // If we have Anthropic, analyze the error
      if (this.anthropic) {
        this.analyzePdfError(error, requestId)
          .then(analysis => {
            console.log('PDF error analysis:', analysis);
            // Analysis is returned to the caller for display
          })
          .catch(analysisError => {
            console.error('Error analyzing PDF error:', analysisError);
          });
      }
      
      throw error;
    }
  }
  
  /**
   * Export multiple requests as ZIP
   */
  public async exportRequestsAsZip(requestIds: number[], includeAttachments: boolean = false): Promise<string> {
    try {
      // Generate query parameters
      const queryParams = new URLSearchParams();
      requestIds.forEach(id => queryParams.append('ids', id.toString()));
      queryParams.append('includeAttachments', includeAttachments.toString());
      
      // Make the request
      const response = await axios.get(`/api/requests/export/bulk?${queryParams.toString()}`);
      
      if (!response.data || !response.data.downloadUrl) {
        throw new Error('Invalid response from bulk export API');
      }
      
      // Get the download URL
      const { downloadUrl, fileName } = response.data;
      
      // Trigger the download
      window.location.href = downloadUrl;
      
      return fileName;
    } catch (error) {
      console.error('Error exporting ZIP:', error);
      
      // Log the error but don't show toast here - the component using this service should handle UI feedback
      console.error('ZIP export failed:', this.getPdfErrorMessage(error));
      
      throw error;
    }
  }
  
  /**
   * Log PDF audit event
   */
  public async logPdfAudit(
    resourceId: number,
    action: PdfAuditAction,
    details: Record<string, any> = {},
    userType: 'user' | 'approver' | 'admin' = 'user'
  ): Promise<any> {
    try {
      const response = await axios.post('/api/pdf/audit', {
        requestId: resourceId,
        action,
        details,
        type: userType
      });
      
      return response.data;
    } catch (error) {
      console.error('Error logging PDF audit:', error);
      return null;
    }
  }
  
  /**
   * Analyze PDF generation error using Anthropic
   * Public version of the analyzePdfError method for components to use
   */
  public async analyzePdfError(
    error: any,
    requestId: number
  ): Promise<{
    analysis: string;
    recommendations: string[];
  }> {
    if (!this.anthropic) {
      return {
        analysis: 'AI analysis not available',
        recommendations: []
      };
    }
    
    try {
      // Get error details
      const errorMessage = error.message || String(error);
      const errorStack = error.stack || '';
      
      // Get PDF settings
      let pdfSettings;
      try {
        const settingsResponse = await axios.get('/api/pdf/print-settings');
        pdfSettings = settingsResponse.data;
      } catch (settingsError) {
        console.error('Error fetching PDF settings for error analysis:', settingsError);
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
              
              PDF Settings: ${pdfSettings ? JSON.stringify(pdfSettings, null, 2) : 'Not available'}
              
              Please analyze what might be causing this issue and provide specific recommendations to fix it.
              Format your response with:
              1. Brief analysis of the root cause
              2. A bulleted list of specific recommendations to fix the issue
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
      
      // Log the analysis
      this.logPdfAudit(requestId, 'pdf_analyzed', {
        error: errorMessage,
        analysis: content.text,
        recommendations,
        timestamp: new Date().toISOString()
      });
      
      return {
        analysis: content.text,
        recommendations
      };
    } catch (analyzeError) {
      console.error('Error analyzing PDF error with Anthropic:', analyzeError);
      
      return {
        analysis: 'Failed to analyze error with AI',
        recommendations: [
          'Check if all required data is available',
          'Verify PDF settings are correct',
          'Try refreshing the page and trying again'
        ]
      };
    }
  }
  
  /**
   * Get human-readable error message for PDF errors
   */
  private getPdfErrorMessage(error: any): string {
    if (!error) {
      return 'Unknown error occurred';
    }
    
    // If it's an Axios error with a response
    if (error.response) {
      const { status, data } = error.response;
      
      // Check for specific status codes
      if (status === 404) {
        return 'The requested resource was not found. Please verify the request ID.';
      } else if (status === 401) {
        return 'You are not authenticated. Please log in and try again.';
      } else if (status === 403) {
        return 'You do not have permission to access this resource.';
      } else if (status >= 400 && status < 500) {
        // Client errors
        return data.message || `Request error (${status}): ${data.error || 'Invalid request'}`;
      } else if (status >= 500) {
        // Server errors
        return `Server error (${status}): The server encountered an error while processing your request.`;
      }
    }
    
    // PDF-specific errors
    if (error.message?.includes('jsPDF')) {
      return 'Error generating PDF: There was a problem with the PDF library.';
    } else if (error.message?.includes('image')) {
      return 'Error loading images for PDF: Please check your network connection and try again.';
    }
    
    // Generic error message
    return error.message || 'An unexpected error occurred during PDF generation.';
  }
}

// Export singleton instance
export const pdfService = PdfService.getInstance();