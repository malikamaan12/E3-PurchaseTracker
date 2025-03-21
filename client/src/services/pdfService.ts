/**
 * PDF Service
 * 
 * A client-side service for PDF operations, providing a centralized interface
 * for PDF generation, export, and analysis.
 */

import axios from 'axios';

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

export interface PdfSettings {
  id?: number;
  headerTitle: string;
  headerSubtitle?: string;
  headerColor: string;
  footerText?: string;
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

export interface PdfExportOptions {
  resourceId: number;
  format?: 'pdf' | 'zip';
  userType?: 'user' | 'approver' | 'admin';
  includeAttachments?: boolean;
  watermark?: string;
  fileName?: string;
}

export type PdfAuditAction = 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' | 'pdf_analyzed';

/**
 * PDF Service class
 */
class PdfService {
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
   * Get PDF settings from the server
   */
  public async getPdfSettings(): Promise<PdfSettings> {
    try {
      const response = await axios.get('/api/pdf/print-settings');
      return response.data;
    } catch (error) {
      console.error('Error getting PDF settings:', error);
      throw new Error('Failed to retrieve PDF settings');
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
      throw new Error('Failed to save PDF settings');
    }
  }

  /**
   * Log PDF audit event to the server
   */
  public async logPdfAudit(
    requestId: number,
    action: PdfAuditAction,
    details?: Record<string, any>,
    userType: 'user' | 'approver' | 'admin' = 'user'
  ): Promise<any> {
    try {
      const response = await axios.post('/api/pdf/audit', {
        requestId,
        action,
        details,
        type: userType
      });
      return response.data;
    } catch (error) {
      console.error('Error logging PDF audit:', error);
      // Don't throw here, just return the error info
      return { success: false, error: 'Failed to log audit event' };
    }
  }

  /**
   * Export a purchase request as PDF
   */
  public async exportRequestToPdf(requestId: number, userType: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
    try {
      // Get PDF data
      const response = await axios.get(`/api/requests/${requestId}/pdf`);
      
      // In a real implementation, this would generate the PDF from the data
      // For now, we'll simulate a download URL
      return `/api/requests/${requestId}/pdf?download=true`;
    } catch (error) {
      console.error('Error exporting request to PDF:', error);
      throw error;
    }
  }

  /**
   * Export a purchase request as ZIP
   */
  public async exportRequestToZip(requestId: number, includeAttachments: boolean = true): Promise<string> {
    try {
      // In a real implementation, this would generate the ZIP from the server
      return `/api/requests/${requestId}/zip?includeAttachments=${includeAttachments}`;
    } catch (error) {
      console.error('Error exporting request to ZIP:', error);
      throw error;
    }
  }

  /**
   * Export multiple requests as a bulk ZIP
   */
  public async exportBulkRequests(requestIds: number[], includeAttachments: boolean = true): Promise<string> {
    try {
      const queryParams = requestIds.map(id => `ids=${id}`).join('&');
      const response = await axios.get(`/api/requests/export/bulk?${queryParams}&includeAttachments=${includeAttachments}`);
      return response.data.downloadUrl;
    } catch (error) {
      console.error('Error generating bulk export:', error);
      throw error;
    }
  }

  /**
   * Upload images for PDF settings (header, footer, logo)
   */
  public async uploadPdfImages(files: File[], type: 'header' | 'footer' | 'logo' | 'loginLogo'): Promise<{
    success: boolean;
    files: Array<{
      fileUrl: string;
      fileName: string;
    }>;
  }> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('type', type);

      const response = await axios.post('/api/pdf/upload-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading PDF images:', error);
      throw error;
    }
  }

  /**
   * Analyze template configuration using AI
   */
  public async analyzeTemplateConfig(
    templateConfig: PdfTemplateConfig,
    requestId?: number
  ): Promise<{
    analysis: string;
    recommendations: string[];
    fixedTemplate?: PdfTemplateConfig;
  }> {
    try {
      const response = await axios.post('/api/pdf/analyze-template', {
        templateConfig,
        requestId
      });
      return response.data;
    } catch (error) {
      console.error('Error analyzing template config:', error);
      return {
        analysis: 'Failed to analyze template configuration',
        recommendations: [
          'Check that the template configuration is valid',
          'Try again later'
        ]
      };
    }
  }

  /**
   * Analyze PDF error using AI
   */
  public async analyzePdfError(
    error: any,
    requestId: number
  ): Promise<{
    analysis: string;
    recommendations: string[];
  }> {
    try {
      // Prepare error data for analysis
      const errorData = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestId
      };

      // In a real implementation, this would use the AI to analyze the error
      // For now, return a simple analysis
      return {
        analysis: 'An error occurred during PDF generation. The system could not generate the PDF file.',
        recommendations: [
          'Check that the request exists and is accessible',
          'Verify that all required data is available',
          'Try again later'
        ]
      };
    } catch (analyzeError) {
      console.error('Error analyzing PDF error:', analyzeError);
      return {
        analysis: 'An error occurred during PDF generation',
        recommendations: [
          'Check your network connection',
          'Try again later'
        ]
      };
    }
  }

  /**
   * Analyze uploaded images for PDF compatibility
   */
  public async analyzeImages(
    images: string[],
    options?: {
      logoSize?: { width: number; height: number };
      headerSize?: { width: number; height: number };
      footerSize?: { width: number; height: number };
    }
  ): Promise<{
    analysis: string;
    recommendations: string[];
    issues: string[];
  }> {
    try {
      const response = await axios.post('/api/pdf/analyze-images', {
        images,
        ...options
      });
      return response.data;
    } catch (error) {
      console.error('Error analyzing images:', error);
      return {
        analysis: 'Failed to analyze images',
        recommendations: [
          'Ensure images are in JPEG, PNG, or SVG format',
          'Keep file sizes under 2MB for better performance'
        ],
        issues: ['Unable to perform image analysis']
      };
    }
  }
}

// Export singleton instance
export const pdfService = PdfService.getInstance();