/**
 * Export Audit Utilities
 * 
 * A unified approach to audit logging for all export types
 * (PDF, CSV, Excel, ZIP) with consistent validation and error handling.
 */

import { logPdfAuditEvent } from './pdfAuditUtils';

/**
 * Export Types
 */
export type ExportFormat = 'pdf' | 'csv' | 'excel' | 'zip';

/**
 * User Types
 */
export type UserType = 'user' | 'approver' | 'admin';

/**
 * Safely validate and convert a resource ID for audit logging
 * @param resourceId - The resource ID to validate
 * @returns Validated numeric ID or null if invalid
 */
export function validateResourceId(resourceId: any): number | null {
  // Handle diagnostic test IDs
  if (typeof resourceId === 'number' && resourceId === 999999) {
    console.log('Using special diagnostic test ID');
    return resourceId;
  }

  // For normal operation - convert to proper numeric format
  if (resourceId !== null && resourceId !== undefined) {
    // Handle different input formats
    let parsedId: number;
    
    if (typeof resourceId === 'string') {
      // Remove any non-numeric characters that might cause parsing issues
      const cleanedId = resourceId.trim().replace(/[^\d]/g, '');
      parsedId = parseInt(cleanedId, 10);
    } else {
      parsedId = Number(resourceId);
    }
    
    // Strict validation for valid positive integer
    if (!isNaN(parsedId) && Number.isInteger(parsedId) && parsedId > 0) {
      console.log(`Successfully validated resource ID: ${parsedId}`);
      return parsedId;
    }
    
    console.warn(`Invalid resource ID for audit logging: ${resourceId} (parsed as: ${parsedId})`);
    return null;
  }
  
  console.warn('Missing resource ID for audit logging');
  return null;
}

/**
 * Log an export event regardless of format
 * 
 * Provides a consistent interface for logging PDF, CSV, Excel, and ZIP exports
 * with proper validation and error handling
 * 
 * @param resourceId - The ID of the resource being exported
 * @param format - The export format (pdf, csv, excel, zip)
 * @param details - Additional export details 
 * @param userType - The type of user performing the export
 * @returns Promise resolving to the audit log entry or null if validation fails
 */
export async function logExportEvent(
  resourceId: number | string | null | undefined,
  format: ExportFormat = 'pdf',
  details: Record<string, any> = {},
  userType: UserType = 'user'
): Promise<any> {
  try {
    // Validate the resource ID
    const validatedId = validateResourceId(resourceId);
    if (validatedId === null) {
      // Don't proceed with invalid ID - prevents server-side validation errors
      return null;
    }

    // Generate a tracking ID for this export
    const trackingId = `${format.toUpperCase()}-${validatedId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Always use pdf_downloaded action for consistency across export types
    // This is what the server-side API expects
    const action = 'pdf_downloaded';
    
    // Create enriched details with consistent format
    const enrichedDetails = {
      ...details,
      trackingId,
      exportType: format,
      exportTimestamp: new Date().toISOString(),
      userType,
      // If browser environment, add user agent info
      ...(typeof navigator !== 'undefined' && {
        userAgent: navigator.userAgent
      })
    };

    // Log the event using our existing pdfAuditUtils function
    // (Server handles all export types through this endpoint)
    return await logPdfAuditEvent(
      validatedId,
      action,
      enrichedDetails,
      userType
    );
  } catch (error) {
    // Catch any errors but don't let them propagate
    // Export functionality should still work even if audit fails
    console.error(`Error logging ${format} export event:`, error);
    return null;
  }
}

/**
 * Log a CSV export specifically
 * 
 * @param resourceId - The ID of the resource being exported
 * @param fileName - The name of the exported file
 * @param fileSize - The size of the exported file
 * @param userType - The type of user performing the export
 * @returns Promise resolving to the audit log entry or null if validation fails
 */
export async function logCsvExport(
  resourceId: number | string | null | undefined,
  fileName: string,
  fileSize: number,
  userType: UserType = 'user'
): Promise<any> {
  return logExportEvent(
    resourceId,
    'csv',
    {
      fileName,
      fileSize,
      format: 'csv',
      mimeType: 'text/csv;charset=utf-8'
    },
    userType
  );
}

/**
 * Log an Excel export specifically
 * 
 * @param resourceId - The ID of the resource being exported
 * @param fileName - The name of the exported file
 * @param fileSize - The size of the exported file
 * @param userType - The type of user performing the export
 * @returns Promise resolving to the audit log entry or null if validation fails
 */
export async function logExcelExport(
  resourceId: number | string | null | undefined,
  fileName: string,
  fileSize: number,
  userType: UserType = 'user'
): Promise<any> {
  return logExportEvent(
    resourceId,
    'excel',
    {
      fileName,
      fileSize,
      format: 'excel',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    userType
  );
}

/**
 * Log a ZIP export specifically
 * 
 * @param resourceId - The ID of the resource being exported
 * @param fileName - The name of the exported file
 * @param fileSize - The size of the exported file
 * @param userType - The type of user performing the export
 * @returns Promise resolving to the audit log entry or null if validation fails
 */
export async function logZipExport(
  resourceId: number | string | null | undefined,
  fileName: string,
  fileSize: number,
  userType: UserType = 'user'
): Promise<any> {
  return logExportEvent(
    resourceId,
    'zip',
    {
      fileName,
      fileSize,
      format: 'zip',
      mimeType: 'application/zip'
    },
    userType
  );
}

/**
 * Log a special diagnostic test export event for any format
 * 
 * @param format - The export format to test (pdf, csv, excel, zip)
 * @param fileSize - Optional file size to include in the test
 * @returns Promise resolving to the audit log entry or null if it fails
 */
export async function logDiagnosticExport(
  format: ExportFormat = 'csv',
  fileSize: number = 1024
): Promise<any> {
  // Use the special diagnostic ID that has been validated in pdfAuditUtils
  const specialDiagnosticId = 999999;
  
  return logExportEvent(
    specialDiagnosticId,
    format,
    {
      fileName: `diagnostic-test-${format}.${format === 'excel' ? 'xlsx' : format}`,
      fileSize,
      isDiagnosticTest: true,
      testMode: true,
      testTimestamp: new Date().toISOString()
    },
    'admin' // Use admin role for diagnostics
  );
}