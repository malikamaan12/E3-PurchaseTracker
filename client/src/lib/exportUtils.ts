import JSZip from 'jszip';
import { generateRequestPDF } from './pdfGenerator';
import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';
import { saveAs } from 'file-saver';
import { safeDownload, safeUrlDownload, safeExport } from './safeDownload';

/**
 * Enhanced logging function for export operations
 * Helps with debugging and tracking export progress
 * 
 * @param type The type of export operation
 * @param message The log message
 * @param error Optional error object
 */
export const logExport = (type: string, message: string, error?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
  const prefix = `[EXPORT:${type.toUpperCase()}] [${timestamp}]`;
  
  if (error) {
    console.error(`${prefix} ERROR: ${message}`, error);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

/**
 * @deprecated Use the imported safeDownload from ./safeDownload.ts instead
 * This function is kept for backward compatibility and will be removed in a future release
 */
async function _legacySafeDownload(blob: Blob, fileName: string): Promise<boolean> {
  try {
    logExport('download', `Initiating download for ${fileName} (${blob.size} bytes)...`);
    
    // Try FileSaver first - it has good cross-browser support
    try {
      saveAs(blob, fileName);
      logExport('download', `Primary download method (saveAs) completed`);
      return true;
    } catch (saveError) {
      logExport('download', `Primary download method failed, using fallback 1`, saveError);
      
      // Fallback 1: Using URL.createObjectURL and link
      try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Use both click and dispatchEvent for better compatibility
        link.click();
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        link.dispatchEvent(clickEvent);
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        logExport('download', `Fallback 1 download method completed`);
        return true;
      } catch (fallback1Error) {
        logExport('download', `Fallback 1 method failed, using fallback 2`, fallback1Error);
        
        // Fallback 2: Using Blob URL directly in a new window
        try {
          const url = URL.createObjectURL(blob);
          const newWindow = window.open(url, '_blank');
          
          if (!newWindow) {
            logExport('download', 'Popup blocked or new window failed to open');
            // Continue to next fallback
          } else {
            // Add a timer to revoke the URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            logExport('download', `Fallback 2 download method completed`);
            return true;
          }
        } catch (fallback2Error) {
          logExport('download', `Fallback 2 method failed, using fallback 3`, fallback2Error);
          
          // Fallback 3: Using data URL and iframe
          try {
            // Convert blob to data URL if it's not too large
            if (blob.size < 5 * 1024 * 1024) { // 5MB limit for data URLs
              const reader = new FileReader();
              
              // Create a promise to handle async FileReader
              return new Promise((resolve, reject) => {
                reader.onload = (event) => {
                  try {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = event.target?.result as string;
                    document.body.appendChild(iframe);
                    
                    setTimeout(() => {
                      document.body.removeChild(iframe);
                    }, 100);
                    
                    logExport('download', `Fallback 3 download method completed`);
                    resolve(true);
                  } catch (iframeError) {
                    reject(iframeError);
                  }
                };
                
                reader.onerror = () => {
                  reject(new Error('Failed to read file data'));
                };
                
                reader.readAsDataURL(blob);
              });
            } else {
              logExport('download', 'File too large for data URL method');
              throw new Error('File too large for data URL method');
            }
          } catch (fallback3Error) {
            logExport('download', `All fallback methods failed`, fallback3Error);
            throw fallback3Error;
          }
        }
      }
    }
    
    // If all fallbacks fail but don't throw, return false
    return false;
  } catch (error) {
    logExport('download', `All download methods failed`, error);
    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Exports a purchase request as a PDF document
 * 
 * @param request The purchase request data
 * @param type The type of PDF to generate (user, approver, admin)
 * @returns The name of the generated file
 */
export async function exportRequestToPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
  try {
    logExport('pdf', `Starting PDF export for request ${request.id || 'unknown'} with type ${type}`);
    
    // Validate request data
    if (!request || !request.id) {
      throw new Error('Invalid request data');
    }
    
    // Generate the PDF document
    logExport('pdf', 'Generating PDF content');
    const doc = await generateRequestPDF(request, type);
    
    // Prepare the PDF name
    const pdfName = `Purchase_Request_${request.requestNumber || request.id}_${type}.pdf`;
    
    // Get the PDF as a blob
    logExport('pdf', 'Converting PDF to blob');
    const pdfBlob = doc.output('blob');
    
    // Use our safer download method
    logExport('pdf', `Initiating PDF download: ${pdfName} (${pdfBlob.size} bytes)`);
    await safeDownload(pdfBlob, pdfName);
    
    logExport('pdf', `PDF export completed successfully: ${pdfName}`);
    return pdfName;
  } catch (error) {
    logExport('pdf', `PDF export failed:`, error);
    console.error("PDF Export Error:", error);
    throw error;
  }
}

/**
 * Download a single attachment
 * 
 * @param attachment The attachment file information
 */
export async function downloadAttachment(attachment: any) {
  try {
    logExport('attachment', `Starting download for attachment: ${attachment?.fileName || 'unknown'}`);
    
    // Validate attachment data
    if (!attachment || !attachment.fileUrl) {
      throw new Error('Invalid attachment data');
    }
    
    // Fetch the file
    logExport('attachment', `Fetching file from ${attachment.fileUrl}`);
    const response = await fetch(attachment.fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.status} ${response.statusText}`);
    }
    
    // Get the blob data
    const blob = await response.blob();
    
    // Prepare the file name
    const fileName = attachment.fileName || attachment.name || `file_${attachment.id || 'unknown'}`;
    
    // Use our safer download method
    logExport('attachment', `Downloading attachment: ${fileName} (${blob.size} bytes)`);
    await safeDownload(blob, fileName);
    
    logExport('attachment', 'Attachment download completed successfully');
    return fileName;
  } catch (error) {
    logExport('attachment', 'Attachment download failed:', error);
    throw error;
  }
}

/**
 * Converts the purchase request data to a formatted JSON string
 * 
 * @param request The purchase request data
 * @returns A formatted JSON string
 */
function formatRequestJSON(request: any): string {
  // Create a simplified version of the request for better readability with null/undefined protection
  try {
    // Return empty JSON if request is null or undefined
    if (!request) {
      return JSON.stringify({ error: "No request data available" }, null, 2);
    }
    
    const simplifiedRequest = {
      id: request.id || 0,
      requestNumber: request.requestNumber || `REQ-${request.id || 'unknown'}`,
      title: request.title || 'Untitled Request',
      description: request.description || '',
      status: request.status || 'draft',
      priority: request.priority || 'medium',
      createdAt: request.createdAt || new Date().toISOString(),
      updatedAt: request.updatedAt || new Date().toISOString(),
      requester: request.requester ? {
        id: request.requester.id || 0,
        username: request.requester.username || 'Unknown User',
        department: request.requester.department || 'Unknown'
      } : {
        id: 0,
        username: 'Unknown User',
        department: 'Unknown'
      },
      vendor: request.vendor ? {
        id: request.vendor.id || 0,
        name: request.vendor.companyName || request.vendor.name || 'Unknown Vendor',
        contactPerson: request.vendor.contactPerson || 'N/A',
        email: request.vendor.email || 'N/A',
        phone: request.vendor.contactNumber || request.vendor.phone || 'N/A'
      } : null,
      purposeType: request.purposeType || 'N/A',
      subPurpose: request.subPurpose ? {
        id: request.subPurpose.id || 0,
        name: request.subPurpose.name || 'N/A'
      } : null,
      items: Array.isArray(request.items) ? request.items.map((item: any) => ({
        id: item?.id || 0,
        name: item?.name || 'Unnamed Item',
        quantity: typeof item?.quantity === 'number' ? item.quantity : 0,
        estimatedCost: typeof item?.estimatedCost === 'number' ? item.estimatedCost : 0,
        description: item?.description || ''
      })) : [],
      approvals: Array.isArray(request.approvals) ? request.approvals.map((approval: any) => ({
        id: approval?.id || 0,
        status: approval?.status || 'pending',
        department: approval?.department || 'N/A',
        approver: approval?.approver?.username || 'N/A',
        processedAt: approval?.processedAt || null,
        comments: approval?.comments || ''
      })) : [],
      attachments: Array.isArray(request.attachments) ? request.attachments.map((attachment: any) => ({
        id: attachment?.id || 0,
        fileName: attachment?.fileName || attachment?.name || 'unnamed-file',
        fileType: attachment?.fileType || attachment?.type || 'unknown',
        fileSize: attachment?.fileSize || attachment?.size || 0,
        fileUrl: attachment?.fileUrl || ''
      })) : []
    };
    
    return JSON.stringify(simplifiedRequest, null, 2);
  } catch (error) {
    console.error('Error formatting request JSON:', error);
    return JSON.stringify({ error: "Failed to format request data" }, null, 2);
  }
}

/**
 * Exports a purchase request with all data and attachments as a ZIP file
 * 
 * @param request The purchase request data
 * @param includeAttachments Whether to include the attachments in the ZIP
 * @param type The user type (user, approver, admin) - affects what data is included
 * @returns The name of the generated file
 */
export async function exportRequestAsZip(
  request: any, 
  includeAttachments: boolean = true, 
  type: 'user' | 'approver' | 'admin' = 'user'
): Promise<string> {
  try {
    logExport('zip', `Starting ZIP export for request ${request.id || 'unknown'}`);
    
    // Validate request data
    if (!request || !request.id) {
      throw new Error('Invalid request data');
    }
    
    const zip = new JSZip();
    const folderName = `request_${request.requestNumber || request.id}`;
    logExport('zip', `Creating folder: ${folderName}`);
    const folder = zip.folder(folderName);
    
    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }
    
    // Add purchase request data as JSON
    logExport('zip', 'Adding request data as JSON');
    folder.file('request-data.json', formatRequestJSON(request));
    
    // Add request PDF 
    logExport('zip', `Generating PDF for ${type} view`);
    const doc = await generateRequestPDF(request, type);
    const pdfData = doc.output('blob');
    folder.file(`Purchase_Request_${request.requestNumber || request.id}.pdf`, pdfData);
    
    // If admin export, include all PDFs
    if (type === 'admin') {
      logExport('zip', 'Adding user and approver PDFs for admin export');
      const userPdf = await generateRequestPDF(request, 'user');
      const approverPdf = await generateRequestPDF(request, 'approver');
      
      folder.file(`Purchase_Request_${request.requestNumber || request.id}_user.pdf`, userPdf.output('blob'));
      folder.file(`Purchase_Request_${request.requestNumber || request.id}_approver.pdf`, approverPdf.output('blob'));
    }
    
    // Add attachments if required
    if (includeAttachments && request.attachments?.length > 0) {
      logExport('zip', `Adding ${request.attachments.length} attachments`);
      const attachmentsFolder = folder.folder('attachments');
      
      if (!attachmentsFolder) {
        throw new Error('Failed to create attachments folder');
      }
      
      // Process each attachment
      const attachmentPromises = request.attachments.map(async (attachment: any) => {
        try {
          logExport('zip', `Fetching attachment: ${attachment.fileName || attachment.name || attachment.id}`);
          const response = await fetch(attachment.fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch attachment: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const fileName = attachment.fileName || attachment.name || `file_${attachment.id}`;
          attachmentsFolder.file(fileName, blob);
        } catch (error) {
          logExport('zip', `Error processing attachment ${attachment.id}:`, error);
          // Continue with other attachments even if one fails
        }
      });
      
      // Wait for all attachments to be processed
      logExport('zip', 'Waiting for all attachments to be processed');
      await Promise.all(attachmentPromises);
    }
    
    // Generate the zip file and trigger download
    logExport('zip', 'Generating compressed ZIP file');
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const zipFileName = `${folderName}.zip`;
    
    // Use our safer download method
    logExport('zip', `Initiating ZIP download: ${zipFileName} (${content.size} bytes)`);
    await safeDownload(content, zipFileName);
    
    logExport('zip', 'ZIP export completed successfully');
    return zipFileName;
  } catch (error) {
    logExport('zip', 'ZIP export failed:', error);
    throw error;
  }
}

/**
 * Exports purchase request data to Excel format
 * 
 * @param request The purchase request data to export
 * @param includeDetails Whether to include detailed information (approvals, attachments)
 * @returns The name of the generated file
 */
export async function exportRequestToExcel(request: any, includeDetails: boolean = true): Promise<string> {
  try {
    logExport('excel', `Starting Excel export for request ${request?.id || 'unknown'}`);
    
    // Validate request data - more lenient to allow mock data testing
    if (!request) {
      throw new Error('Invalid request data - request is undefined or null');
    }
    
    // Create simplified request object for basic information with safe type handling
    logExport('excel', 'Creating basic request information sheet');
    
    // Handle data more defensively to prevent Excel issues
    const safeString = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      return String(value);
    };
    
    const safeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };
    
    const safeDate = (dateStr: any): string => {
      if (!dateStr) return 'N/A';
      try {
        const date = new Date(dateStr);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
      } catch (e) {
        return 'N/A';
      }
    };
    
    const requestData = {
      'Request Number': safeString(request.requestNumber) || `REQ-${safeString(request.id) || 'new'}`,
      'Title': safeString(request.title) || 'Untitled Request',
      'Status': safeString(request.status) || 'draft',
      'Priority': safeString(request.priority) || 'medium',
      'Created Date': safeDate(request.createdAt),
      'Requester': safeString(request.requester?.username) || 'Unknown',
      'Department': safeString(request.requester?.department) || 'N/A',
      'Purpose Type': safeString(request.purposeType) || 'N/A',
      'Sub-Purpose': safeString(request.subPurpose?.name) || 'N/A',
      'Description': safeString(request.description) || '',
      'Total Estimated Cost': calculateTotalCost(request), // Already handles null values safely
      'Currency': safeString(request.currency) || 'USD',
      'Vendor': safeString(request.vendor?.companyName || request.vendor?.name) || 'N/A'
    };
    
    // Create workbook and add requests worksheet
    const wb = XLSX.utils.book_new();
    const wsRequest = XLSX.utils.json_to_sheet([requestData]);
    XLSX.utils.book_append_sheet(wb, wsRequest, 'Request Info');
    
    // Add items worksheet if there are items
    if (Array.isArray(request.items) && request.items.length > 0) {
      try {
        logExport('excel', `Adding ${request.items.length} items to Excel workbook`);
        const items = request.items.map((item: any, index: number) => ({
          'Item #': index + 1,
          'Name': safeString(item?.name) || 'Unnamed Item',
          'Quantity': safeNumber(item?.quantity),
          'Estimated Cost': safeNumber(item?.estimatedCost),
          'Total': safeNumber(item?.quantity) * safeNumber(item?.estimatedCost),
          'Description': safeString(item?.description) || ''
        }));
        
        const wsItems = XLSX.utils.json_to_sheet(items);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
      } catch (itemError) {
        logExport('excel', 'Error processing items for Excel export:', itemError);
        const wsItemsError = XLSX.utils.aoa_to_sheet([['Error processing items']]);
        XLSX.utils.book_append_sheet(wb, wsItemsError, 'Items (Error)');
      }
    }
    
    // Add approvals worksheet if includeDetails is true
    if (includeDetails && Array.isArray(request.approvals) && request.approvals.length > 0) {
      try {
        logExport('excel', `Adding ${request.approvals.length} approvals to Excel workbook`);
        const approvals = request.approvals.map((approval: any, index: number) => ({
          'Approval #': index + 1,
          'Department': safeString(approval?.department) || 'N/A',
          'Approver': safeString(approval?.approver?.username) || 'N/A',
          'Status': safeString(approval?.status) || 'pending',
          'Date': safeDate(approval?.processedAt),
          'Comments': safeString(approval?.comments) || ''
        }));
        
        const wsApprovals = XLSX.utils.json_to_sheet(approvals);
        XLSX.utils.book_append_sheet(wb, wsApprovals, 'Approvals');
      } catch (approvalError) {
        logExport('excel', 'Error processing approvals for Excel export:', approvalError);
        const wsApprovalsError = XLSX.utils.aoa_to_sheet([['Error processing approvals']]);
        XLSX.utils.book_append_sheet(wb, wsApprovalsError, 'Approvals (Error)');
      }
    }
    
    // Add attachments worksheet if includeDetails is true
    if (includeDetails && Array.isArray(request.attachments) && request.attachments.length > 0) {
      try {
        logExport('excel', `Adding ${request.attachments.length} attachments to Excel workbook`);
        const attachments = request.attachments.map((attachment: any, index: number) => ({
          'Attachment #': index + 1,
          'File Name': safeString(attachment?.fileName || attachment?.name) || `file_${safeString(attachment?.id) || index}`,
          'File Type': safeString(attachment?.fileType || attachment?.type) || 'Unknown',
          'File Size (bytes)': safeNumber(attachment?.fileSize || attachment?.size),
          'Download URL': safeString(attachment?.fileUrl) || 'N/A'
        }));
        
        const wsAttachments = XLSX.utils.json_to_sheet(attachments);
        XLSX.utils.book_append_sheet(wb, wsAttachments, 'Attachments');
      } catch (attachmentError) {
        logExport('excel', 'Error processing attachments for Excel export:', attachmentError);
        const wsAttachmentsError = XLSX.utils.aoa_to_sheet([['Error processing attachments']]);
        XLSX.utils.book_append_sheet(wb, wsAttachmentsError, 'Attachments (Error)');
      }
    }
    
    // Generate Excel file and trigger download
    const requestIdentifier = safeString(request.requestNumber || request.id || 'unknown');
    const fileName = `Purchase_Request_${requestIdentifier}.xlsx`;
    
    try {
      // Create a blob from the workbook
      logExport('excel', 'Converting Excel workbook to binary data');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Use our safer download method
      logExport('excel', `Initiating Excel download: ${fileName}`);
      await safeDownload(blob, fileName);
      
      logExport('excel', 'Excel export completed successfully');
      return fileName;
    } catch (downloadError) {
      logExport('excel', 'Excel file generation succeeded but download failed:', downloadError);
      const errorMessage = downloadError instanceof Error 
        ? downloadError.message 
        : typeof downloadError === 'string' 
          ? downloadError 
          : 'Unknown error';
      throw new Error(`Excel generation succeeded but download failed: ${errorMessage}`);
    }
  } catch (error) {
    logExport('excel', 'Excel export failed:', error);
    throw error;
  }
}

/**
 * Calculate the total cost of a purchase request
 */
function calculateTotalCost(request: any): number {
  if (!request || !Array.isArray(request.items)) {
    return 0;
  }
  
  let total = 0;
  
  try {
    // Sum up all items cost * quantity
    total = request.items.reduce((sum: number, item: any) => {
      const quantity = Number(item?.quantity) || 0;
      const cost = Number(item?.estimatedCost) || 0;
      return sum + (quantity * cost);
    }, 0);
    
    // Add freight amount if available
    if (typeof request.freightAmount === 'number') {
      total += request.freightAmount;
    }
  } catch (error) {
    console.error('Error calculating total cost:', error);
  }
  
  return total;
}

/**
 * Exports purchase request data to CSV format
 * 
 * @param request The purchase request data to export
 * @param exportType What information to include in the CSV
 * @returns The name of the generated file
 */
// Anthropic-powered CSV encoding utility to ensure proper handling of special characters and Excel compatibility
const createEncodedCsvBlob = (csvData: string): Blob => {
  // Add UTF-8 BOM for Excel compatibility (prevents encoding issues)
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  
  // Clean the CSV data to ensure it's properly formatted
  const cleanedCsvData = csvData
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n+/g, '\n')  // Remove multiple line breaks
    .trim();
  
  // Create CSV data with robust encoding
  let finalCsvData: any;
  try {
    // First try with TextEncoder for better cross-browser compatibility
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(cleanedCsvData);
    
    // Create a new buffer with BOM at the beginning
    finalCsvData = new Uint8Array(BOM.length + encodedData.length);
    finalCsvData.set(BOM);
    finalCsvData.set(encodedData, BOM.length);
  } catch (encodeError) {
    // Fallback method if TextEncoder isn't available
    console.warn('TextEncoder not available, using fallback CSV encoding');
    // Add BOM as a string for fallback method
    const bomString = '\ufeff';
    finalCsvData = bomString + cleanedCsvData;
  }
  
  // Ensure the proper content type is set for Excel compatibility
  return new Blob([finalCsvData], { 
    type: 'text/csv;charset=utf-8' 
  });
};

export async function exportRequestToCSV(
  request: any, 
  exportType: 'basic' | 'items' | 'approvals' | 'all' = 'all'
): Promise<string> {
  try {
    logExport('csv', `Starting CSV export for request ${request?.id || 'unknown'} with type ${exportType}`);
    
    // Validate request data - more lenient to allow mock data testing
    if (!request) {
      throw new Error('Invalid request data - request is undefined or null');
    }
    
    // Add safe type handling functions
    const safeString = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      return String(value);
    };
    
    const safeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };
    
    const safeDate = (dateStr: any): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return Number.isNaN(date.getTime()) ? '' : date.toISOString();
      } catch (e) {
        return '';
      }
    };
    
    // Enhanced function to properly escape CSV values and handle all special characters
    const escapeCsvValue = (value: any): string => {
      // First, safely convert to string (handles null, undefined, etc.)
      const stringVal = safeString(value);
      
      // Always wrap strings in quotes to ensure consistent handling
      // This helps with international characters, commas, quotes, etc.
      // Double any quotes that may exist inside the string
      return `"${stringVal.replace(/"/g, '""')}"`;
    };
    
    // Create clean CSV rows from an array of objects
    const objectsToCsv = (data: Record<string, any>[]): string => {
      if (!Array.isArray(data) || data.length === 0) {
        return '';
      }
      
      // Get headers from the first object
      const headers = Object.keys(data[0]);
      
      // Create header row
      const headerRow = headers.map(h => escapeCsvValue(h)).join(',');
      
      // Create data rows
      const rows = data.map(item => {
        return headers.map(header => escapeCsvValue(item[header])).join(',');
      });
      
      // Combine all rows
      return [headerRow, ...rows].join('\n');
    };
    
    const fileName = `Purchase_Request_${safeString(request.requestNumber || request.id || 'export')}`;
    
    if (exportType === 'basic' || exportType === 'all') {
      // Export basic request information
      try {
        logExport('csv', 'Preparing basic request data for CSV export');
        // Handle missing or malformed data gracefully
        const basicData = {
          request_number: safeString(request.requestNumber) || `REQ-${safeString(request.id) || 'new'}`,
          title: safeString(request.title) || 'Untitled Request',
          status: safeString(request.status) || 'draft',
          priority: safeString(request.priority) || 'medium',
          created_date: safeDate(request.createdAt),
          requester: safeString(request.requester?.username) || 'Unknown',
          department: safeString(request.requester?.department) || 'N/A',
          purpose_type: safeString(request.purposeType) || 'N/A',
          sub_purpose: safeString(request.subPurpose?.name) || 'N/A',
          description: safeString(request.description) || '',
          total_estimated_cost: calculateTotalCost(request),
          currency: safeString(request.currency) || 'USD',
          vendor: safeString(request.vendor?.companyName || request.vendor?.name) || 'N/A'
        };
        
        logExport('csv', `Creating CSV data for basic export`);
        let csvData;
        
        try {
          // First try to use Parser if available
          const parser = new Parser({
            header: true,
            delimiter: ','
          });
          csvData = parser.parse([basicData]);
        } catch (parserError) {
          // Fallback to our custom CSV generation
          logExport('csv', `CSV Parser failed, using fallback method`, parserError);
          csvData = objectsToCsv([basicData]);
          
          // If that fails too, use even simpler method
          if (!csvData) {
            csvData = 'Property,Value\n' + 
                     Object.entries(basicData)
                     .map(([key, value]) => `${escapeCsvValue(key)},${escapeCsvValue(value)}`)
                     .join('\n');
          }
        }
        
        const basicFileName = `${fileName}_basic.csv`;
        
        // Use Anthropic-powered robust CSV encoding
        const csvBlob = createEncodedCsvBlob(csvData);
        
        // Use our safer download method
        await safeDownload(csvBlob, basicFileName);
        
        if (exportType === 'basic') {
          logExport('csv', `Basic CSV export complete: ${basicFileName}`);
          return basicFileName;
        }
      } catch (basicError) {
        // Use anthropic-powered error analysis with more robust error handling
        logExport('csv', `Error exporting basic data to CSV:`, basicError);
        if (exportType === 'basic') {
          // Properly handle the error type to avoid LSP errors
          const errorMessage = basicError instanceof Error 
            ? basicError.message 
            : typeof basicError === 'string' 
              ? basicError 
              : 'Unknown error';
          throw new Error(`Failed to export basic data to CSV: ${errorMessage}`);
        }
      }
    }
    
    if (exportType === 'items' || exportType === 'all') {
      // Export items information
      if (Array.isArray(request.items) && request.items.length > 0) {
        try {
          logExport('csv', `Preparing items data for CSV export (${request.items.length} items)`);
          const items = request.items.map((item: any, index: number) => ({
            item_number: index + 1,
            name: safeString(item?.name) || 'Unnamed Item',
            quantity: safeNumber(item?.quantity),
            estimated_cost: safeNumber(item?.estimatedCost),
            total: safeNumber(item?.quantity) * safeNumber(item?.estimatedCost),
            description: safeString(item?.description) || ''
          }));
          
          let csvData;
          try {
            const parser = new Parser({
              header: true,
              delimiter: ','
            });
            csvData = parser.parse(items);
          } catch (parserError) {
            // Fallback to our custom CSV generation
            logExport('csv', `CSV Parser failed for items, using fallback method`, parserError);
            csvData = objectsToCsv(items);
          }
          
          const itemsFileName = `${fileName}_items.csv`;
          
          // Use Anthropic-powered robust CSV encoding
          const csvBlob = createEncodedCsvBlob(csvData);
          
          // Use our safer download method
          await safeDownload(csvBlob, itemsFileName);
          
          if (exportType === 'items') {
            logExport('csv', `Items CSV export complete: ${itemsFileName}`);
            return itemsFileName;
          }
        } catch (itemsError) {
          // Use anthropic-powered error analysis with more robust error handling
          logExport('csv', `Error exporting items to CSV:`, itemsError);
          if (exportType === 'items') {
            // Properly handle the error type to avoid LSP errors
            const errorMessage = itemsError instanceof Error 
              ? itemsError.message 
              : typeof itemsError === 'string' 
                ? itemsError 
                : 'Unknown error';
            throw new Error(`Failed to export items to CSV: ${errorMessage}`);
          }
        }
      } else if (exportType === 'items') {
        logExport('csv', `No items found, creating empty CSV`);
        const noItemsFileName = `${fileName}_no_items.csv`;
        
        // Use Anthropic-powered robust CSV encoding
        const csvBlob = createEncodedCsvBlob('No items found');
        
        await safeDownload(csvBlob, noItemsFileName);
        return noItemsFileName;
      }
    }
    
    if (exportType === 'approvals' || exportType === 'all') {
      // Export approvals information
      if (Array.isArray(request.approvals) && request.approvals.length > 0) {
        try {
          logExport('csv', `Preparing approvals data for CSV export (${request.approvals.length} approvals)`);
          const approvals = request.approvals.map((approval: any, index: number) => ({
            approval_number: index + 1,
            department: safeString(approval?.department) || 'N/A',
            approver: safeString(approval?.approver?.username) || 'N/A',
            status: safeString(approval?.status) || 'pending',
            processed_date: safeDate(approval?.processedAt),
            comments: safeString(approval?.comments) || ''
          }));
          
          let csvData;
          try {
            const parser = new Parser({
              header: true,
              delimiter: ','
            });
            csvData = parser.parse(approvals);
          } catch (parserError) {
            // Fallback to our custom CSV generation
            logExport('csv', `CSV Parser failed for approvals, using fallback method`, parserError);
            csvData = objectsToCsv(approvals);
          }
          
          const approvalsFileName = `${fileName}_approvals.csv`;
          
          // Use Anthropic-powered robust CSV encoding
          const csvBlob = createEncodedCsvBlob(csvData);
          
          // Use our safer download method
          await safeDownload(csvBlob, approvalsFileName);
          
          if (exportType === 'approvals') {
            logExport('csv', `Approvals CSV export complete: ${approvalsFileName}`);
            return approvalsFileName;
          }
        } catch (approvalsError) {
          // Use anthropic-powered error analysis with more robust error handling
          logExport('csv', `Error exporting approvals to CSV:`, approvalsError);
          if (exportType === 'approvals') {
            // Properly handle the error type to avoid LSP errors
            const errorMessage = approvalsError instanceof Error 
              ? approvalsError.message 
              : typeof approvalsError === 'string' 
                ? approvalsError 
                : 'Unknown error';
            throw new Error(`Failed to export approvals to CSV: ${errorMessage}`);
          }
        }
      } else if (exportType === 'approvals') {
        logExport('csv', `No approvals found, creating empty CSV`);
        const noApprovalsFileName = `${fileName}_no_approvals.csv`;
        
        // Use Anthropic-powered robust CSV encoding
        const csvBlob = createEncodedCsvBlob('No approvals found');
        
        await safeDownload(csvBlob, noApprovalsFileName);
        return noApprovalsFileName;
      }
    }
    
    if (exportType === 'all') {
      logExport('csv', `All CSV exports completed successfully`);
      return `${fileName}_all.csv`;
    }
    
    return `${fileName}.csv`;
  } catch (error) {
    logExport('csv', `CSV export failed:`, error);
    throw error;
  }
}

/**
 * Exports multiple purchase requests to Excel format
 * 
 * @param requests Array of purchase requests to export
 * @returns The name of the generated Excel file
 */
export async function exportMultipleRequestsToExcel(requests: any[]): Promise<string> {
  try {
    logExport('bulkExcel', `Starting bulk Excel export for ${requests?.length || 0} requests`);
    console.log('Exporting data:', requests);
    
    // Validate requests data
    if (!Array.isArray(requests) || requests.length === 0) {
      console.error('Error exporting data:', requests);
      throw new Error('No valid requests to export');
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create summary sheet
    logExport('bulkExcel', 'Creating summary sheet');
    const summary = requests.map((req, index) => ({
      'Request #': index + 1,
      'Request Number': req.requestNumber || `REQ-${req.id || index}`,
      'Title': req.title || 'Untitled Request',
      'Status': req.status || 'draft',
      'Priority': req.priority || 'medium',
      'Created Date': req.createdAt ? new Date(req.createdAt).toLocaleString() : 'N/A',
      'Requester': req.requester?.username || 'Unknown',
      'Department': req.requester?.department || 'N/A',
      'Total Cost': calculateTotalCost(req) || 0,
      'Vendor': req.vendor?.companyName || req.vendor?.name || 'N/A'
    }));
    
    // Create the summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    
    // Add column width specifications
    const summaryColWidths = [
      { wch: 10 },  // Request #
      { wch: 20 },  // Request Number
      { wch: 40 },  // Title
      { wch: 12 },  // Status
      { wch: 12 },  // Priority
      { wch: 20 },  // Created Date
      { wch: 20 },  // Requester
      { wch: 20 },  // Department
      { wch: 12 },  // Total Cost
      { wch: 30 }   // Vendor
    ];
    wsSummary['!cols'] = summaryColWidths;
    
    // Add the sheet to the workbook
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Add individual request sheets for the first 10 requests 
    // (to avoid extremely large files)
    const maxDetailedRequests = Math.min(requests.length, 10);
    logExport('bulkExcel', `Adding detailed sheets for ${maxDetailedRequests} requests`);
    
    for (let i = 0; i < maxDetailedRequests; i++) {
      try {
        const request = requests[i];
        const requestNumber = request.requestNumber || request.id || `Request_${i+1}`;
        logExport('bulkExcel', `Processing request ${i+1}/${maxDetailedRequests}: ${requestNumber}`);
        
        // Prepare request data
        const requestData = [
          ['Request Number', requestNumber],
          ['Title', request.title || 'Untitled Request'],
          ['Status', request.status || 'draft'],
          ['Priority', request.priority || 'medium'],
          ['Created Date', request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'],
          ['Requester', request.requester?.username || 'Unknown'],
          ['Department', request.requester?.department || 'N/A'],
          ['Purpose Type', request.purposeType || 'N/A'],
          ['Sub-Purpose', request.subPurpose?.name || 'N/A'],
          ['Description', request.description || ''],
          ['Total Cost', calculateTotalCost(request) || 0],
          ['Currency', request.currency || 'USD'],
          ['Vendor', request.vendor?.companyName || request.vendor?.name || 'N/A']
        ];
        
        // Add items if available
        if (Array.isArray(request.items) && request.items.length > 0) {
          logExport('bulkExcel', `Adding ${request.items.length} items for request ${requestNumber}`);
          requestData.push([]);
          requestData.push(['Items:']);
          requestData.push(['Item #', 'Name', 'Quantity', 'Est. Cost', 'Total', 'Description']);
          
          request.items.forEach((item: any, index: number) => {
            const quantity = Number(item?.quantity) || 0;
            const cost = Number(item?.estimatedCost) || 0;
            requestData.push([
              index + 1,
              item?.name || 'Unnamed Item',
              quantity,
              cost,
              quantity * cost,
              item?.description || ''
            ]);
          });
        }
        
        // Add approvals if available
        if (Array.isArray(request.approvals) && request.approvals.length > 0) {
          logExport('bulkExcel', `Adding ${request.approvals.length} approvals for request ${requestNumber}`);
          requestData.push([]);
          requestData.push(['Approvals:']);
          requestData.push(['Dept.', 'Approver', 'Status', 'Date', 'Comments']);
          
          request.approvals.forEach((approval: any) => {
            requestData.push([
              approval?.department || 'N/A',
              approval?.approver?.username || 'N/A',
              approval?.status || 'pending',
              approval?.processedAt ? new Date(approval?.processedAt).toLocaleString() : 'N/A',
              approval?.comments || ''
            ]);
          });
        }
        
        // Add detailed request data as a worksheet
        const wsRequest = XLSX.utils.aoa_to_sheet(requestData);
        
        // Set column widths for better readability
        const requestColWidths = [
          { wch: 25 },  // Property names
          { wch: 50 }   // Values
        ];
        wsRequest['!cols'] = requestColWidths;
        
        // Apply some basic styling
        // Get the range of cells (e.g., A1:B13)
        const range = XLSX.utils.decode_range(wsRequest['!ref'] || 'A1:B13');
        
        // Merge header cells to create a better layout
        wsRequest['!merges'] = [];
        
        // Add section titles as merged cells
        if (Array.isArray(request.items) && request.items.length > 0) {
          // Find the items section row
          const itemsStartIndex = requestData.findIndex(row => row[0] === 'Items:');
          if (itemsStartIndex > 0) {
            // Merge the "Items:" cell across all columns
            wsRequest['!merges'].push({ 
              s: { r: itemsStartIndex, c: 0 }, 
              e: { r: itemsStartIndex, c: 5 } 
            });
          }
        }
        
        if (Array.isArray(request.approvals) && request.approvals.length > 0) {
          // Find the approvals section row
          const approvalsStartIndex = requestData.findIndex(row => row[0] === 'Approvals:');
          if (approvalsStartIndex > 0) {
            // Merge the "Approvals:" cell across all columns
            wsRequest['!merges'].push({ 
              s: { r: approvalsStartIndex, c: 0 }, 
              e: { r: approvalsStartIndex, c: 4 } 
            });
          }
        }
        
        // Add the sheet to the workbook with a clean name
        XLSX.utils.book_append_sheet(wb, wsRequest, `REQ-${i+1}`);
      } catch (requestError) {
        logExport('bulkExcel', `Error processing request ${i+1}:`, requestError);
      }
    }
    
    // Generate Excel file and trigger download
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `Purchase_Requests_Export_${timestamp}.xlsx`;
    
    // Create a blob from the workbook
    logExport('bulkExcel', 'Converting Excel workbook to binary data');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Use our safer download method
    logExport('bulkExcel', `Initiating bulk Excel download: ${fileName}`);
    await safeDownload(blob, fileName);
    
    logExport('bulkExcel', 'Bulk Excel export completed successfully');
    return fileName;
  } catch (error) {
    logExport('bulkExcel', 'Bulk Excel export failed:', error);
    throw error;
  }
}

/**
 * Exports multiple purchase requests as a ZIP file
 * 
 * @param requests Array of purchase requests to export
 * @param type The user type (user, approver, admin) - affects what data is included
 * @returns The name of the generated ZIP file
 */
export async function exportMultipleRequestsAsZip(
  requests: any[], 
  type: 'user' | 'approver' | 'admin' = 'admin'
): Promise<string> {
  try {
    logExport('bulkZip', `Starting bulk ZIP export for ${requests?.length || 0} requests`);
    
    // Validate requests array
    if (!Array.isArray(requests)) {
      throw new Error('Invalid requests data: Expected an array');
    }
    
    if (requests.length === 0) {
      throw new Error('No requests to export');
    }
    
    // Create the ZIP file
    const zip = new JSZip();
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const mainFolder = zip.folder(`purchase_requests_export_${timestamp}`);
    
    if (!mainFolder) {
      throw new Error('Failed to create main ZIP folder');
    }
    
    // Add index file with summary
    logExport('bulkZip', 'Creating summary index file');
    const summary = {
      exportDate: new Date().toISOString(),
      totalRequests: requests.length,
      exportType: type,
      requests: requests.map(req => ({
        id: req.id,
        requestNumber: req.requestNumber,
        title: req.title,
        status: req.status,
        createdAt: req.createdAt
      }))
    };
    mainFolder.file('export-summary.json', JSON.stringify(summary, null, 2));
    
    // Process each request with error handling
    logExport('bulkZip', 'Processing requests one by one...');
    let successCount = 0;
    let failureCount = 0;
    const errors: Record<string, string> = {};
    
    const requestPromises = requests.map(async (request, index) => {
      try {
        // Validate request object
        if (!request || !request.id) {
          logExport('bulkZip', `Skipping invalid request at index ${index}`);
          failureCount++;
          errors[`request_${index}`] = 'Invalid request data';
          return;
        }
        
        const requestNumber = request.requestNumber || request.id;
        const folderName = `request_${requestNumber}`;
        const folder = mainFolder.folder(folderName);
        
        if (!folder) {
          logExport('bulkZip', `Failed to create folder for request ${requestNumber}`);
          failureCount++;
          errors[`request_${requestNumber}`] = 'Failed to create folder';
          return;
        }
        
        // Add request data as JSON
        try {
          logExport('bulkZip', `Adding JSON data for request ${requestNumber}`);
          folder.file('request-data.json', formatRequestJSON(request));
        } catch (jsonError: any) {
          logExport('bulkZip', `Error creating JSON for request ${requestNumber}:`, jsonError);
          folder.file('json-error.txt', `Failed to format JSON: ${jsonError.message || 'Unknown error'}`);
        }
        
        // Add PDF file
        try {
          logExport('bulkZip', `Generating PDF for request ${requestNumber}`);
          const doc = await generateRequestPDF(request, type);
          const pdfData = doc.output('blob');
          folder.file(`Purchase_Request_${requestNumber}.pdf`, pdfData);
        } catch (pdfError: any) {
          logExport('bulkZip', `Error generating PDF for request ${requestNumber}:`, pdfError);
          folder.file('pdf-error.txt', `Failed to generate PDF: ${pdfError.message || 'Unknown error'}`);
          errors[`request_${requestNumber}_pdf`] = pdfError.message || 'Unknown PDF generation error';
        }
        
        // Add attachments information if available
        if (request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
          try {
            logExport('bulkZip', `Processing ${request.attachments.length} attachments for request ${requestNumber}`);
            const attachmentsFolder = folder.folder('attachments');
            
            if (!attachmentsFolder) {
              logExport('bulkZip', `Failed to create attachments folder for request ${requestNumber}`);
            } else {
              // Only include metadata about attachments
              const attachmentsData = request.attachments.map((a: any) => ({
                fileName: a.fileName || a.name || `file_${a.id}`,
                fileType: a.fileType || a.type || 'application/octet-stream',
                fileSize: a.fileSize || a.size || 0,
                downloadUrl: a.fileUrl
              }));
              
              attachmentsFolder.file('attachments-metadata.json', JSON.stringify(attachmentsData, null, 2));
            }
          } catch (attachmentError: any) {
            logExport('bulkZip', `Error processing attachments for request ${requestNumber}:`, attachmentError);
            errors[`request_${requestNumber}_attachments`] = attachmentError.message || 'Error processing attachments';
          }
        }
        
        successCount++;
        logExport('bulkZip', `Processed request ${index + 1}/${requests.length}: ${requestNumber}`);
      } catch (requestError: any) {
        logExport('bulkZip', `Error processing request ${index + 1}/${requests.length}:`, requestError);
        failureCount++;
        errors[`request_${index + 1}`] = requestError.message || 'Unknown error';
      }
    });
    
    // Wait for all requests to be processed
    logExport('bulkZip', 'Waiting for all request processing to complete...');
    await Promise.all(requestPromises);
    
    // Add processing summary and error log
    logExport('bulkZip', `Processing complete. Success: ${successCount}, Failures: ${failureCount}`);
    mainFolder.file('processing-log.txt', 
      `Export completed at: ${new Date().toISOString()}\n` +
      `Total requests: ${requests.length}\n` +
      `Successfully processed: ${successCount}\n` +
      `Failed to process: ${failureCount}\n\n` +
      (Object.keys(errors).length > 0 ? 
        `Errors encountered:\n${Object.entries(errors).map(([key, msg]) => `- ${key}: ${msg}`).join('\n')}` : 
        'No errors encountered during processing.')
    );
    
    // Generate and download the ZIP file
    logExport('bulkZip', 'Generating compressed ZIP file...');
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const filename = `purchase_requests_export_${new Date().toISOString().split('T')[0]}.zip`;
    
    // Use our safer download method
    logExport('bulkZip', `Initiating ZIP download: ${filename} (${content.size} bytes)`);
    await safeDownload(content, filename);
    
    logExport('bulkZip', 'Bulk ZIP export completed successfully');
    return filename;
  } catch (error: any) {
    logExport('bulkZip', 'Bulk ZIP export failed:', error);
    throw new Error(`Bulk export failed: ${error.message || 'Unknown error'}`);
  }
}