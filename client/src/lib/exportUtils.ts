/**
 * Export Utilities for Purchase Request System
 * 
 * This module provides functions to export purchase requests in various formats
 * including CSV, Excel, and ZIP. It handles data formatting, serialization,
 * and download operations for both single and bulk exports.
 */

import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateRequestPDF } from './pdfGenerator';

/**
 * Log export operations for debugging and tracking
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
 * Safely download a file using FileSaver with fallbacks
 */
export async function safeDownload(blob: Blob, fileName: string): Promise<boolean> {
  try {
    logExport('download', `Initiating download for ${fileName} (${blob.size} bytes)`);
    
    // Use FileSaver library for cross-browser compatibility
    saveAs(blob, fileName);
    logExport('download', `Download completed for ${fileName}`);
    return true;
  } catch (error) {
    logExport('download', `Primary download method failed, trying fallback`, error);
    
    try {
      // Fallback: using URL.createObjectURL and download attribute
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      logExport('download', `Fallback download completed for ${fileName}`);
      return true;
    } catch (fallbackError) {
      logExport('download', `All download methods failed for ${fileName}`, fallbackError);
      throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Calculate the total cost of a purchase request
 */
function calculateTotalCost(request: any): number {
  try {
    if (request.totalEstimatedCost && typeof request.totalEstimatedCost === 'number') {
      return request.totalEstimatedCost;
    }

    let total = 0;
    
    // Sum up item costs
    if (Array.isArray(request.items)) {
      total = request.items.reduce((sum: number, item: any) => {
        const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
        const cost = typeof item.estimatedCost === 'number' ? item.estimatedCost : 0;
        return sum + (quantity * cost);
      }, 0);
    }
    
    // Add freight amount if available
    if (request.freightAmount && typeof request.freightAmount === 'number') {
      total += request.freightAmount;
    }
    
    return total;
  } catch (error) {
    console.error('Error calculating total cost:', error);
    return 0;
  }
}

/**
 * Format a purchase request for export
 */
function formatRequestForExport(request: any) {
  if (!request) return null;
  
  // Create a flattened version of the request data suitable for export
  return {
    id: request.id || 0,
    request_number: request.requestNumber || `REQ-${request.id || 'unknown'}`,
    title: request.title || 'Untitled Request',
    description: request.description || '',
    status: request.status || 'draft',
    priority: request.priority || 'medium',
    purpose_type: request.purposeType || 'N/A',
    sub_purpose: request.subPurpose?.name || 'N/A',
    created_at: request.createdAt ? new Date(request.createdAt).toISOString() : new Date().toISOString(),
    updated_at: request.updatedAt ? new Date(request.updatedAt).toISOString() : new Date().toISOString(),
    
    requester_name: request.requester?.username || 'Unknown',
    requester_department: request.requester?.department || 'N/A',
    
    vendor_name: request.vendor?.companyName || request.vendor?.name || 'N/A',
    vendor_contact: request.vendor?.contactPerson || 'N/A',
    vendor_email: request.vendor?.email || 'N/A',
    vendor_phone: request.vendor?.contactNumber || request.vendor?.phone || 'N/A',
    
    total_cost: calculateTotalCost(request),
    currency: request.currency || 'USD',
    freight_amount: request.freightAmount || 0,
    
    items_count: Array.isArray(request.items) ? request.items.length : 0,
    approvals_count: Array.isArray(request.approvals) ? request.approvals.length : 0,
    attachments_count: Array.isArray(request.attachments) ? request.attachments.length : 0
  };
}

/**
 * Format items for export
 */
function formatItemsForExport(request: any) {
  if (!request || !Array.isArray(request.items) || request.items.length === 0) {
    return [];
  }
  
  return request.items.map((item: any, index: number) => ({
    item_number: index + 1,
    request_number: request.requestNumber || `REQ-${request.id || 'unknown'}`,
    name: item.name || 'Unnamed Item',
    description: item.description || '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    unit_cost: typeof item.estimatedCost === 'number' ? item.estimatedCost : 0,
    total_cost: (typeof item.quantity === 'number' && typeof item.estimatedCost === 'number') 
      ? item.quantity * item.estimatedCost 
      : 0
  }));
}

/**
 * Format approvals for export
 */
function formatApprovalsForExport(request: any) {
  if (!request || !Array.isArray(request.approvals) || request.approvals.length === 0) {
    return [];
  }
  
  return request.approvals.map((approval: any, index: number) => ({
    approval_number: index + 1,
    request_number: request.requestNumber || `REQ-${request.id || 'unknown'}`,
    department: approval.department || 'N/A',
    approver: approval.approver?.username || 'N/A',
    status: approval.status || 'pending',
    processed_at: approval.processedAt ? new Date(approval.processedAt).toISOString() : '',
    comments: approval.comments || ''
  }));
}

/**
 * Export a purchase request to CSV format
 */
export async function exportRequestToCSV(request: any): Promise<string> {
  try {
    logExport('csv', `Starting CSV export for request ${request.id || 'unknown'}`);
    
    if (!request) {
      throw new Error('Invalid request data');
    }
    
    // Create a simplified flattened object for CSV export
    const exportData = formatRequestForExport(request);
    
    // Add BOM for proper Excel handling with Unicode
    const parser = new Parser();
    const csvContent = '\ufeff' + parser.parse([exportData]);
    
    // Create a blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    
    // Download the file
    const fileName = `Purchase_Request_${request.requestNumber || request.id}.csv`;
    await safeDownload(blob, fileName);
    
    logExport('csv', `CSV export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('csv', `CSV export failed:`, error);
    throw error;
  }
}

/**
 * Export a purchase request to Excel format with multiple sheets
 */
export async function exportRequestToExcel(request: any): Promise<string> {
  try {
    logExport('excel', `Starting Excel export for request ${request.id || 'unknown'}`);
    
    if (!request) {
      throw new Error('Invalid request data');
    }
    
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Add the main request data sheet
    const mainData = formatRequestForExport(request);
    const wsMain = XLSX.utils.json_to_sheet([mainData]);
    XLSX.utils.book_append_sheet(wb, wsMain, 'Request Info');
    
    // Add items sheet if available
    if (Array.isArray(request.items) && request.items.length > 0) {
      const itemsData = formatItemsForExport(request);
      const wsItems = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
    }
    
    // Add approvals sheet if available
    if (Array.isArray(request.approvals) && request.approvals.length > 0) {
      const approvalsData = formatApprovalsForExport(request);
      const wsApprovals = XLSX.utils.json_to_sheet(approvalsData);
      XLSX.utils.book_append_sheet(wb, wsApprovals, 'Approvals');
    }
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: true
    });
    
    // Create a blob with the Excel content
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Download the file
    const fileName = `Purchase_Request_${request.requestNumber || request.id}.xlsx`;
    await safeDownload(blob, fileName);
    
    logExport('excel', `Excel export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('excel', `Excel export failed:`, error);
    throw error;
  }
}

/**
 * Export a purchase request to PDF format
 */
export async function exportRequestToPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
  try {
    logExport('pdf', `Starting PDF export for request ${request.id || 'unknown'} with type ${type}`);
    
    if (!request) {
      throw new Error('Invalid request data');
    }
    
    // Generate the PDF document
    const doc = await generateRequestPDF(request, type);
    
    // Get the PDF as a blob
    const pdfBlob = doc.output('blob');
    
    // Download the file
    const fileName = `Purchase_Request_${request.requestNumber || request.id}_${type}.pdf`;
    await safeDownload(pdfBlob, fileName);
    
    logExport('pdf', `PDF export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('pdf', `PDF export failed:`, error);
    throw error;
  }
}

/**
 * Export a purchase request to ZIP format with multiple file formats included
 */
export async function exportRequestAsZip(request: any, includeAttachments: boolean = true): Promise<string> {
  try {
    logExport('zip', `Starting ZIP export for request ${request.id || 'unknown'}`);
    
    if (!request) {
      throw new Error('Invalid request data');
    }
    
    // Create a new ZIP file
    const zip = new JSZip();
    
    // Create a folder for the request
    const folderName = `request_${request.requestNumber || request.id}`;
    const folder = zip.folder(folderName);
    
    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }
    
    // Add request data in JSON format
    const requestData = JSON.stringify(request, null, 2);
    folder.file('request-data.json', requestData);
    
    // Add request data in CSV format
    try {
      const mainData = formatRequestForExport(request);
      const parser = new Parser();
      const csvContent = '\ufeff' + parser.parse([mainData]);
      folder.file('request-data.csv', csvContent);
      
      // Add items and approvals as separate CSV files
      if (Array.isArray(request.items) && request.items.length > 0) {
        const itemsData = formatItemsForExport(request);
        const itemsParser = new Parser();
        const itemsCsv = '\ufeff' + itemsParser.parse(itemsData);
        folder.file('items.csv', itemsCsv);
      }
      
      if (Array.isArray(request.approvals) && request.approvals.length > 0) {
        const approvalsData = formatApprovalsForExport(request);
        const approvalsParser = new Parser();
        const approvalsCsv = '\ufeff' + approvalsParser.parse(approvalsData);
        folder.file('approvals.csv', approvalsCsv);
      }
    } catch (csvError) {
      logExport('zip', 'Error creating CSV files for ZIP', csvError);
    }
    
    // Add request data in Excel format
    try {
      const wb = XLSX.utils.book_new();
      
      // Add the main request data sheet
      const mainData = formatRequestForExport(request);
      const wsMain = XLSX.utils.json_to_sheet([mainData]);
      XLSX.utils.book_append_sheet(wb, wsMain, 'Request Info');
      
      // Add items sheet if available
      if (Array.isArray(request.items) && request.items.length > 0) {
        const itemsData = formatItemsForExport(request);
        const wsItems = XLSX.utils.json_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
      }
      
      // Add approvals sheet if available
      if (Array.isArray(request.approvals) && request.approvals.length > 0) {
        const approvalsData = formatApprovalsForExport(request);
        const wsApprovals = XLSX.utils.json_to_sheet(approvalsData);
        XLSX.utils.book_append_sheet(wb, wsApprovals, 'Approvals');
      }
      
      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array',
        compression: true
      });
      
      folder.file('request-data.xlsx', excelBuffer);
    } catch (excelError) {
      logExport('zip', 'Error creating Excel file for ZIP', excelError);
    }
    
    // Add request PDF
    try {
      const doc = await generateRequestPDF(request, 'user');
      const pdfData = doc.output('blob');
      folder.file(`Purchase_Request_${request.requestNumber || request.id}.pdf`, pdfData);
    } catch (pdfError) {
      logExport('zip', 'Error creating PDF for ZIP', pdfError);
    }
    
    // Add attachments if available and requested
    if (includeAttachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
      logExport('zip', `Adding ${request.attachments.length} attachments to ZIP`);
      
      const attachmentsFolder = folder.folder('attachments');
      if (attachmentsFolder) {
        for (const attachment of request.attachments) {
          try {
            if (attachment.fileUrl) {
              const response = await fetch(attachment.fileUrl);
              if (response.ok) {
                const blob = await response.blob();
                attachmentsFolder.file(attachment.fileName || `file_${attachment.id}`, blob);
              }
            }
          } catch (attachmentError) {
            logExport('zip', `Error adding attachment ${attachment.fileName || attachment.id} to ZIP`, attachmentError);
          }
        }
      }
    }
    
    // Generate and download the ZIP file
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Download the file
    const fileName = `Purchase_Request_${request.requestNumber || request.id}.zip`;
    await safeDownload(zipBlob, fileName);
    
    logExport('zip', `ZIP export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('zip', `ZIP export failed:`, error);
    throw error;
  }
}

/**
 * Export multiple purchase requests to a combined Excel file
 */
export async function exportMultipleRequestsToExcel(requests: any[]): Promise<string> {
  try {
    logExport('bulkExcel', `Starting bulk Excel export for ${requests.length} requests`);
    
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('No valid requests to export');
    }
    
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Add main requests sheet with all requests
    const requestsData = requests.map(request => formatRequestForExport(request));
    const wsRequests = XLSX.utils.json_to_sheet(requestsData);
    XLSX.utils.book_append_sheet(wb, wsRequests, 'All Requests');
    
    // Collect all items and approvals
    const allItems: any[] = [];
    const allApprovals: any[] = [];
    
    requests.forEach(request => {
      if (Array.isArray(request.items)) {
        allItems.push(...formatItemsForExport(request));
      }
      
      if (Array.isArray(request.approvals)) {
        allApprovals.push(...formatApprovalsForExport(request));
      }
    });
    
    // Add items sheet if we have any
    if (allItems.length > 0) {
      const wsItems = XLSX.utils.json_to_sheet(allItems);
      XLSX.utils.book_append_sheet(wb, wsItems, 'All Items');
    }
    
    // Add approvals sheet if we have any
    if (allApprovals.length > 0) {
      const wsApprovals = XLSX.utils.json_to_sheet(allApprovals);
      XLSX.utils.book_append_sheet(wb, wsApprovals, 'All Approvals');
    }
    
    // Add a summary sheet
    const summary = [{
      total_requests: requests.length,
      export_date: new Date().toISOString(),
      total_items: allItems.length,
      total_approvals: allApprovals.length,
      
      draft_requests: requests.filter(r => r.status === 'draft').length,
      pending_requests: requests.filter(r => r.status === 'pending').length,
      approved_requests: requests.filter(r => r.status === 'approved').length,
      rejected_requests: requests.filter(r => r.status === 'rejected').length,
      
      total_value: requests.reduce((sum, request) => sum + calculateTotalCost(request), 0)
    }];
    
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: true
    });
    
    // Create a blob with the Excel content
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Download the file
    const fileName = `Purchase_Requests_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    await safeDownload(blob, fileName);
    
    logExport('bulkExcel', `Bulk Excel export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('bulkExcel', `Bulk Excel export failed:`, error);
    throw error;
  }
}

/**
 * Export multiple purchase requests to a combined CSV file
 */
export async function exportMultipleRequestsToCSV(requests: any[]): Promise<string> {
  try {
    logExport('bulkCsv', `Starting bulk CSV export for ${requests.length} requests`);
    
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('No valid requests to export');
    }
    
    // Format all requests
    const requestsData = requests.map(request => formatRequestForExport(request));
    
    // Generate CSV content with BOM for Excel compatibility
    const parser = new Parser();
    const csvContent = '\ufeff' + parser.parse(requestsData);
    
    // Create a blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    
    // Download the file
    const fileName = `Purchase_Requests_Export_${new Date().toISOString().split('T')[0]}.csv`;
    await safeDownload(blob, fileName);
    
    logExport('bulkCsv', `Bulk CSV export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('bulkCsv', `Bulk CSV export failed:`, error);
    throw error;
  }
}

/**
 * Export multiple purchase requests as individual ZIP files in a combined ZIP
 */
export async function exportMultipleRequestsAsZip(requests: any[]): Promise<string> {
  try {
    logExport('bulkZip', `Starting bulk ZIP export for ${requests.length} requests`);
    
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('No valid requests to export');
    }
    
    // Create main ZIP file
    const mainZip = new JSZip();
    
    // Process each request
    for (const request of requests) {
      try {
        if (!request || !request.id) continue;
        
        logExport('bulkZip', `Processing request ${request.id} for ZIP export`);
        
        // Create a folder for this request
        const folderName = `request_${request.requestNumber || request.id}`;
        const folder = mainZip.folder(folderName);
        
        if (!folder) continue;
        
        // Add request data in JSON format
        const requestData = JSON.stringify(request, null, 2);
        folder.file('request-data.json', requestData);
        
        // Add request data in CSV format
        try {
          const mainData = formatRequestForExport(request);
          const parser = new Parser();
          const csvContent = '\ufeff' + parser.parse([mainData]);
          folder.file('request-data.csv', csvContent);
          
          // Add items as separate CSV file
          if (Array.isArray(request.items) && request.items.length > 0) {
            const itemsData = formatItemsForExport(request);
            const itemsParser = new Parser();
            const itemsCsv = '\ufeff' + itemsParser.parse(itemsData);
            folder.file('items.csv', itemsCsv);
          }
          
          // Add approvals as separate CSV file
          if (Array.isArray(request.approvals) && request.approvals.length > 0) {
            const approvalsData = formatApprovalsForExport(request);
            const approvalsParser = new Parser();
            const approvalsCsv = '\ufeff' + approvalsParser.parse(approvalsData);
            folder.file('approvals.csv', approvalsCsv);
          }
        } catch (csvError) {
          logExport('bulkZip', `Error creating CSV files for request ${request.id}`, csvError);
        }
        
        // Add request data in Excel format
        try {
          const wb = XLSX.utils.book_new();
          
          // Add the main request data sheet
          const mainData = formatRequestForExport(request);
          const wsMain = XLSX.utils.json_to_sheet([mainData]);
          XLSX.utils.book_append_sheet(wb, wsMain, 'Request Info');
          
          // Add items sheet if available
          if (Array.isArray(request.items) && request.items.length > 0) {
            const itemsData = formatItemsForExport(request);
            const wsItems = XLSX.utils.json_to_sheet(itemsData);
            XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
          }
          
          // Add approvals sheet if available
          if (Array.isArray(request.approvals) && request.approvals.length > 0) {
            const approvalsData = formatApprovalsForExport(request);
            const wsApprovals = XLSX.utils.json_to_sheet(approvalsData);
            XLSX.utils.book_append_sheet(wb, wsApprovals, 'Approvals');
          }
          
          // Generate Excel file
          const excelBuffer = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'array',
            compression: true
          });
          
          folder.file('request-data.xlsx', excelBuffer);
        } catch (excelError) {
          logExport('bulkZip', `Error creating Excel file for request ${request.id}`, excelError);
        }
        
        // Add request PDF
        try {
          const doc = await generateRequestPDF(request, 'user');
          const pdfData = doc.output('blob');
          folder.file(`Purchase_Request_${request.requestNumber || request.id}.pdf`, pdfData);
        } catch (pdfError) {
          logExport('bulkZip', `Error creating PDF for request ${request.id}`, pdfError);
        }
      } catch (requestError) {
        logExport('bulkZip', `Error processing request ${request?.id || 'unknown'}`, requestError);
      }
    }
    
    // Add summary info
    const summary = {
      total_requests: requests.length,
      export_date: new Date().toISOString(),
      requests: requests.map(r => ({
        id: r.id,
        request_number: r.requestNumber,
        title: r.title,
        status: r.status
      }))
    };
    
    mainZip.file('export-summary.json', JSON.stringify(summary, null, 2));
    
    // Generate and download the ZIP file
    const zipBlob = await mainZip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Download the file
    const fileName = `Purchase_Requests_Export_${new Date().toISOString().split('T')[0]}.zip`;
    await safeDownload(zipBlob, fileName);
    
    logExport('bulkZip', `Bulk ZIP export completed successfully: ${fileName}`);
    return fileName;
  } catch (error) {
    logExport('bulkZip', `Bulk ZIP export failed:`, error);
    throw error;
  }
}