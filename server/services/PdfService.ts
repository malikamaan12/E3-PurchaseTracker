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

import { Request } from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import { db } from '@db';
import { purchaseRequests, fileAttachments, approvals, users, subPurposes, pdfSettings } from '@db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AppError, NotFoundError } from '../utils/errors';
import { logAuditEvent } from '../utils/audit-logger';
import { MODEL, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from '../utils/anthropic-config';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

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

export const DEFAULT_TEMPLATE_CONFIG: PdfTemplateConfig = {
  name: 'Standard PR Template',
  type: 'purchase_request',
  layout: 'standard',
  showHeader: true,
  showFooter: true,
  showLogo: true,
  showWatermark: false,
  securityLevel: 'internal',
  headerColor: [0, 112, 192],
  accentColor: [0, 112, 192],
  watermarkOpacity: 0.1,
  watermarkText: 'CONFIDENTIAL',
  showApprovalFlow: true,
  showSignatureLines: true,
  showAttachments: true,
  showTotalsTable: true,
  customFields: {
    showRequesterId: true,
    showRequesterDepartment: true,
    showPurposeType: true,
    showSubmissionDate: true
  }
};

export type PdfAuditAction = 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' | 'pdf_analyzed';

export interface PdfSettingsWithTemplate {
  id?: number;
  headerTitle: string;
  headerSubtitle?: string | null;
  headerColor: string;
  footerText?: string | null;
  footerColor: string;
  pageNumbering: boolean;
  pageNumberPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
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
  logoPosition?: 'left' | 'center' | 'right';
  loginLogo?: string | null;
  watermarkOpacity?: number;
  watermarkText?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
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
  templateConfig: PdfTemplateConfig;
}

/**
 * Singleton PDF Service class
 */
export class PdfService {
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
    // Initialize Anthropic if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  }

  /**
   * Get PDF settings with template configuration
   */
  public async getPdfSettings(): Promise<PdfSettingsWithTemplate> {
    try {
      // Get the most recently updated settings
      const settingsResult = await db.query.pdfSettings.findMany({
        orderBy: [desc(pdfSettings.updatedAt)],
        limit: 1
      });
      
      // If settings exist in the database
      if (settingsResult.length > 0) {
        const dbSettings = settingsResult[0];
        
        // Debug log for company information
        console.log('Retrieved PDF settings with company info:', {
          companyAddress: dbSettings.companyAddress,
          companyPhone: dbSettings.companyPhone,
          companyEmail: dbSettings.companyEmail,
          companyWebsite: dbSettings.companyWebsite
        });
        
        // Parse template config if it exists
        let parsedTemplateConfig: PdfTemplateConfig = DEFAULT_TEMPLATE_CONFIG;
        
        if (dbSettings.templateConfig) {
          try {
            parsedTemplateConfig = JSON.parse(dbSettings.templateConfig);
          } catch (err) {
            console.error('Error parsing template config:', err);
          }
        }
        
        // Map database settings to the expected format
        return {
          id: dbSettings.id,
          headerTitle: dbSettings.headerTitle,
          headerSubtitle: dbSettings.headerSubtitle,
          headerColor: dbSettings.headerColor,
          footerText: dbSettings.footerText,
          footerColor: dbSettings.footerColor,
          pageNumbering: dbSettings.pageNumbering,
          pageNumberPosition: dbSettings.pageNumberPosition as 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' || 'bottom-right',
          fontSize: dbSettings.fontSize || 12,
          fontFamily: dbSettings.fontFamily || 'helvetica',
          marginTop: dbSettings.marginTop || 20,
          marginBottom: dbSettings.marginBottom || 20,
          marginLeft: dbSettings.marginLeft || 20,
          marginRight: dbSettings.marginRight || 20,
          headerHeight: dbSettings.headerHeight || 60,
          footerHeight: dbSettings.footerHeight || 30,
          headerImage: dbSettings.headerImage,
          footerImage: dbSettings.footerImage,
          logo: dbSettings.logo,
          logoPosition: dbSettings.logoPosition as 'left' | 'center' | 'right' | undefined,
          loginLogo: dbSettings.loginLogo || undefined,
          watermarkOpacity: dbSettings.watermarkOpacity || 0.1,
          watermarkText: dbSettings.watermarkText || 'CONFIDENTIAL',
          companyAddress: dbSettings.companyAddress || undefined,
          companyPhone: dbSettings.companyPhone || undefined,
          companyEmail: dbSettings.companyEmail || undefined,
          companyWebsite: dbSettings.companyWebsite || undefined,
          showBasicInfo: dbSettings.showBasicInfo === null || dbSettings.showBasicInfo === undefined ? true : dbSettings.showBasicInfo,
          showRequesterDetails: dbSettings.showRequesterDetails === null || dbSettings.showRequesterDetails === undefined ? true : dbSettings.showRequesterDetails,
          showDateOfRequest: dbSettings.showDateOfRequest === null || dbSettings.showDateOfRequest === undefined ? true : dbSettings.showDateOfRequest,
          showPurposeInfo: dbSettings.showPurposeInfo === null || dbSettings.showPurposeInfo === undefined ? true : dbSettings.showPurposeInfo,
          showVendorDetails: dbSettings.showVendorDetails === null || dbSettings.showVendorDetails === undefined ? true : dbSettings.showVendorDetails,
          showItems: dbSettings.showItems === null || dbSettings.showItems === undefined ? true : dbSettings.showItems,
          showApprovals: dbSettings.showApprovals === null || dbSettings.showApprovals === undefined ? true : dbSettings.showApprovals,
          showAttachments: dbSettings.showAttachments === null || dbSettings.showAttachments === undefined ? true : dbSettings.showAttachments,
          showAuditInfo: dbSettings.showAuditInfo === null || dbSettings.showAuditInfo === undefined ? false : dbSettings.showAuditInfo,
          showSignatures: dbSettings.showSignatures === null || dbSettings.showSignatures === undefined ? true : dbSettings.showSignatures,
          templateConfig: parsedTemplateConfig
        };
      }
      
      // If no settings exist, return default values
      return {
        headerTitle: 'Purchase Request',
        headerSubtitle: 'Company Name',
        headerColor: '#0070c0',
        footerText: '© 2024 - Confidential',
        footerColor: '#333333',
        pageNumbering: true,
        pageNumberPosition: 'bottom-right',
        fontSize: 12,
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 20,
        marginRight: 20,
        headerHeight: 60,
        footerHeight: 30,
        headerImage: undefined,
        footerImage: undefined,
        logo: undefined,
        loginLogo: undefined,
        watermarkOpacity: 0.1,
        watermarkText: 'CONFIDENTIAL',
        companyAddress: undefined,
        companyPhone: undefined,
        companyEmail: undefined,
        companyWebsite: undefined,
        showBasicInfo: true,
        showRequesterDetails: true,
        showDateOfRequest: true,
        showPurposeInfo: true,
        showVendorDetails: true,
        showItems: true,
        showApprovals: true,
        showAttachments: true,
        showAuditInfo: false,
        showSignatures: true,
        templateConfig: DEFAULT_TEMPLATE_CONFIG
      };
    } catch (error) {
      console.error('Error getting PDF settings:', error);
      throw new AppError('Failed to retrieve PDF settings', 500);
    }
  }

  /**
   * Save PDF settings to the database
   */
  public async savePdfSettings(settings: Partial<PdfSettingsWithTemplate>, userId: number | null): Promise<PdfSettingsWithTemplate> {
    try {
      // Parse template config if it exists
      let templateConfigStr: string | undefined = undefined;
      
      if (settings.templateConfig) {
        try {
          // Convert to string if it's an object
          if (typeof settings.templateConfig === 'object') {
            templateConfigStr = JSON.stringify(settings.templateConfig);
          } else {
            // Validate that it's valid JSON if it's already a string
            JSON.parse(settings.templateConfig as string);
            templateConfigStr = settings.templateConfig as string;
          }
        } catch (error) {
          console.error('Error parsing template config:', error);
          // Use default template config if parsing fails
          templateConfigStr = JSON.stringify(DEFAULT_TEMPLATE_CONFIG);
        }
      }
      
      // Check if settings already exist in the database
      const existingSettings = await db.query.pdfSettings.findMany({
        orderBy: [desc(pdfSettings.updatedAt)],
        limit: 1
      });
      
      // Log company information for debugging
      console.log('Saving PDF settings with company information:', {
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        companyWebsite: settings.companyWebsite
      });
      
      let result;
      
      // Prepare database values for insert/update
      const dbValues: Record<string, any> = {
        headerTitle: settings.headerTitle,
        headerSubtitle: settings.headerSubtitle,
        headerColor: settings.headerColor,
        footerText: settings.footerText,
        footerColor: settings.footerColor,
        pageNumbering: settings.pageNumbering,
        pageNumberPosition: settings.pageNumberPosition,
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        marginTop: settings.marginTop,
        marginBottom: settings.marginBottom,
        marginLeft: settings.marginLeft,
        marginRight: settings.marginRight,
        headerHeight: settings.headerHeight,
        footerHeight: settings.footerHeight,
        headerImage: settings.headerImage,
        footerImage: settings.footerImage,
        logo: settings.logo,
        logoPosition: settings.logoPosition,
        loginLogo: settings.loginLogo,
        watermarkOpacity: settings.watermarkOpacity,
        watermarkText: settings.watermarkText,
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        companyWebsite: settings.companyWebsite,
        showBasicInfo: settings.showBasicInfo,
        showRequesterDetails: settings.showRequesterDetails,
        showDateOfRequest: settings.showDateOfRequest,
        showPurposeInfo: settings.showPurposeInfo,
        showVendorDetails: settings.showVendorDetails,
        showItems: settings.showItems,
        showApprovals: settings.showApprovals,
        showAttachments: settings.showAttachments,
        showAuditInfo: settings.showAuditInfo,
        showSignatures: settings.showSignatures,
        templateConfig: templateConfigStr,
        userId: userId,
        updatedAt: new Date()
      };
      
      // Remove undefined values to avoid overwriting existing values
      Object.keys(dbValues).forEach(key => {
        if (dbValues[key] === undefined) {
          delete dbValues[key];
        }
      });
      
      if (existingSettings.length > 0) {
        // Update existing settings
        console.log('Updating existing PDF settings');
        const settingId = existingSettings[0].id;
        
        // Create a properly typed update object
        const updateValues: Record<string, any> = {};
        
        // Only add defined values to the update
        if (dbValues.headerTitle !== undefined) updateValues.headerTitle = dbValues.headerTitle;
        if (dbValues.headerSubtitle !== undefined) updateValues.headerSubtitle = dbValues.headerSubtitle;
        if (dbValues.headerColor !== undefined) updateValues.headerColor = dbValues.headerColor;
        if (dbValues.footerText !== undefined) updateValues.footerText = dbValues.footerText;
        if (dbValues.footerColor !== undefined) updateValues.footerColor = dbValues.footerColor;
        if (dbValues.pageNumbering !== undefined) updateValues.pageNumbering = dbValues.pageNumbering;
        if (dbValues.pageNumberPosition !== undefined) updateValues.pageNumberPosition = dbValues.pageNumberPosition;
        if (dbValues.fontSize !== undefined) updateValues.fontSize = dbValues.fontSize;
        if (dbValues.fontFamily !== undefined) updateValues.fontFamily = dbValues.fontFamily;
        if (dbValues.marginTop !== undefined) updateValues.marginTop = dbValues.marginTop;
        if (dbValues.marginBottom !== undefined) updateValues.marginBottom = dbValues.marginBottom;
        if (dbValues.marginLeft !== undefined) updateValues.marginLeft = dbValues.marginLeft;
        if (dbValues.marginRight !== undefined) updateValues.marginRight = dbValues.marginRight;
        if (dbValues.headerHeight !== undefined) updateValues.headerHeight = dbValues.headerHeight;
        if (dbValues.footerHeight !== undefined) updateValues.footerHeight = dbValues.footerHeight;
        if (dbValues.headerImage !== undefined) updateValues.headerImage = dbValues.headerImage;
        if (dbValues.footerImage !== undefined) updateValues.footerImage = dbValues.footerImage;
        if (dbValues.logo !== undefined) updateValues.logo = dbValues.logo;
        if (dbValues.logoPosition !== undefined) updateValues.logoPosition = dbValues.logoPosition;
        if (dbValues.loginLogo !== undefined) updateValues.loginLogo = dbValues.loginLogo;
        if (dbValues.watermarkOpacity !== undefined) updateValues.watermarkOpacity = dbValues.watermarkOpacity;
        if (dbValues.watermarkText !== undefined) updateValues.watermarkText = dbValues.watermarkText;
        if (dbValues.companyAddress !== undefined) updateValues.companyAddress = dbValues.companyAddress;
        if (dbValues.companyPhone !== undefined) updateValues.companyPhone = dbValues.companyPhone;
        if (dbValues.companyEmail !== undefined) updateValues.companyEmail = dbValues.companyEmail;
        if (dbValues.companyWebsite !== undefined) updateValues.companyWebsite = dbValues.companyWebsite;
        if (dbValues.showBasicInfo !== undefined) updateValues.showBasicInfo = dbValues.showBasicInfo;
        if (dbValues.showRequesterDetails !== undefined) updateValues.showRequesterDetails = dbValues.showRequesterDetails;
        if (dbValues.showDateOfRequest !== undefined) updateValues.showDateOfRequest = dbValues.showDateOfRequest;
        if (dbValues.showPurposeInfo !== undefined) updateValues.showPurposeInfo = dbValues.showPurposeInfo;
        if (dbValues.showVendorDetails !== undefined) updateValues.showVendorDetails = dbValues.showVendorDetails;
        if (dbValues.showItems !== undefined) updateValues.showItems = dbValues.showItems;
        if (dbValues.showApprovals !== undefined) updateValues.showApprovals = dbValues.showApprovals;
        if (dbValues.showAttachments !== undefined) updateValues.showAttachments = dbValues.showAttachments;
        if (dbValues.showAuditInfo !== undefined) updateValues.showAuditInfo = dbValues.showAuditInfo;
        if (dbValues.showSignatures !== undefined) updateValues.showSignatures = dbValues.showSignatures;
        if (dbValues.templateConfig !== undefined) updateValues.templateConfig = dbValues.templateConfig;
        if (dbValues.userId !== undefined) updateValues.userId = dbValues.userId;
        
        // Always update the timestamp
        updateValues.updatedAt = new Date();
        
        [result] = await db.update(pdfSettings)
          .set(updateValues)
          .where(eq(pdfSettings.id, settingId))
          .returning();
      } else {
        // Create new settings
        console.log('Creating new PDF settings');
        
        // Ensure required fields are present
        if (!dbValues.headerTitle) {
          dbValues.headerTitle = 'Purchase Request';
        }
        if (!dbValues.headerColor) {
          dbValues.headerColor = '#0070c0';
        }
        if (!dbValues.footerColor) {
          dbValues.footerColor = '#333333';
        }
        
        // When creating a new record, the createdAt timestamp will be set automatically
        // by the defaultNow() in the schema definition
        
        [result] = await db.insert(pdfSettings)
          .values({
            headerTitle: dbValues.headerTitle as string,
            headerSubtitle: dbValues.headerSubtitle as string | undefined,
            headerColor: dbValues.headerColor as string,
            footerText: dbValues.footerText as string | undefined,
            footerColor: dbValues.footerColor as string,
            pageNumbering: dbValues.pageNumbering as boolean | undefined,
            pageNumberPosition: dbValues.pageNumberPosition as string | undefined,
            watermarkOpacity: dbValues.watermarkOpacity as number | undefined,
            watermarkText: dbValues.watermarkText as string | undefined,
            marginTop: dbValues.marginTop as number | undefined,
            marginBottom: dbValues.marginBottom as number | undefined,
            marginLeft: dbValues.marginLeft as number | undefined,
            marginRight: dbValues.marginRight as number | undefined,
            fontSize: dbValues.fontSize as number | undefined,
            fontFamily: dbValues.fontFamily as string | undefined,
            headerImage: dbValues.headerImage as string | undefined,
            footerImage: dbValues.footerImage as string | undefined,
            logo: dbValues.logo as string | undefined,
            logoPosition: dbValues.logoPosition as string | undefined,
            loginLogo: dbValues.loginLogo as string | undefined,
            headerHeight: dbValues.headerHeight as number | undefined,
            footerHeight: dbValues.footerHeight as number | undefined,
            companyAddress: dbValues.companyAddress as string | undefined,
            companyPhone: dbValues.companyPhone as string | undefined,
            companyEmail: dbValues.companyEmail as string | undefined,
            companyWebsite: dbValues.companyWebsite as string | undefined,
            showBasicInfo: dbValues.showBasicInfo as boolean | undefined,
            showRequesterDetails: dbValues.showRequesterDetails as boolean | undefined,
            showDateOfRequest: dbValues.showDateOfRequest as boolean | undefined,
            showPurposeInfo: dbValues.showPurposeInfo as boolean | undefined,
            showVendorDetails: dbValues.showVendorDetails as boolean | undefined,
            showItems: dbValues.showItems as boolean | undefined,
            showApprovals: dbValues.showApprovals as boolean | undefined,
            showAttachments: dbValues.showAttachments as boolean | undefined,
            showAuditInfo: dbValues.showAuditInfo as boolean | undefined,
            showSignatures: dbValues.showSignatures as boolean | undefined,
            templateConfig: dbValues.templateConfig as string | undefined,
            userId: dbValues.userId as number | undefined,
            updatedAt: new Date()
          })
          .returning();
      }
      
      // Get the full settings with defaults filled in
      return await this.getPdfSettings();
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      throw new AppError('Failed to save PDF settings', 500);
    }
  }

  /**
   * Log PDF audit event
   */
  public async logPdfAudit(
    req: Request,
    action: PdfAuditAction,
    options: {
      resourceId: number;
      details?: Record<string, any>;
      userType?: 'user' | 'approver' | 'admin';
    }
  ): Promise<any> {
    try {
      // Get user ID from session
      const userId = req.user ? (req.user as any).id : null;
      const { resourceId, details, userType } = options;

      // If no user is authenticated, just log and return
      if (!userId) {
        console.log('Anonymous PDF audit:', { action, resourceId, details, userType });
        return { success: false, message: 'No authenticated user' };
      }

      // Log the audit event
      await logAuditEvent(req, {
        userId,
        action: action as any, // Type compatibility
        resourceId,
        resourceType: 'purchase_request',
        details: {
          ...details,
          userType,
          timestamp: new Date().toISOString()
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error logging PDF audit:', error);
      return { success: false, error: 'Failed to log audit event' };
    }
  }

  /**
   * Get purchase request data for PDF generation
   */
  public async getPurchaseRequestForPdf(requestId: number, isPreview: boolean = false): Promise<{
    data: any;
    settings: PdfSettingsWithTemplate;
  }> {
    try {
      // Get the purchase request with relations
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
        throw new NotFoundError(`Purchase request with ID ${requestId} not found`);
      }

      // Get PDF settings
      const settings = await this.getPdfSettings();

      // Convert vendor data to match client-side expected structure
      const vendorData = request.vendor ? {
        ...request.vendor,
      } : undefined;

      // Return data and settings
      return {
        data: {
          ...request,
          vendor: vendorData
        },
        settings
      };
    } catch (error) {
      console.error('Error getting purchase request for PDF:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new AppError('Failed to retrieve purchase request data for PDF', 500);
    }
  }

  /**
   * Generate request ZIP file
   */
  public async generateRequestZip(requestId: number, includeAttachments: boolean = true): Promise<{
    filePath: string;
    fileName: string;
  }> {
    try {
      // Get request data
      const { data } = await this.getPurchaseRequestForPdf(requestId);
      
      // Create a new ZIP file
      const zip = new JSZip();
      
      // Add request details as JSON
      zip.file('request-details.json', JSON.stringify(data, null, 2));
      
      // Add attachments if requested
      if (includeAttachments && data.attachments && data.attachments.length > 0) {
        const attachmentsFolder = zip.folder('attachments');
        
        // Add each attachment to the ZIP
        for (const attachment of data.attachments) {
          try {
            const filePath = path.join(process.cwd(), 'uploads', attachment.fileName);
            if (fs.existsSync(filePath)) {
              const fileContent = fs.readFileSync(filePath);
              attachmentsFolder?.file(attachment.fileName, fileContent);
            }
          } catch (error) {
            console.error(`Error adding attachment ${attachment.fileName} to ZIP:`, error);
          }
        }
      }
      
      // Generate ZIP file
      const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Create temporary directory for the ZIP file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      // Save ZIP file
      const fileName = `PR-${data.requestNumber || requestId}-${Date.now()}.zip`;
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, zipContent);
      
      return {
        filePath,
        fileName
      };
    } catch (error) {
      console.error('Error generating request ZIP:', error);
      throw new AppError('Failed to generate ZIP file', 500);
    }
  }

  /**
   * Generate bulk export ZIP
   */
  public async generateBulkExport(requestIds: number[], includeAttachments: boolean = true): Promise<{
    filePath: string;
    fileName: string;
  }> {
    try {
      // Create a new ZIP file
      const zip = new JSZip();
      
      // Process each request ID
      for (const requestId of requestIds) {
        try {
          // Get request data
          const { data } = await this.getPurchaseRequestForPdf(requestId);
          
          // Create a folder for each request
          const requestFolder = zip.folder(`PR-${data.requestNumber || requestId}`);
          
          // Add request details as JSON
          requestFolder?.file('request-details.json', JSON.stringify(data, null, 2));
          
          // Add attachments if requested
          if (includeAttachments && data.attachments && data.attachments.length > 0) {
            const attachmentsFolder = requestFolder?.folder('attachments');
            
            // Add each attachment to the ZIP
            for (const attachment of data.attachments) {
              try {
                const filePath = path.join(process.cwd(), 'uploads', attachment.fileName);
                if (fs.existsSync(filePath)) {
                  const fileContent = fs.readFileSync(filePath);
                  attachmentsFolder?.file(attachment.fileName, fileContent);
                }
              } catch (attachError) {
                console.error(`Error adding attachment ${attachment.fileName} to bulk ZIP:`, attachError);
              }
            }
          }
        } catch (requestError) {
          console.error(`Error processing request ${requestId} for bulk export:`, requestError);
          // Continue with other requests even if one fails
        }
      }
      
      // Generate ZIP file
      const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Create temporary directory for the ZIP file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      // Save ZIP file
      const fileName = `Bulk-Export-${Date.now()}.zip`;
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, zipContent);
      
      return {
        filePath,
        fileName
      };
    } catch (error) {
      console.error('Error generating bulk export ZIP:', error);
      throw new AppError('Failed to generate bulk export ZIP file', 500);
    }
  }

  /**
   * Process uploaded images for PDF settings
   */
  public async processUploadedImages(
    files: Express.Multer.File[],
    imageType: string,
    userId: number | null
  ): Promise<{
    success: boolean;
    files: {
      originalName: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      fileType: string;
    }[];
  }> {
    try {
      // Process and save the image files
      const processedFiles = files.map(file => ({
        originalName: file.originalname,
        fileName: file.filename,
        fileUrl: `/uploads/pdf-images/${file.filename}`,
        fileSize: file.size,
        fileType: file.mimetype
      }));
      
      // Update PDF settings with the new image
      if (processedFiles.length > 0) {
        const settings = await this.getPdfSettings();
        const newSettings: Partial<PdfSettingsWithTemplate> = { ...settings };
        
        // Update the appropriate image field based on type
        if (imageType === 'header') {
          newSettings.headerImage = processedFiles[0].fileUrl;
        } else if (imageType === 'footer') {
          newSettings.footerImage = processedFiles[0].fileUrl;
        } else if (imageType === 'logo') {
          newSettings.logo = processedFiles[0].fileUrl;
        } else if (imageType === 'loginLogo') {
          newSettings.loginLogo = processedFiles[0].fileUrl;
        }
        
        // Save updated settings
        await this.savePdfSettings(newSettings, userId);
      }
      
      return {
        success: true,
        files: processedFiles
      };
    } catch (error) {
      console.error('Error processing uploaded images:', error);
      throw new AppError('Failed to process uploaded images', 500);
    }
  }

  /**
   * Analyze PDF template issues using Anthropic API
   */
  public async analyzePdfTemplateIssue(
    templateConfig: PdfTemplateConfig,
    requestId?: number
  ): Promise<{
    analysis: string;
    recommendations: string[];
    fixedTemplate?: PdfTemplateConfig;
  }> {
    try {
      // If Anthropic is not available, return basic analysis
      if (!this.anthropic) {
        return this.createBasicTemplateAnalysis(templateConfig);
      }
      
      // Get request data if a request ID is provided
      let requestData = null;
      if (requestId) {
        try {
          const { data } = await this.getPurchaseRequestForPdf(requestId);
          requestData = data;
        } catch (error) {
          console.error(`Error getting request data for PDF template analysis:`, error);
        }
      }
      
      // Send to Anthropic for analysis
      const message = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        system: "You're an expert in PDF template design and optimization. Analyze the provided template configuration and suggest improvements for clarity, readability, and professionalism.",
        messages: [
          {
            role: 'user',
            content: `
              Please analyze this PDF template configuration and suggest improvements:
              
              Template Configuration: ${JSON.stringify(templateConfig, null, 2)}
              
              ${requestData ? `Sample Data: ${JSON.stringify(requestData, null, 2)}` : ''}
              
              I need:
              1. A brief analysis of any issues or potential improvements
              2. Specific recommendations to enhance the template
              3. A fixed version of the template configuration if needed
              
              Focus on:
              - Improving readability and visual hierarchy
              - Ensuring consistent formatting and branding
              - Optimizing for professionalism and clarity
              - Organizing information logically for approval workflows
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
      const recommendationsMatch = content.text.match(/Recommendations?:([\s\S]*?)(?:\n\n|$)/i);
      if (recommendationsMatch) {
        const recText = recommendationsMatch[1];
        const bullets = recText.match(/[•\-\*]\s*([^\n]*)/g);
        if (bullets) {
          recommendations.push(...bullets.map(b => b.replace(/^[•\-\*]\s*/, '')));
        }
      }
      
      // Extract fixed template
      let fixedTemplate: PdfTemplateConfig | undefined;
      const fixedTemplateMatch = content.text.match(/```json([\s\S]*?)```/);
      if (fixedTemplateMatch) {
        try {
          fixedTemplate = JSON.parse(fixedTemplateMatch[1]);
        } catch (parseError) {
          console.error('Error parsing fixed template JSON:', parseError);
        }
      }
      
      return {
        analysis: content.text,
        recommendations,
        fixedTemplate
      };
    } catch (error) {
      console.error('Error analyzing PDF template issue:', error);
      return this.createBasicTemplateAnalysis(templateConfig);
    }
  }

  /**
   * Analyze images for PDF compatibility
   */
  public async analyzeImages(
    images: string[],
    options: {
      logoSize?: { width: number; height: number };
      headerSize?: { width: number; height: number };
      footerSize?: { width: number; height: number };
    } = {}
  ): Promise<{
    analysis: string;
    recommendations: string[];
    issues: string[];
  }> {
    try {
      // If Anthropic is not available, return basic analysis
      if (!this.anthropic) {
        return {
          analysis: 'Basic image analysis (AI analysis not available)',
          recommendations: [
            'Ensure images are in JPEG, PNG, or SVG format',
            'Keep file sizes under 2MB for better performance',
            'Use high-resolution images (at least 300 DPI)'
          ],
          issues: []
        };
      }
      
      // Send to Anthropic for analysis
      const message = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        system: "You're an expert in PDF design and image optimization. Analyze the provided image details and suggest improvements for PDF integration.",
        messages: [
          {
            role: 'user',
            content: `
              Please analyze these images for PDF compatibility:
              
              Image Paths: ${JSON.stringify(images)}
              
              Logo Size: ${options.logoSize ? JSON.stringify(options.logoSize) : 'Not specified'}
              Header Size: ${options.headerSize ? JSON.stringify(options.headerSize) : 'Not specified'}
              Footer Size: ${options.footerSize ? JSON.stringify(options.footerSize) : 'Not specified'}
              
              I need:
              1. A brief analysis of any potential issues
              2. Specific recommendations for PDF optimization
              3. A list of any detected issues that need fixing
              
              Focus on:
              - Resolution and DPI for print quality
              - File size and format optimization
              - Aspect ratio and scaling concerns
              - Color profile considerations for PDF
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
      const recommendationsMatch = content.text.match(/Recommendations?:([\s\S]*?)(?:\n\n|$)/i);
      if (recommendationsMatch) {
        const recText = recommendationsMatch[1];
        const bullets = recText.match(/[•\-\*]\s*([^\n]*)/g);
        if (bullets) {
          recommendations.push(...bullets.map(b => b.replace(/^[•\-\*]\s*/, '')));
        }
      }
      
      // Extract issues
      const issues: string[] = [];
      const issuesMatch = content.text.match(/Issues?:([\s\S]*?)(?:\n\n|$)/i);
      if (issuesMatch) {
        const issuesText = issuesMatch[1];
        const bullets = issuesText.match(/[•\-\*]\s*([^\n]*)/g);
        if (bullets) {
          issues.push(...bullets.map(b => b.replace(/^[•\-\*]\s*/, '')));
        }
      }
      
      return {
        analysis: content.text,
        recommendations,
        issues
      };
    } catch (error) {
      console.error('Error analyzing images for PDF:', error);
      
      return {
        analysis: 'Basic image analysis (error during AI analysis)',
        recommendations: [
          'Ensure images are in JPEG, PNG, or SVG format',
          'Keep file sizes under 2MB for better performance',
          'Use high-resolution images (at least 300 DPI)'
        ],
        issues: ['Unable to perform detailed AI analysis']
      };
    }
  }

  /**
   * Create basic template analysis
   */
  private createBasicTemplateAnalysis(templateConfig: PdfTemplateConfig): {
    analysis: string;
    recommendations: string[];
    fixedTemplate?: PdfTemplateConfig;
  } {
    const analysis = 'Basic template analysis (AI analysis not available)';
    const recommendations = [
      'Ensure header and footer are enabled for professional appearance',
      'Consider adding a watermark for sensitive documents',
      'Enable approval flow visualization for clarity'
    ];
    
    // Create improved template
    const fixedTemplate: PdfTemplateConfig = {
      ...templateConfig,
      showHeader: true,
      showFooter: true,
      showApprovalFlow: true
    };
    
    return {
      analysis,
      recommendations,
      fixedTemplate
    };
  }
}

// Export singleton instance
export const pdfService = PdfService.getInstance();