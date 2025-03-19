/**
 * CSV Export Diagnostics
 * 
 * This module provides specialized utilities for diagnosing and fixing CSV export issues.
 */

import { Parser } from '@json2csv/plainjs';
import { saveAs } from 'file-saver';
import { logDiagnosticExport } from './exportAuditUtils';

/**
 * Diagnostics result interface
 */
export interface CsvDiagnosticsResult {
  success: boolean;
  stage: 'data-preparation' | 'csv-generation' | 'blob-creation' | 'download' | 'audit-logging';
  error?: string;
  details?: Record<string, any>;
  recommendedFix?: string;
}

/**
 * Creates a safely escaped CSV with BOM (Byte Order Mark)
 * Handles various edge cases and potential CSV generation issues
 */
export function createSafeCsvWithBom(data: Record<string, any>[]): Uint8Array {
  try {
    // Check if data is valid
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid data for CSV export: must be a non-empty array');
    }
    
    // Use a more robust parser configuration with specific options
    // Note: This version of Parser only supports certain options
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    // Generate CSV
    const csv = parser.parse(data);
    
    // Add BOM (Byte Order Mark) to ensure Excel can open the file correctly with UTF-8
    const bomPrefix = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvContent = new Uint8Array(csv.length);
    for (let i = 0; i < csv.length; i++) {
      csvContent[i] = csv.charCodeAt(i);
    }
    
    // Combine BOM and CSV content
    const finalContent = new Uint8Array(bomPrefix.length + csvContent.length);
    finalContent.set(bomPrefix);
    finalContent.set(csvContent, bomPrefix.length);
    
    return finalContent;
  } catch (error) {
    console.error('Error creating safe CSV with BOM:', error);
    throw error;
  }
}

/**
 * Safely download a CSV file with fallback mechanisms
 */
export async function safeCsvDownload(content: Uint8Array, fileName: string): Promise<boolean> {
  try {
    // Primary method using FileSaver
    try {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, fileName);
      return true;
    } catch (primaryError) {
      console.warn('Primary CSV download method failed, trying fallback:', primaryError);
      
      // Fallback method using object URLs
      try {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        return true;
      } catch (fallbackError) {
        console.error('Fallback CSV download method also failed:', fallbackError);
        
        // Last resort method using data URLs (less compatible but worth trying)
        try {
          let binary = '';
          const bytes = new Uint8Array(content);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = window.btoa(binary);
          const dataUrl = 'data:text/csv;charset=utf-8;base64,' + base64;
          
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return true;
        } catch (lastResortError) {
          console.error('All CSV download methods failed:', lastResortError);
          return false;
        }
      }
    }
  } catch (error) {
    console.error('Error in CSV download process:', error);
    return false;
  }
}

/**
 * Run comprehensive diagnostics on CSV export functionality
 */
export async function runCsvExportDiagnostics(testData: Record<string, any>): Promise<CsvDiagnosticsResult> {
  try {
    // Stage 1: Data preparation
    try {
      if (!testData || typeof testData !== 'object') {
        return {
          success: false,
          stage: 'data-preparation',
          error: 'Invalid test data: must be a valid object',
          recommendedFix: 'Ensure the data being exported is a valid non-null object'
        };
      }
      
      // Convert single object to array if needed
      const dataArray = Array.isArray(testData) ? testData : [testData];
      
      // Check for invalid or problematic field values
      const problematicFields: string[] = [];
      dataArray.forEach(item => {
        Object.entries(item).forEach(([key, value]) => {
          // Check for circular references (can't be stringified)
          try {
            JSON.stringify(value);
          } catch (e) {
            problematicFields.push(key);
          }
          
          // Check for objects or arrays that need special handling
          if (typeof value === 'object' && value !== null) {
            problematicFields.push(key);
          }
        });
      });
      
      if (problematicFields.length > 0) {
        return {
          success: false,
          stage: 'data-preparation',
          error: `Problematic fields detected: ${problematicFields.join(', ')}`,
          details: { problematicFields },
          recommendedFix: 'Ensure all fields contain simple values (string, number, boolean) or pre-stringify objects'
        };
      }
    } catch (prepError) {
      return {
        success: false,
        stage: 'data-preparation',
        error: prepError instanceof Error ? prepError.message : String(prepError),
        recommendedFix: 'Check data structure for invalid values or circular references'
      };
    }
    
    // Stage 2: CSV generation
    let csvContent: Uint8Array;
    try {
      // Wrap in array if single object
      const dataArray = Array.isArray(testData) ? testData : [testData];
      csvContent = createSafeCsvWithBom(dataArray);
    } catch (csvError) {
      return {
        success: false,
        stage: 'csv-generation',
        error: csvError instanceof Error ? csvError.message : String(csvError),
        recommendedFix: 'Check data for special characters or values that might cause CSV parsing issues'
      };
    }
    
    // Stage 3: Blob creation
    let blob: Blob;
    try {
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      if (!(blob instanceof Blob) || blob.size === 0) {
        return {
          success: false,
          stage: 'blob-creation',
          error: 'Failed to create valid Blob object',
          recommendedFix: 'Check browser Blob support or try using a different MIME type'
        };
      }
    } catch (blobError) {
      return {
        success: false,
        stage: 'blob-creation',
        error: blobError instanceof Error ? blobError.message : String(blobError),
        recommendedFix: 'Check browser compatibility or try using a Blob polyfill'
      };
    }
    
    // Stage 4: Download test
    try {
      const testFileName = `csv-diagnostics-${Date.now()}.csv`;
      
      // Use our safe download function that includes multiple fallbacks
      const downloadSuccess = await safeCsvDownload(csvContent, testFileName);
      
      if (!downloadSuccess) {
        return {
          success: false,
          stage: 'download',
          error: 'Download failed despite all fallback attempts',
          recommendedFix: 'Check browser download permissions or try a different browser'
        };
      }
    } catch (downloadError) {
      return {
        success: false,
        stage: 'download',
        error: downloadError instanceof Error ? downloadError.message : String(downloadError),
        recommendedFix: 'Use server-side generation with direct link instead of client-side generation'
      };
    }
    
    // Stage 5: Audit logging test (optional)
    try {
      console.log('Testing audit logging with special diagnostic ID...');
      
      // Use our new consolidated audit logging utility for export diagnostics
      const auditResult = await logDiagnosticExport(
        'csv', 
        csvContent.length
      );
      
      if (!auditResult) {
        console.warn('Audit logging test returned null - partial failure');
        return {
          success: true, // Still mark as success since the core functionality works
          stage: 'audit-logging',
          error: 'Audit logging failed with null result but CSV export succeeded',
          details: {
            message: 'The CSV file was successfully generated and downloaded, but the audit logging failed. This is a non-critical issue that doesn\'t affect the export functionality.',
            recommendation: 'Check server connectivity and authentication status'
          },
          recommendedFix: 'Ensure you\'re logged in and verify network connectivity to the audit endpoint'
        };
      }
    } catch (auditError) {
      // Don't fail the overall test just because audit logging failed
      console.warn('Audit logging test failed:', auditError);
    }
    
    // All stages passed
    return {
      success: true,
      stage: 'download',
      details: {
        contentSize: csvContent.length,
        bomIncluded: true,
        mimeType: 'text/csv;charset=utf-8;'
      }
    };
  } catch (error) {
    // Generic catch-all error
    return {
      success: false,
      stage: 'data-preparation',
      error: error instanceof Error ? error.message : String(error),
      recommendedFix: 'Check browser console for detailed error information'
    };
  }
}