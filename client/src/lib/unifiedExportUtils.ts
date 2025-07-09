/**
 * Unified Export Utilities
 * 
 * This module provides a standardized approach to export functionality and audit logging
 * for all export types (PDF, CSV, Excel, ZIP) to ensure consistency and reliability.
 */

import { validateResourceId, logExportEvent } from './exportAuditUtils';
import { saveAs } from 'file-saver';
import { exportRequestToPDF } from './exportUtils';
import { Parser } from '@json2csv/plainjs';
import * as XLSX from 'xlsx';

// Export type definitions
export type ExportFormat = 'pdf' | 'csv' | 'excel' | 'zip';
export type UserType = 'user' | 'approver' | 'admin';

// Standard interface for all export operations
interface ExportOptions {
  resourceId: number | string;
  format: ExportFormat;
  fileName?: string;
  userType?: UserType;
  additionalDetails?: Record<string, any>;
}

// Result interface for export operations
interface ExportResult {
  success: boolean;
  fileName?: string;
  fileSize?: number;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Standardized data fetching for exports
 * 
 * Ensures consistent data structure regardless of export type by always
 * using the appropriate endpoint for the requested format
 */
export async function fetchExportData(
  resourceId: number | string,
  format: ExportFormat
): Promise<any> {
  try {
    // Validate resourceId before using in fetch
    const validatedId = validateResourceId(resourceId);
    if (validatedId === null) {
      throw new Error(`Invalid resource ID: ${resourceId}`);
    }

    // Use the appropriate endpoint based on export format
    let url: string;
    if (format === 'csv' || format === 'excel') {
      // The export endpoint handles proper formatting for these types
      url = `/api/requests/export?format=${format}&id=${validatedId}`;
    } else {
      // For PDF and ZIP, use the standard request endpoint
      url = `/api/requests/${validatedId}`;
    }

    console.log(`Fetching export data from: ${url}`);
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch data for ${format} export`);
    }

    const data = await response.json();
    console.log(`Data fetched successfully for ${format} export, structure:`, Object.keys(data));
    return data;
  } catch (error) {
    console.error(`Error fetching export data:`, error);
    throw error;
  }
}

/**
 * Standardized approach for all export operations with consistent validation and logging
 */
export async function performExport({
  resourceId,
  format,
  fileName = `export-${Date.now()}`,
  userType = 'user',
  additionalDetails = {}
}: ExportOptions): Promise<ExportResult> {
  try {
    // 1. Validate resource ID
    const validatedId = validateResourceId(resourceId);
    if (validatedId === null) {
      console.error(`Invalid resource ID for ${format} export:`, resourceId);
      return {
        success: false,
        error: `Invalid resource ID: ${resourceId}`
      };
    }

    // 2. Fetch data consistently
    let data;
    try {
      data = await fetchExportData(validatedId, format);
    } catch (fetchError) {
      console.error(`Error fetching data for ${format} export:`, fetchError);
      return {
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Failed to fetch export data'
      };
    }

    // 3. Generate export based on format
    let exportedFile: { content: any; type: string; size: number } | null = null;

    switch (format) {
      case 'pdf':
        try {
          const pdfFileName = await exportRequestToPDF(data, userType);
          if (!pdfFileName) throw new Error('PDF generation returned no filename');
          
          // For PDF, we don't have direct access to the content as it's handled by jsPDF
          exportedFile = {
            content: null, // PDF content managed by exportRequestToPDF
            type: 'application/pdf',
            size: 0 // Unknown size since handled externally
          };
        } catch (pdfError) {
          console.error('Error generating PDF:', pdfError);
          return {
            success: false,
            error: pdfError instanceof Error ? pdfError.message : 'Failed to generate PDF'
          };
        }
        break;

      case 'csv':
        try {
          // Format depends on data structure - if it's from /api/requests/export 
          // it's already formatted, otherwise we need to format it
          let csvData = data;
          
          // If data comes from non-export endpoint, it has a different structure
          if (!Array.isArray(data) && !data.data) {
            // Format as needed for standard request endpoint
            csvData = [
              {
                'Request ID': data.id,
                'Request Number': data.requestNumber,
                'Title': data.title,
                'Description': data.description,
                'Status': data.status,
                'Priority': data.priority,
                'Purpose Type': data.purposeType,
                'Total Cost': data.totalEstimatedCost?.toFixed(2) || '0.00',
                'Created Date': new Date(data.createdAt).toLocaleDateString(),
                'Last Updated': data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'N/A',
                'Vendor': data.vendor ? (data.vendor.companyName || data.vendor.name) : 'N/A',
                'Requester': data.requester ? data.requester.username : 'N/A',
                'Items Count': Array.isArray(data.items) ? data.items.length : 0
              }
            ];
          } else if (data.data && Array.isArray(data.data)) {
            // If data has standard API response structure
            csvData = data.data;
          }

          // Create CSV
          const parser = new Parser({
            header: true,
            delimiter: ','
          });
          
          const csv = parser.parse(Array.isArray(csvData) ? csvData : [csvData]);
          
          // Add BOM to ensure Excel compatibility
          const bomPrefix = '\ufeff';
          const csvWithBom = bomPrefix + csv;
          
          const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
          const actualFileName = `${fileName}.csv`;
          
          // Save the file
          saveAs(blob, actualFileName);
          
          exportedFile = {
            content: csvWithBom,
            type: 'text/csv;charset=utf-8;',
            size: blob.size
          };
        } catch (csvError) {
          console.error('Error generating CSV:', csvError);
          return {
            success: false,
            error: csvError instanceof Error ? csvError.message : 'Failed to generate CSV'
          };
        }
        break;

      case 'excel':
        try {
          // Format depends on data structure - similar to CSV case
          let excelData = data;
          
          // If data comes from non-export endpoint, it has a different structure
          if (!Array.isArray(data) && !data.data) {
            // Format as needed for standard request endpoint
            excelData = [
              {
                'Request ID': data.id,
                'Request Number': data.requestNumber,
                'Title': data.title,
                'Description': data.description,
                'Status': data.status,
                'Priority': data.priority,
                'Purpose Type': data.purposeType,
                'Total Cost': data.totalEstimatedCost?.toFixed(2) || '0.00',
                'Created Date': new Date(data.createdAt).toLocaleDateString(),
                'Last Updated': data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'N/A',
                'Vendor': data.vendor ? (data.vendor.companyName || data.vendor.name) : 'N/A',
                'Requester': data.requester ? data.requester.username : 'N/A',
                'Items Count': Array.isArray(data.items) ? data.items.length : 0
              }
            ];
          } else if (data.data && Array.isArray(data.data)) {
            // If data has standard API response structure
            excelData = data.data;
          }

          // Create workbook
          const wb = XLSX.utils.book_new();
          
          // Add main data sheet
          const ws = XLSX.utils.json_to_sheet(Array.isArray(excelData) ? excelData : [excelData]);
          XLSX.utils.book_append_sheet(wb, ws, 'Request Data');
          
          // If this is a single request with items, add them as a separate sheet
          if (!Array.isArray(data) && data.items && Array.isArray(data.items) && data.items.length > 0) {
            const itemsWs = XLSX.utils.json_to_sheet(data.items);
            XLSX.utils.book_append_sheet(wb, itemsWs, 'Items');
          }
          
          // Generate Excel binary
          const excelBuffer = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'array'
          });
          
          const blob = new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
          
          const actualFileName = `${fileName}.xlsx`;
          
          // Save the file
          saveAs(blob, actualFileName);
          
          exportedFile = {
            content: excelBuffer,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: blob.size
          };
        } catch (excelError) {
          console.error('Error generating Excel:', excelError);
          return {
            success: false,
            error: excelError instanceof Error ? excelError.message : 'Failed to generate Excel'
          };
        }
        break;

      // ZIP case - use client-side generation with professional PDF
      case 'zip':
        try {
          console.log(`ZIP export: generating client-side with professional PDF for request ${validatedId}`);
          
          // Get request data for client-side ZIP generation
          const dataResponse = await fetch(`/api/requests/${validatedId}`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!dataResponse.ok) {
            throw new Error('Failed to fetch request data');
          }
          
          const requestData = await dataResponse.json();
          
          // Create ZIP file client-side
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          
          const requestNumber = requestData.requestNumber || `PR-${validatedId}`;
          const requestFolder = zip.folder(requestNumber);
          
          if (!requestFolder) {
            throw new Error('Failed to create ZIP folder');
          }
          
          // Add request details as JSON
          requestFolder.file('request-data.json', JSON.stringify(requestData, null, 2));
          
          // Add summary text file
          const summary = `
Purchase Request Summary
=======================
Request ID: ${validatedId}
Request Number: ${requestNumber}
Title: ${requestData.title || 'N/A'}
Status: ${requestData.status || 'N/A'}
Created: ${requestData.createdAt ? new Date(requestData.createdAt).toLocaleDateString() : 'N/A'}
Requester: ${requestData.requester?.username || 'N/A'}
Department: ${requestData.requester?.department || 'N/A'}
Items Count: ${requestData.items?.length || 0}
Total Cost: ${requestData.totalEstimatedCost || 0} ${requestData.currency || 'QAR'}
          `;
          requestFolder.file('summary.txt', summary);
          
          // Generate professional PDF using client-side generator for consistency
          try {
            console.log(`Generating professional PDF for request ${validatedId}`);
            
            // Fetch PDF settings for the current user
            const pdfSettingsResponse = await fetch('/api/pdf-settings', {
              credentials: 'include'
            });
            
            let pdfSettings = {};
            if (pdfSettingsResponse.ok) {
              pdfSettings = await pdfSettingsResponse.json();
            }
            
            // Import the professional PDF generator
            const { generateProfessionalPdfBlob } = await import('@/lib/professionalPdfGenerator');
            
            // Generate PDF using professional generator without auto-download
            const pdfBlob = await generateProfessionalPdfBlob(requestData, pdfSettings, false);
            
            requestFolder.file(`${requestNumber}.pdf`, pdfBlob);
            console.log(`Successfully added professional PDF for request ${validatedId}`);
          } catch (pdfError) {
            console.error('Error generating professional PDF:', pdfError);
            // Continue without PDF if generation fails
          }
          
          // Add attachments
          if (requestData.attachments && requestData.attachments.length > 0) {
            const attachmentsFolder = requestFolder.folder('attachments');
            
            if (attachmentsFolder) {
              for (const attachment of requestData.attachments) {
                try {
                  console.log(`Downloading attachment: ${attachment.fileName}`);
                  const attachmentResponse = await fetch(attachment.fileUrl, {
                    credentials: 'include'
                  });
                  
                  if (attachmentResponse.ok) {
                    const attachmentBlob = await attachmentResponse.blob();
                    attachmentsFolder.file(attachment.fileName, attachmentBlob);
                    console.log(`Successfully added attachment: ${attachment.fileName}`);
                  } else {
                    console.error(`Failed to download attachment ${attachment.fileName}: ${attachmentResponse.status}`);
                    // Add a note about the missing file
                    attachmentsFolder.file(`${attachment.fileName}.missing.txt`, 
                      `This attachment file (${attachment.fileName}) could not be downloaded.`);
                  }
                } catch (attachmentError) {
                  console.error(`Error fetching attachment ${attachment.fileName}:`, attachmentError);
                  // Add a note about missing file
                  attachmentsFolder.file(`${attachment.fileName}.missing.txt`, 
                    `This attachment file (${attachment.fileName}) could not be downloaded.`);
                }
              }
            }
          }
          
          // Generate ZIP file
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          
          // Create filename for the zip file
          const zipFileName = `Purchase_Request_${requestNumber}_with_attachments.zip`;
          
          // Import saveAs for file download
          const { saveAs } = await import('file-saver');
          
          // Directly initiate download
          saveAs(zipBlob, zipFileName);
          
          exportedFile = {
            content: zipBlob,
            type: 'application/zip',
            size: zipBlob.size
          };
        } catch (zipError) {
          console.error('Error with ZIP export:', zipError);
          return {
            success: false,
            error: zipError instanceof Error ? zipError.message : 'Failed to generate ZIP package'
          };
        }
        break;
    }

    // 4. Log the export with unified approach
    if (exportedFile) {
      try {
        // Log export event with consistent format
        await logExportEvent(
          validatedId,
          format,
          {
            fileName: `${fileName}.${format === 'excel' ? 'xlsx' : format}`,
            fileSize: exportedFile.size,
            fileType: exportedFile.type,
            exportTime: new Date().toISOString(),
            ...additionalDetails
          },
          userType
        );
      } catch (logError) {
        // Log but don't fail the export - logging is secondary to user completing export
        console.warn('Export successful but audit logging failed:', logError);
      }

      return {
        success: true,
        fileName: `${fileName}.${format === 'excel' ? 'xlsx' : format}`,
        fileSize: exportedFile.size,
        details: {
          fileType: exportedFile.type,
          exportFormat: format,
          exportTime: new Date().toISOString()
        }
      };
    }

    // Should only reach here for PDF or ZIP which are handled differently
    return {
      success: true,
      fileName: `${fileName}.${format}`,
      details: {
        exportFormat: format,
        exportTime: new Date().toISOString(),
        note: `${format.toUpperCase()} export handled externally`
      }
    };
  } catch (error) {
    console.error(`Unhandled error in performExport (${format}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown export error'
    };
  }
}

/**
 * Enhanced CSV export with unified validation and error handling
 */
export async function enhancedCsvExport(
  resourceId: number | string,
  fileName: string = `request-${Date.now()}`,
  userType: UserType = 'user'
): Promise<ExportResult> {
  return performExport({
    resourceId,
    format: 'csv',
    fileName,
    userType
  });
}

/**
 * Enhanced Excel export with unified validation and error handling
 */
export async function enhancedExcelExport(
  resourceId: number | string,
  fileName: string = `request-${Date.now()}`,
  userType: UserType = 'user'
): Promise<ExportResult> {
  return performExport({
    resourceId,
    format: 'excel',
    fileName,
    userType
  });
}

/**
 * Enhanced PDF export with unified validation and error handling
 */
export async function enhancedPdfExport(
  resourceId: number | string,
  fileName: string = `request-${Date.now()}`,
  userType: UserType = 'user'
): Promise<ExportResult> {
  return performExport({
    resourceId,
    format: 'pdf',
    fileName,
    userType
  });
}

/**
 * Run diagnostic test for all export types
 */
export async function runExportDiagnostics(): Promise<{
  csv: ExportResult;
  excel: ExportResult;
  pdf: ExportResult;
  zip: ExportResult;
}> {
  // Use diagnostic ID
  const diagnosticId = 999999;
  const timestamp = Date.now();
  
  // Test all exports in sequence
  const csvResult = await performExport({
    resourceId: diagnosticId,
    format: 'csv',
    fileName: `diagnostic-csv-${timestamp}`,
    userType: 'admin',
    additionalDetails: { isDiagnostic: true }
  });
  
  const excelResult = await performExport({
    resourceId: diagnosticId,
    format: 'excel',
    fileName: `diagnostic-excel-${timestamp}`,
    userType: 'admin',
    additionalDetails: { isDiagnostic: true }
  });
  
  const pdfResult = await performExport({
    resourceId: diagnosticId,
    format: 'pdf',
    fileName: `diagnostic-pdf-${timestamp}`,
    userType: 'admin',
    additionalDetails: { isDiagnostic: true }
  });
  
  const zipResult = await performExport({
    resourceId: diagnosticId,
    format: 'zip',
    fileName: `diagnostic-zip-${timestamp}`,
    userType: 'admin',
    additionalDetails: { isDiagnostic: true }
  });
  
  return {
    csv: csvResult,
    excel: excelResult,
    pdf: pdfResult,
    zip: zipResult
  };
}