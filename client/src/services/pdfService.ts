/**
 * PDF Service
 * 
 * A client-side service for PDF operations, providing a centralized interface
 * for PDF generation, export, and analysis.
 */

// Core PDF template configuration interface
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

// PDF settings interface for customizing the PDF output
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
  
  // Display settings
  showHeader?: boolean;
  showFooter?: boolean;
  
  // Logo settings
  showLogo?: boolean;
  logoPosition?: 'left' | 'center' | 'right';
  
  // Watermark settings
  useWatermark?: boolean;
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

// PDF export options interface
export interface PdfExportOptions {
  resourceId: number;
  format?: 'pdf' | 'zip';
  includeAttachments?: boolean;
  watermarkText?: string;
  useCustomHeader?: boolean;
  useCustomFooter?: boolean;
}

// Default PDF settings
export const DEFAULT_PDF_SETTINGS: Partial<PdfSettings> = {
  headerTitle: 'Purchase Request',
  headerColor: '#0066cc',
  footerText: 'Confidential - For internal use only',
  footerColor: '#eeeeee',
  pageNumbering: true,
  fontSize: 10,
  marginTop: 25,
  marginBottom: 25,
  marginLeft: 25,
  marginRight: 25,
  headerHeight: 60,
  footerHeight: 30,
  showHeader: true,
  showFooter: true,
  showLogo: true,
  logoPosition: 'left',
  useWatermark: false,
  watermarkText: 'CONFIDENTIAL',
  watermarkOpacity: 0.15,
  watermarkPosition: 'center',
  watermarkRotation: 45,
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

/**
 * Client-side PDF service class with methods to interact with the backend PDF service
 */
class PdfService {
  private static instance: PdfService;
  
  private constructor() {}
  
  public static getInstance(): PdfService {
    if (!PdfService.instance) {
      PdfService.instance = new PdfService();
    }
    return PdfService.instance;
  }

  /**
   * Get PDF settings from the server
   */
  public async getPdfSettings(): Promise<PdfSettings> {
    try {
      const response = await fetch('/api/pdf/print-settings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch PDF settings');
      }
      
      const settings = await response.json();
      return settings;
    } catch (error) {
      console.error('Error fetching PDF settings:', error);
      // Return default settings if there's an error
      return DEFAULT_PDF_SETTINGS as PdfSettings;
    }
  }
  
  /**
   * Save PDF settings to the server
   */
  public async savePdfSettings(settings: Partial<PdfSettings>): Promise<PdfSettings> {
    try {
      const response = await fetch('/api/pdf/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save PDF settings');
      }
      
      const updatedSettings = await response.json();
      return updatedSettings;
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      throw error;
    }
  }
  
  /**
   * Log PDF audit event
   */
  public async logPdfAudit(action: string, resourceId: number, details?: Record<string, any>): Promise<void> {
    try {
      await fetch('/api/pdf/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          resourceId,
          details,
        }),
      });
    } catch (error) {
      console.error('Error logging PDF audit:', error);
    }
  }
  
  /**
   * Download PDF for a purchase request
   */
  public async downloadRequestPdf(requestId: number): Promise<void> {
    try {
      // Log the audit event
      await this.logPdfAudit('pdf_downloaded', requestId);
      
      // Open the PDF in a new tab/window
      window.open(`/api/requests/${requestId}/pdf`, '_blank');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      throw error;
    }
  }
  
  /**
   * Download attachments ZIP for a purchase request
   */
  public async downloadRequestZip(requestId: number): Promise<void> {
    try {
      // Log the audit event
      await this.logPdfAudit('zip_downloaded', requestId);
      
      // Open the ZIP download in a new tab/window
      window.open(`/api/requests/${requestId}/zip`, '_blank');
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      throw error;
    }
  }
  
  /**
   * Upload images for PDF branding
   */
  public async uploadBrandingImages(files: File[]): Promise<Record<string, string>> {
    try {
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append('files', file);
      });
      
      const response = await fetch('/api/pdf/upload-images', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload branding images');
      }
      
      const result = await response.json();
      return result.files;
    } catch (error) {
      console.error('Error uploading branding images:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pdfService = PdfService.getInstance();