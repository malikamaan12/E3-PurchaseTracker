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
  fontFamily?: string;
  textColor?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  headerHeight?: number;
  footerHeight?: number;
  headerImage?: string | null;
  footerImage?: string | null;
  logo?: string | null;
  logoPosition?: 'left' | 'center' | 'right';
  loginLogo?: string | null;
  
  // Display settings
  showHeader?: boolean;
  showFooter?: boolean;
  
  // Logo settings
  showLogo?: boolean;
  
  // Watermark settings
  useWatermark?: boolean;
  watermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;
  watermarkPosition?: 'center' | 'tile' | 'corner';
  watermarkRotation?: number;
  
  // Content visibility settings
  showBasicInfo?: boolean;
  showRequesterDetails?: boolean;
  showDateOfRequest?: boolean;
  showPurposeInfo?: boolean;
  showVendorDetails?: boolean;
  showItems?: boolean;
  showApprovals?: boolean;
  showAttachments?: boolean;
  showAuditInfo?: boolean;
  showSignatures?: boolean;
  
  // Company information
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  
  // Template configuration
  templateConfig?: PdfTemplateConfig;
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  headerTitle: 'Purchase Request',
  headerSubtitle: 'Document',
  headerColor: '#0066cc',
  footerText: 'Confidential - For internal use only',
  footerColor: '#f5f5f5',
  pageNumbering: true,
  fontSize: 10,
  fontFamily: 'Arial',
  marginTop: 25,
  marginBottom: 25,
  marginLeft: 25,
  marginRight: 25,
  headerHeight: 60,
  footerHeight: 30,
  logoPosition: 'left',
  showHeader: true,
  showFooter: true,
  showLogo: true,
  useWatermark: false,
  watermarkEnabled: false,
  watermarkText: 'CONFIDENTIAL',
  watermarkOpacity: 0.15,
  watermarkPosition: 'center',
  watermarkRotation: 45,
  textColor: '#000000',
  showBasicInfo: true,
  showRequesterDetails: true,
  showDateOfRequest: true,
  showPurposeInfo: true,
  showVendorDetails: true,
  showItems: true,
  showApprovals: true,
  showAttachments: true,
  showAuditInfo: false,
  showSignatures: true
};

export interface PdfExportOptions {
  resourceId: number;
  format?: 'pdf' | 'zip';
  includeAttachments?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;
}

export interface PdfAuditEntry {
  action: string;
  resourceId: number;
  timestamp?: string;
  details?: Record<string, any>;
}

class PdfService {
  /**
   * Get PDF settings from the server
   */
  async getPdfSettings(): Promise<PdfSettings> {
    try {
      const response = await axios.get('/api/pdf/print-settings');
      return response.data || DEFAULT_PDF_SETTINGS;
    } catch (error) {
      console.error('Error fetching PDF settings:', error);
      return DEFAULT_PDF_SETTINGS;
    }
  }

  /**
   * Save PDF settings to the server
   */
  async savePdfSettings(settings: PdfSettings): Promise<PdfSettings> {
    try {
      const response = await axios.post('/api/pdf/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      throw error;
    }
  }

  /**
   * Generate and download a PDF for a request
   */
  async generatePdf(requestId: number, options?: Partial<PdfExportOptions>): Promise<void> {
    try {
      // Create a download link and click it to trigger download
      const a = document.createElement('a');
      a.href = `/api/requests/${requestId}/pdf${this.formatQueryParams(options)}`;
      a.download = `Request-${requestId}.pdf`;
      a.click();
      
      // Log this action to the audit system
      await this.logPdfAudit({
        action: 'pdf_downloaded',
        resourceId: requestId,
        details: { options }
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate and download a ZIP file for a request
   */
  async generateZip(requestId: number, includeAttachments: boolean = true): Promise<void> {
    try {
      // Create a download link and click it to trigger download
      const a = document.createElement('a');
      a.href = `/api/requests/${requestId}/zip?includeAttachments=${includeAttachments}`;
      a.download = `Request-${requestId}.zip`;
      a.click();
      
      // Log this action to the audit system
      await this.logPdfAudit({
        action: 'zip_downloaded',
        resourceId: requestId,
        details: { includeAttachments }
      });
    } catch (error) {
      console.error('Error generating ZIP:', error);
      throw error;
    }
  }
  
  /**
   * Upload image for PDF settings (logo, header, footer)
   */
  async uploadImage(file: File, type: 'logo' | 'headerImage' | 'footerImage'): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('type', type);
      
      const response = await axios.post('/api/pdf/upload-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data.urls[0];
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      throw error;
    }
  }

  /**
   * Log PDF-related actions to the audit system
   */
  private async logPdfAudit(auditEntry: PdfAuditEntry): Promise<void> {
    try {
      await axios.post('/api/pdf/audit', auditEntry);
    } catch (error) {
      console.error('Error logging PDF audit:', error);
      // We don't throw here to prevent disrupting the main functionality
    }
  }

  /**
   * Format query parameters for PDF endpoint
   */
  private formatQueryParams(options?: Partial<PdfExportOptions>): string {
    if (!options) return '';
    
    const params = new URLSearchParams();
    
    if (options.includeAttachments !== undefined) {
      params.append('includeAttachments', options.includeAttachments.toString());
    }
    
    if (options.watermarkText) {
      params.append('watermarkText', options.watermarkText);
    }
    
    if (options.watermarkOpacity !== undefined) {
      params.append('watermarkOpacity', options.watermarkOpacity.toString());
    }
    
    const paramString = params.toString();
    return paramString ? `?${paramString}` : '';
  }
}

export const pdfService = new PdfService();