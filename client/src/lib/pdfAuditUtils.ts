/**
 * PDF Audit Utilities
 * 
 * This file provides utilities for logging PDF-related audit events
 * such as generation, viewing, and downloading.
 * 
 * Features:
 * - PDF generation audit logging
 * - PDF download tracking
 * - PDF viewing audit 
 * - PDF tracking ID generation
 * - Watermarking with configurable opacity
 */

/**
 * Log a PDF generation event to the audit log
 * 
 * @param requestId - The ID of the request being processed
 * @param action - The action being performed ('pdf_generated', 'pdf_downloaded', 'pdf_viewed', 'excel_downloaded', 'csv_downloaded', 'zip_downloaded')
 * @param details - Additional details about the generation
 * @param type - The type of user performing the action
 * @returns Promise resolving to the audit log entry
 */
export async function logPdfAuditEvent(
  requestId: number | string | null | undefined,
  action: 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' | 'excel_downloaded' | 'csv_downloaded' | 'zip_downloaded',
  details: Record<string, any> = {},
  type: 'user' | 'approver' | 'admin' = 'user'
): Promise<any> {
  try {
    // Enhanced request ID validation
    let validatedRequestId: number | null = null;
    
    // Special handling for diagnostic tests with large mock IDs
    if (typeof requestId === 'number' && requestId === 999999) {
      console.log('Using special diagnostic test ID');
      // For diagnostic tests, we'll skip validation but still log the event
      validatedRequestId = requestId;
    } else if (requestId !== null && requestId !== undefined) {
      // For normal operation - convert to proper numeric format
      
      // Handle different input formats
      let parsedId: number;
      
      if (typeof requestId === 'string') {
        // Remove any non-numeric characters that might cause parsing issues
        const cleanedId = requestId.trim().replace(/[^\d]/g, '');
        parsedId = parseInt(cleanedId, 10);
      } else {
        parsedId = Number(requestId);
      }
      
      // Strict validation for valid positive integer
      if (!isNaN(parsedId) && Number.isInteger(parsedId) && parsedId > 0) {
        validatedRequestId = parsedId;
        console.log(`Successfully validated request ID: ${validatedRequestId}`);
      } else {
        console.error(`Invalid request ID for audit logging: ${requestId} (parsed as: ${parsedId})`);
        // Don't proceed with invalid ID - prevents server-side validation errors
        return null;
      }
    } else {
      console.error('Missing request ID for audit logging');
      // Don't proceed with missing ID
      return null;
    }
    
    // Add user type to details
    const auditDetails = {
      ...details,
      type,
      timestamp: new Date().toISOString(),
    };

    // Build the payload with validated data 
    const payload = {
      requestId: validatedRequestId, // Server expects numeric requestId
      action,                       // Server validates this is one of the approved action types
      type,
      details: auditDetails,
    };
    
    console.log('Sending audit log payload:', JSON.stringify(payload));

    // Send the audit log to the server
    const response = await fetch('/api/pdf/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to log PDF audit event (${response.status}): ${errorText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error logging PDF audit event:', error);
    return null;
  }
}

/**
 * Generate a unique tracking ID for a PDF
 * This can be used for watermarking or tracking specific PDF instances
 * 
 * @param requestId - The request ID
 * @param userId - Optional user ID
 * @returns A unique tracking ID string
 */
export function generatePdfTrackingId(requestId: number, userId?: number): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const userPart = userId ? `-${userId}` : '';
  
  return `PDF-${requestId}${userPart}-${timestamp}-${randomSuffix}`;
}

/**
 * Apply dynamic watermarking to PDF content
 * Typically called during PDF generation
 * 
 * @param doc - jsPDF document instance
 * @param text - Watermark text
 * @param opacity - Watermark opacity (0-1)
 */
export function applyPdfWatermark(doc: any, text: string, opacity: number = 0.1): void {
  try {
    const pageCount = doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Save current state
      doc.saveGraphicsState();
      
      // Set watermark properties
      doc.setTextColor(0, 0, 0);
      doc.setGState(new doc.GState({ opacity }));
      doc.setFontSize(20);
      doc.setFont('helvetica', 'italic');
      
      // Rotate and position watermark
      doc.translate(pageWidth / 2, pageHeight / 2);
      doc.rotate(-45);
      doc.text(text, 0, 0, { align: 'center' });
      
      // Restore state
      doc.restoreGraphicsState();
    }
  } catch (error) {
    console.error('Error applying PDF watermark:', error);
  }
}

/**
 * Apply a security watermark to PDF based on security level
 * 
 * @param doc - jsPDF document instance
 * @param securityLevel - Security level to apply ('confidential', 'internal', 'restricted', 'public')
 * @param userId - Optional user ID for tracking
 * @param trackingId - Optional tracking ID for audit purposes
 */
export function applySecurityWatermark(
  doc: any, 
  securityLevel: 'confidential' | 'internal' | 'restricted' | 'public' = 'internal',
  userId?: number,
  trackingId?: string
): void {
  try {
    // Configure watermark based on security level
    let watermarkText = '';
    let watermarkColor = [0, 0, 0]; // RGB black
    let opacity = 0.1;
    
    // Set properties based on security level
    switch (securityLevel) {
      case 'confidential':
        watermarkText = 'CONFIDENTIAL';
        watermarkColor = [204/255, 0, 0]; // Red
        opacity = 0.15;
        break;
      case 'restricted':
        watermarkText = 'RESTRICTED';
        watermarkColor = [204/255, 102/255, 0]; // Orange
        opacity = 0.12;
        break;
      case 'internal':
        watermarkText = 'INTERNAL USE';
        watermarkColor = [0, 0, 204/255]; // Blue
        opacity = 0.08;
        break;
      case 'public':
        // No watermark for public documents
        return;
    }
    
    // Add tracking information if provided
    if (trackingId) {
      watermarkText += `\n${trackingId}`;
    }
    
    // Add user ID info if provided
    if (userId) {
      const timestamp = new Date().toISOString().substring(0, 10);
      watermarkText += `\nUser: ${userId} - ${timestamp}`;
    }
    
    const pageCount = doc.getNumberOfPages();
    
    // Apply to all pages
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Save current state
      doc.saveGraphicsState();
      
      // Set watermark properties
      doc.setTextColor(watermarkColor[0], watermarkColor[1], watermarkColor[2]);
      doc.setGState(new doc.GState({ opacity }));
      doc.setFontSize(30);
      doc.setFont('helvetica', 'bold');
      
      // Rotate and position watermark
      doc.translate(pageWidth / 2, pageHeight / 2);
      doc.rotate(-45);
      doc.text(watermarkText, 0, 0, { align: 'center' });
      
      // Restore state
      doc.restoreGraphicsState();
      
      // Add footer with security level on each page
      if (securityLevel === 'confidential' || securityLevel === 'internal' || securityLevel === 'restricted') {
        doc.setFontSize(8);
        doc.setTextColor(watermarkColor[0], watermarkColor[1], watermarkColor[2]);
        doc.text(`${securityLevel.toUpperCase()} - DO NOT DISTRIBUTE`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      }
    }
  } catch (error) {
    console.error('Error applying security watermark:', error);
  }
}

/**
 * Log a PDF viewing event to the audit trail
 * This can be called when a PDF is opened on screen
 * 
 * @param requestId - The ID of the request being viewed
 * @param viewContext - Context about where/how the PDF is being viewed
 * @param userType - Type of user viewing the PDF
 * @param securityLevel - Security classification level of the document
 * @returns Promise that resolves when logging is complete
 */
export async function logPdfViewEvent(
  requestId: number, 
  viewContext: 'preview' | 'detail' | 'download' | 'export' = 'preview',
  userType: 'user' | 'approver' | 'admin' = 'user',
  securityLevel: 'confidential' | 'internal' | 'restricted' | 'public' = 'internal'
): Promise<void> {
  try {
    const trackingId = generatePdfTrackingId(requestId);
    
    // Log the view event
    await logPdfAuditEvent(
      requestId,
      'pdf_viewed',
      {
        trackingId,
        viewContext,
        securityLevel,
        viewTimestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`
      },
      userType
    );
  } catch (error) {
    // Don't throw errors for view logging - non-critical
    console.error('Error logging PDF view event:', error);
  }
}

/**
 * Track PDF download events
 * This function should be called when a PDF is downloaded from the UI
 * 
 * @param requestId - ID of the purchase request
 * @param fileName - Name of the downloaded file
 * @param fileSize - Size of the file in bytes
 * @param userType - Type of user downloading the PDF
 * @param securityLevel - Security classification level of the document
 * @returns Promise that resolves when logging is complete
 */
export async function logPdfDownloadEvent(
  requestId: number,
  fileName: string,
  fileSize: number,
  userType: 'user' | 'approver' | 'admin' = 'user',
  securityLevel: 'confidential' | 'internal' | 'restricted' | 'public' = 'internal'
): Promise<void> {
  try {
    const trackingId = generatePdfTrackingId(requestId);
    
    // Log the download event
    await logPdfAuditEvent(
      requestId,
      'pdf_downloaded',
      {
        trackingId,
        fileName,
        fileSize,
        securityLevel,
        downloadTimestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        downloadMethod: 'ui-button'
      },
      userType
    );
  } catch (error) {
    // Log but don't throw errors - downloads should proceed even if audit fails
    console.error('Error logging PDF download event:', error);
  }
}

/**
 * Validate and normalize PDF branding settings
 * This ensures properly formatted values for the PDF generator
 * 
 * @param settings - Raw settings object from form or API
 * @returns Sanitized and validated settings
 */
export function validatePdfBrandingSettings(settings: any = {}): {
  headerColor: string;
  accentColor: string;
  footerColor: string;
  footerText: string;
  pageNumbering: boolean;
  headerHeight: number;
  footerHeight: number;
  showWatermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  logoAlignment: 'left' | 'center' | 'right';
  securityLevel: 'confidential' | 'internal' | 'restricted' | 'public';
} {
  // Define default values
  const defaults = {
    headerColor: '#6F2AE6', // Purple
    accentColor: '#1FD3DB', // Teal
    footerColor: '#6F2AE6', // Purple
    footerText: 'EVENTS & ENTERTAINMENT ENTERPRISES - ALL RIGHTS RESERVED',
    pageNumbering: true,
    headerHeight: 100,
    footerHeight: 50,
    showWatermark: true,
    watermarkText: 'E3 CONFIDENTIAL',
    watermarkOpacity: 0.1,
    logoAlignment: 'left' as 'left' | 'center' | 'right',
    securityLevel: 'internal' as 'confidential' | 'internal' | 'restricted' | 'public'
  };
  
  // Create a new settings object
  const validatedSettings = { ...defaults };
  
  // Validate colors (must be valid hex color)
  if (settings.headerColor && /^#[0-9A-Fa-f]{6}$/.test(settings.headerColor)) {
    validatedSettings.headerColor = settings.headerColor;
  }
  
  if (settings.accentColor && /^#[0-9A-Fa-f]{6}$/.test(settings.accentColor)) {
    validatedSettings.accentColor = settings.accentColor;
  }
  
  if (settings.footerColor && /^#[0-9A-Fa-f]{6}$/.test(settings.footerColor)) {
    validatedSettings.footerColor = settings.footerColor;
  }
  
  // Validate text
  if (settings.footerText && typeof settings.footerText === 'string') {
    // Truncate text if too long (max 100 chars)
    validatedSettings.footerText = settings.footerText.substring(0, 100);
  }
  
  if (settings.watermarkText && typeof settings.watermarkText === 'string') {
    // Truncate text if too long (max 50 chars)
    validatedSettings.watermarkText = settings.watermarkText.substring(0, 50);
  }
  
  // Validate boolean settings
  validatedSettings.pageNumbering = settings.pageNumbering !== false;
  validatedSettings.showWatermark = settings.showWatermark !== false;
  
  // Validate numeric settings with min/max constraints
  if (typeof settings.headerHeight === 'number' && settings.headerHeight >= 50 && settings.headerHeight <= 200) {
    validatedSettings.headerHeight = settings.headerHeight;
  }
  
  if (typeof settings.footerHeight === 'number' && settings.footerHeight >= 20 && settings.footerHeight <= 100) {
    validatedSettings.footerHeight = settings.footerHeight;
  }
  
  if (typeof settings.watermarkOpacity === 'number' && settings.watermarkOpacity >= 0.01 && settings.watermarkOpacity <= 0.5) {
    validatedSettings.watermarkOpacity = settings.watermarkOpacity;
  }
  
  // Validate logo alignment
  if (settings.logoAlignment && ['left', 'center', 'right'].includes(settings.logoAlignment)) {
    validatedSettings.logoAlignment = settings.logoAlignment as 'left' | 'center' | 'right';
  }
  
  // Validate security level
  const validSecurityLevels = ['confidential', 'internal', 'restricted', 'public'];
  if (settings.securityLevel && validSecurityLevels.includes(settings.securityLevel)) {
    validatedSettings.securityLevel = settings.securityLevel as 'confidential' | 'internal' | 'restricted' | 'public';
  }
  
  return validatedSettings;
}

/**
 * Check if a security level requires MFA or special approvals
 * Used to enforce stronger security requirements for high-security documents
 * 
 * @param securityLevel - The security level to check
 * @param userType - The type of user requesting access
 * @returns Object with requirements and reason
 */
export function checkSecurityRequirements(
  securityLevel: 'confidential' | 'internal' | 'restricted' | 'public' = 'internal',
  userType: 'user' | 'approver' | 'admin' = 'user'
): { 
  requiresMfa: boolean; 
  requiresApproval: boolean; 
  canDownload: boolean;
  canPrint: boolean;
  restrictedTo: string[];
  reason: string;
} {
  // Default settings for all security levels
  const requirements = {
    requiresMfa: false,
    requiresApproval: false,
    canDownload: true,
    canPrint: true,
    restrictedTo: [] as string[],
    reason: ''
  };
  
  // Apply security policies based on level and user type
  switch (securityLevel) {
    case 'confidential':
      // Confidential documents have the strictest policies
      requirements.requiresMfa = true;
      requirements.canPrint = userType !== 'user'; // Only approvers and admins can print
      
      if (userType === 'user') {
        requirements.requiresApproval = true;
        requirements.restrictedTo = ['approver', 'admin'];
        requirements.reason = 'Confidential documents require manager approval before downloading';
      }
      break;
      
    case 'restricted':
      // Restricted documents have medium security
      requirements.requiresMfa = userType === 'user'; // Only users need MFA, approvers and admins are trusted
      requirements.canPrint = true;
      break;
      
    case 'internal':
      // Internal documents have basic security
      requirements.requiresMfa = false;
      requirements.canPrint = true;
      break;
      
    case 'public':
      // Public documents have no restrictions
      requirements.requiresMfa = false;
      requirements.canPrint = true;
      break;
  }
  
  return requirements;
}

/**
 * Apply detailed security classification information to the PDF
 * This adds a standardized security banner to documents based on their classification level
 * 
 * @param doc - jsPDF document instance 
 * @param securityLevel - Security level of the document
 * @param companyName - Company name to include in the security banner
 * @param trackingId - Optional tracking ID for the document
 */
export function applySecurityClassificationBanner(
  doc: any,
  securityLevel: 'confidential' | 'internal' | 'restricted' | 'public' = 'internal',
  companyName: string = 'E3 CORPORATION',
  trackingId?: string
): void {
  try {
    if (securityLevel === 'public') {
      // No security banner needed for public documents
      return;
    }
    
    const pageCount = doc.getNumberOfPages();
    
    // Configuration for different security levels
    const securityConfig = {
      confidential: {
        color: [0.8, 0, 0], // Red
        text: 'CONFIDENTIAL',
        handling: 'Authorized personnel only. Do not distribute.',
        footer: 'This document contains confidential information. Unauthorized access, disclosure, copying, distribution, or use is prohibited.'
      },
      restricted: {
        color: [0.8, 0.4, 0], // Orange
        text: 'RESTRICTED',
        handling: 'For internal business use only.',
        footer: 'This document contains restricted business information. Sharing outside the organization is prohibited.'
      },
      internal: {
        color: [0, 0, 0.8], // Blue
        text: 'INTERNAL USE',
        handling: 'Internal distribution only.',
        footer: 'This document is for internal use only. Not for external distribution.'
      }
    };
    
    const config = securityConfig[securityLevel];
    
    // Add to each page
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Save state
      doc.saveGraphicsState();
      
      // Draw security classification header
      doc.setFillColor(config.color[0], config.color[1], config.color[2]);
      doc.rect(0, 0, pageWidth, 12, 'F');
      
      doc.setTextColor(1, 1, 1); // White text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      const headerText = `${config.text} - ${companyName} - ${config.handling}`;
      doc.text(headerText, pageWidth / 2, 8, { align: 'center' });
      
      // Draw security classification footer
      doc.setFillColor(config.color[0], config.color[1], config.color[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      
      let footerText = config.footer;
      if (trackingId) {
        footerText += ` | ID: ${trackingId}`;
      }
      
      doc.text(footerText, pageWidth / 2, pageHeight - 5, { align: 'center' });
      
      // Add diagonal security classification watermark
      const isLastPage = i === pageCount;
      if (isLastPage && securityLevel === 'confidential') {
        // Add detailed security disclaimer on the last page for confidential docs
        doc.setPage(pageCount);
        doc.setTextColor(config.color[0], config.color[1], config.color[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        
        const disclaimer = [
          'SECURITY NOTICE:',
          'This document is classified CONFIDENTIAL and contains sensitive information.',
          'It must be stored securely when not in use. Do not share electronically outside secure channels.',
          'Printed copies must be logged and stored in a locked container when not in use.',
          'If found, please contact the Security Officer immediately.',
          '',
          `Document ID: ${trackingId || 'Unregistered'}`
        ];
        
        doc.text(disclaimer, 14, pageHeight - 35, { align: 'left' });
      }
      
      // Restore state
      doc.restoreGraphicsState();
    }
  } catch (error) {
    console.error('Error applying security classification banner:', error);
  }
}