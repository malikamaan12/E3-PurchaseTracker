/**
 * Export Audit Utilities
 * 
 * A unified approach to audit logging for PDF and ZIP export types
 * with consistent validation and error handling.
 * 
 * NOTE: This file has been updated to remove CSV and Excel export functionality
 * per standardization requirements. Only PDF and ZIP exports are now supported.
 */

// Export Types
export type ExportFormat = 'pdf' | 'zip'; // Removed 'csv' and 'excel' as we now only support PDF and ZIP
export type UserType = 'user' | 'approver' | 'admin';

// Validation constants
const DIAGNOSTIC_ID = 999999;
const SPECIAL_IDS = [DIAGNOSTIC_ID];

/**
 * Safely validate and convert a resource ID for audit logging
 * @param resourceId - The resource ID to validate
 * @returns Validated numeric ID or null if invalid
 */
export function validateResourceId(resourceId: number | string | null | undefined): number | null {
  if (resourceId === null || resourceId === undefined) {
    console.warn('Export validation: Resource ID is null or undefined');
    return null;
  }

  // Handle special diagnostic ID
  if (resourceId === DIAGNOSTIC_ID || resourceId === `${DIAGNOSTIC_ID}`) {
    console.log('Export validation: Using diagnostic ID');
    return DIAGNOSTIC_ID;
  }

  // Convert to number if string
  const parsedId = typeof resourceId === 'string' ? parseInt(resourceId.trim(), 10) : resourceId;
  
  // Check if valid number
  if (isNaN(Number(parsedId))) {
    console.warn(`Export validation: Invalid resource ID '${resourceId}' is not a number`);
    return null;
  }
  
  // Check if positive number (including special IDs)
  if (Number(parsedId) <= 0 && !SPECIAL_IDS.includes(Number(parsedId))) {
    console.warn(`Export validation: Resource ID must be positive (got ${parsedId})`);
    return null;
  }
  
  return Number(parsedId);
}

/**
 * Map export format to audit action
 * @param format - The export format to get the action for
 * @returns Corresponding audit action string
 */
function getAuditAction(format: ExportFormat): string {
  switch (format) {
    case 'pdf':
      return 'pdf_downloaded';
    case 'zip':
      return 'zip_downloaded';
    default:
      return 'pdf_downloaded'; // Default for backward compatibility
  }
}

/**
 * Log an export event with consistent validation
 */
export async function logExportEvent(
  resourceId: number | string | null | undefined,
  format: ExportFormat,
  details: Record<string, any> = {},
  userType: UserType = 'user'
): Promise<boolean> {
  try {
    // Validate resource ID
    const validatedId = validateResourceId(resourceId);
    if (validatedId === null) {
      console.error(`Export audit failed: Invalid resource ID ${resourceId}`);
      return false;
    }

    // Get appropriate action based on export format
    const action = getAuditAction(format);

    // Prepare audit data
    const auditData = {
      action,
      requestId: validatedId,
      details: {
        ...details,
        exportType: format,
        userType,
        client: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    };
    
    // Log to audit endpoint
    console.log(`Logging export audit: ${format} for ID ${validatedId}`);
    const response = await fetch('/api/pdf/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auditData),
      credentials: 'include'
    });
    
    if (!response.ok) {
      // Don't fail the export if audit logging fails
      console.warn(`Export audit warning: Failed to log ${format} export, status ${response.status}`);
      return false;
    }
    
    console.log(`Export audit success: ${format} export logged for ID ${validatedId}`);
    return true;
  } catch (error) {
    // Log but don't interrupt the export process if audit logging fails
    console.warn('Export audit error:', error);
    return false;
  }
}

/**
 * Check if special diagnostic ID is being used
 */
export function isDiagnosticId(resourceId: number | string | null | undefined): boolean {
  const id = typeof resourceId === 'string' ? parseInt(resourceId, 10) : resourceId;
  return id === DIAGNOSTIC_ID;
}

/**
 * Get appropriate filename based on export format and resource ID
 */
export function getExportFilename(
  resourceId: number | string,
  format: ExportFormat,
  baseFilename?: string
): string {
  // Use provided base filename or generate one based on format
  const filename = baseFilename || `request-${resourceId}`;
  
  // Add extension based on format
  switch (format) {
    case 'pdf':
      return `${filename}.pdf`;
    case 'zip':
      return `${filename}.zip`;
    default:
      return `${filename}.${format}`;
  }
}

/**
 * NOTE: CSV and Excel export functions have been removed
 * as part of the standardization to PDF and ZIP only formats.
 */

/**
 * Specialized function for PDF export logging
 */
export async function logPdfExport(
  resourceId: number | string,
  details: Record<string, any> = {},
  userType: UserType = 'user'
): Promise<boolean> {
  try {
    // Validate resource ID
    const validatedId = validateResourceId(resourceId);
    if (validatedId === null) {
      console.error(`PDF export audit failed: Invalid resource ID ${resourceId}`);
      return false;
    }

    console.log(`Logging PDF export for resource ID: ${validatedId}`);
    
    // Log the event with the correct action type
    return await logExportEvent(
      validatedId,
      'pdf',
      {
        exportTime: new Date().toISOString(),
        ...details
      },
      userType
    );
  } catch (error) {
    console.error('Error logging PDF export:', error);
    return false;
  }
}

/**
 * Specialized function for ZIP export logging
 */
export async function logZipExport(
  resourceId: number | string,
  details: Record<string, any> = {},
  userType: UserType = 'user'
): Promise<boolean> {
  try {
    // Validate resource ID
    const validatedId = validateResourceId(resourceId);
    if (validatedId === null) {
      console.error(`ZIP export audit failed: Invalid resource ID ${resourceId}`);
      return false;
    }

    console.log(`Logging ZIP export for resource ID: ${validatedId}`);
    
    // Log the event with the correct action type
    return await logExportEvent(
      validatedId,
      'zip',
      {
        exportTime: new Date().toISOString(),
        ...details
      },
      userType
    );
  } catch (error) {
    console.error('Error logging ZIP export:', error);
    return false;
  }
}

/**
 * Run diagnostics on export validation
 */
/**
 * Log diagnostic information for export operations
 * Specifically designed for testing and debugging export functionality
 * @param format The export format being tested
 * @param details Additional details about the diagnostic run
 */
export async function logDiagnosticExport(
  format: ExportFormat,
  details: Record<string, any> = {}
): Promise<boolean> {
  try {
    console.log(`Running diagnostic export test for ${format} format`);
    
    // Always use the diagnostic ID for testing
    const diagnosticId = DIAGNOSTIC_ID;
    
    // Create standardized diagnostic details
    const diagnosticDetails = {
      isDiagnostic: true,
      timestamp: new Date().toISOString(),
      testRun: true,
      browser: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      ...details
    };
    
    // Attempt to log the diagnostic event
    return await logExportEvent(
      diagnosticId,
      format,
      diagnosticDetails,
      'admin' // Always use admin for diagnostics
    );
  } catch (error) {
    console.error(`Diagnostic export logging failed:`, error);
    return false;
  }
}

/**
 * Run validation tests for export ID handling
 */
export function testExportValidation(): { 
  validCases: number; 
  invalidCases: number; 
  results: Record<string, boolean>;
} {
  const testCases: Record<string, number | string | null | undefined> = {
    'valid_number': 123,
    'valid_string': '456',
    'special_id': DIAGNOSTIC_ID,
    'special_id_string': DIAGNOSTIC_ID.toString(),
    'zero_id': 0,
    'negative_id': -1,
    'null_id': null,
    'undefined_id': undefined,
    'non_numeric': 'abc',
    'whitespace': '  ',
    'empty_string': '',
    'decimal': 123.45,
    'scientific': '1e3',
    'hex': '0xFF',
    'very_large': 9999999999
  };
  
  const results: Record<string, boolean> = {};
  let validCount = 0;
  let invalidCount = 0;
  
  // Test each case
  for (const [key, value] of Object.entries(testCases)) {
    const result = validateResourceId(value) !== null;
    
    results[key] = result;
    if (result) {
      validCount++;
    } else {
      invalidCount++;
    }
  }
  
  return {
    validCases: validCount,
    invalidCases: invalidCount,
    results
  };
}