/**
 * Export Utilities for Purchase Request System
 * 
 * This module provides functions to export purchase requests in various formats
 * including CSV, Excel, and ZIP. It handles data formatting, serialization,
 * and download operations for both single and bulk exports.
 */

import { Parser } from '@json2csv/plainjs';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import axios from 'axios';
import { format } from 'date-fns';

/**
 * Log export operations for debugging and tracking
 */
export const logExport = (type: string, message: string, error?: any) => {
  console.log(`[EXPORT][${type}] ${message}`);
  if (error) {
    console.error(`[EXPORT][${type}] Error:`, error);
  }
};

/**
 * Safely download a file using FileSaver with fallbacks
 */
export async function safeDownload(blob: Blob, fileName: string): Promise<boolean> {
  try {
    saveAs(blob, fileName);
    return true;
  } catch (error) {
    logExport('download', `Error using saveAs: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    
    // Fallback method
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (fallbackError) {
      logExport('download', `Fallback download failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`, fallbackError);
      return false;
    }
  }
}

/**
 * Calculate the total cost of a purchase request
 */
function calculateTotalCost(request: any): number {
  let total = 0;
  
  if (request.items && Array.isArray(request.items)) {
    total = request.items.reduce((sum, item) => {
      return sum + (Number(item.quantity) * Number(item.estimatedCost));
    }, 0);
  }
  
  // Add freight if available
  if (request.freightAmount && !isNaN(Number(request.freightAmount))) {
    total += Number(request.freightAmount);
  }
  
  return total;
}

/**
 * Format a purchase request for export
 */
function formatRequestForExport(request: any) {
  if (!request) return {};
  
  // Calculate total cost if not already calculated
  const totalCost = request.totalEstimatedCost || calculateTotalCost(request);
  
  // Format dates for readability
  const createdAt = request.createdAt ? format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A';
  const updatedAt = request.updatedAt ? format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A';
  const processedAt = request.processedAt ? format(new Date(request.processedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A';
  
  // Get requester details
  const requesterName = request.requester?.username || 'Unknown';
  const requesterDepartment = request.requester?.department || 'Unknown';
  
  // Get vendor details
  const vendorName = request.vendor?.companyName || request.vendor?.name || 'N/A';
  const vendorContact = request.vendor?.contactPerson || 'N/A';
  const vendorEmail = request.vendor?.email || 'N/A';
  const vendorPhone = request.vendor?.contactNumber || request.vendor?.phone || 'N/A';
  
  // Format attachments
  const attachmentsCount = request.attachments?.length || 0;
  
  return {
    'Request ID': request.id,
    'Request Number': request.requestNumber || `REQ-${request.id}`,
    'Title': request.title,
    'Status': request.status,
    'Priority': request.priority || 'Normal',
    'Created Date': createdAt,
    'Last Updated': updatedAt,
    'Processed Date': processedAt,
    'Requester': requesterName,
    'Department': requesterDepartment,
    'Purpose Type': request.purposeType || 'General',
    'Sub Purpose': request.subPurpose?.name || 'N/A',
    'Description': request.description,
    'Currency': request.currency || 'USD',
    'Freight Amount': request.freightAmount || 0,
    'Total Estimated Cost': totalCost,
    'Vendor': vendorName,
    'Vendor Contact': vendorContact,
    'Vendor Email': vendorEmail,
    'Vendor Phone': vendorPhone,
    'Attachments Count': attachmentsCount,
    'Items Count': request.items?.length || 0
  };
}

/**
 * Format items for export
 */
function formatItemsForExport(request: any) {
  if (!request?.items || !Array.isArray(request.items)) {
    return [];
  }
  
  return request.items.map((item: any, index: number) => ({
    'Request ID': request.id,
    'Request Number': request.requestNumber || `REQ-${request.id}`,
    'Item #': index + 1,
    'Name': item.name,
    'Description': item.description || '',
    'Quantity': item.quantity,
    'Unit Cost': item.estimatedCost,
    'Total Cost': Number(item.quantity) * Number(item.estimatedCost),
    'Currency': request.currency || 'USD'
  }));
}

/**
 * Format approvals for export
 */
function formatApprovalsForExport(request: any) {
  if (!request?.approvals || !Array.isArray(request.approvals)) {
    return [];
  }
  
  return request.approvals.map((approval: any, index: number) => {
    const processedDate = approval.processedAt ? 
      format(new Date(approval.processedAt), 'yyyy-MM-dd HH:mm:ss') : 'Pending';
    
    return {
      'Request ID': request.id,
      'Request Number': request.requestNumber || `REQ-${request.id}`,
      'Approval #': index + 1,
      'Department': approval.department,
      'Status': approval.status,
      'Approver': approval.approver?.username || 'Not assigned',
      'Process Date': processedDate,
      'Comments': approval.comments || ''
    };
  });
}

/**
 * Export a purchase request to CSV format
 */
export async function exportRequestToCSV(request: any): Promise<string> {
  try {
    const formattedRequest = formatRequestForExport(request);
    const formattedItems = formatItemsForExport(request);
    const formattedApprovals = formatApprovalsForExport(request);
    
    // Create parser instances for each data set
    const requestParser = new Parser({ 
      fields: Object.keys(formattedRequest),
      defaultValue: 'N/A'
    });
    
    const itemsParser = new Parser({
      fields: formattedItems.length > 0 ? Object.keys(formattedItems[0]) : [],
      defaultValue: 'N/A'
    });
    
    const approvalsParser = new Parser({
      fields: formattedApprovals.length > 0 ? Object.keys(formattedApprovals[0]) : [],
      defaultValue: 'N/A'
    });
    
    // Generate CSV strings
    const requestCSV = requestParser.parse(formattedRequest);
    const itemsCSV = formattedItems.length > 0 ? itemsParser.parse(formattedItems) : 'No items available';
    const approvalsCSV = formattedApprovals.length > 0 ? approvalsParser.parse(formattedApprovals) : 'No approvals available';
    
    // Combine all CSVs with section headers
    const combinedCSV = [
      '### PURCHASE REQUEST DETAILS ###',
      requestCSV,
      '\n\n### ITEMS ###',
      itemsCSV,
      '\n\n### APPROVALS ###',
      approvalsCSV
    ].join('\n');
    
    // Create and download CSV file
    const blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' });
    const fileName = `Purchase_Request_${request.id || 'export'}_${format(new Date(), 'yyyyMMdd')}.csv`;
    
    await safeDownload(blob, fileName);
    return fileName;
  } catch (error) {
    logExport('csv', `Failed to export request to CSV: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export a purchase request to Excel format with multiple sheets
 */
export async function exportRequestToExcel(request: any): Promise<string> {
  try {
    const formattedRequest = formatRequestForExport(request);
    const formattedItems = formatItemsForExport(request);
    const formattedApprovals = formatApprovalsForExport(request);
    
    // Create workbook and sheets
    const workbook = XLSX.utils.book_new();
    
    // Add main request sheet
    const requestSheet = XLSX.utils.json_to_sheet([formattedRequest]);
    XLSX.utils.book_append_sheet(workbook, requestSheet, 'Request Details');
    
    // Add items sheet if available
    if (formattedItems.length > 0) {
      const itemsSheet = XLSX.utils.json_to_sheet(formattedItems);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
    }
    
    // Add approvals sheet if available
    if (formattedApprovals.length > 0) {
      const approvalsSheet = XLSX.utils.json_to_sheet(formattedApprovals);
      XLSX.utils.book_append_sheet(workbook, approvalsSheet, 'Approvals');
    }
    
    // Create file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Purchase_Request_${request.id || 'export'}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    
    await safeDownload(blob, fileName);
    return fileName;
  } catch (error) {
    logExport('excel', `Failed to export request to Excel: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export a purchase request to PDF format
 */
export async function exportRequestToPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
  try {
    // Call the server-side PDF generation endpoint
    const response = await axios.get(`/api/requests/${request.id}/pdf`, {
      params: { type },
      responseType: 'blob'
    });
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const fileName = `Purchase_Request_${request.id || 'export'}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    
    await safeDownload(blob, fileName);
    return fileName;
  } catch (error) {
    logExport('pdf', `Failed to export request to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export a purchase request to ZIP format with multiple file formats included
 */
export async function exportRequestAsZip(request: any, includeAttachments: boolean = true): Promise<string> {
  try {
    // Create a new JSZip instance
    const zip = new JSZip();
    
    // Add CSV format
    const formattedRequest = formatRequestForExport(request);
    const formattedItems = formatItemsForExport(request);
    const formattedApprovals = formatApprovalsForExport(request);
    
    // Create parser instances for CSV export
    const requestParser = new Parser({ 
      fields: Object.keys(formattedRequest),
      defaultValue: 'N/A'
    });
    
    const itemsParser = new Parser({
      fields: formattedItems.length > 0 ? Object.keys(formattedItems[0]) : [],
      defaultValue: 'N/A'
    });
    
    const approvalsParser = new Parser({
      fields: formattedApprovals.length > 0 ? Object.keys(formattedApprovals[0]) : [],
      defaultValue: 'N/A'
    });
    
    // Generate CSV strings
    const requestCSV = requestParser.parse(formattedRequest);
    const itemsCSV = formattedItems.length > 0 ? itemsParser.parse(formattedItems) : 'No items available';
    const approvalsCSV = formattedApprovals.length > 0 ? approvalsParser.parse(formattedApprovals) : 'No approvals available';
    
    // Add CSV files to ZIP
    zip.file('request_details.csv', requestCSV);
    zip.file('items.csv', itemsCSV);
    zip.file('approvals.csv', approvalsCSV);
    
    // Add Excel format
    const workbook = XLSX.utils.book_new();
    
    // Add main request sheet
    const requestSheet = XLSX.utils.json_to_sheet([formattedRequest]);
    XLSX.utils.book_append_sheet(workbook, requestSheet, 'Request Details');
    
    // Add items sheet if available
    if (formattedItems.length > 0) {
      const itemsSheet = XLSX.utils.json_to_sheet(formattedItems);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
    }
    
    // Add approvals sheet if available
    if (formattedApprovals.length > 0) {
      const approvalsSheet = XLSX.utils.json_to_sheet(formattedApprovals);
      XLSX.utils.book_append_sheet(workbook, approvalsSheet, 'Approvals');
    }
    
    // Add Excel to ZIP
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    zip.file('purchase_request.xlsx', excelBuffer);
    
    // Add PDF if possible
    try {
      const response = await axios.get(`/api/requests/${request.id}/pdf`, {
        responseType: 'blob'
      });
      zip.file('purchase_request.pdf', response.data);
    } catch (pdfError) {
      logExport('zip', `Failed to add PDF to ZIP: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`, pdfError);
      // Continue without PDF if it fails
    }
    
    // Add attachments if requested and available
    if (includeAttachments && request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
      const attachmentsFolder = zip.folder('attachments');
      
      for (const attachment of request.attachments) {
        try {
          const response = await axios.get(`/api/attachments/${attachment.id}`, {
            responseType: 'blob'
          });
          attachmentsFolder?.file(attachment.fileName, response.data);
        } catch (attachmentError) {
          logExport('zip', `Failed to add attachment ${attachment.fileName} to ZIP: ${attachmentError instanceof Error ? attachmentError.message : 'Unknown error'}`, attachmentError);
          // Continue with other attachments
        }
      }
    }
    
    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const fileName = `Purchase_Request_${request.id || 'export'}_${format(new Date(), 'yyyyMMdd')}.zip`;
    
    await safeDownload(zipBlob, fileName);
    return fileName;
  } catch (error) {
    logExport('zip', `Failed to export request as ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`ZIP export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export multiple purchase requests to a combined Excel file
 */
export async function exportMultipleRequestsToExcel(requests: any[]): Promise<string> {
  try {
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      throw new Error('No requests provided for export');
    }
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Format all requests
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    // Add main requests sheet
    const requestsSheet = XLSX.utils.json_to_sheet(formattedRequests);
    XLSX.utils.book_append_sheet(workbook, requestsSheet, 'All Requests');
    
    // Collect all items from all requests
    const allItems: any[] = [];
    requests.forEach(request => {
      const items = formatItemsForExport(request);
      allItems.push(...items);
    });
    
    // Add items sheet if available
    if (allItems.length > 0) {
      const itemsSheet = XLSX.utils.json_to_sheet(allItems);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'All Items');
    }
    
    // Collect all approvals from all requests
    const allApprovals: any[] = [];
    requests.forEach(request => {
      const approvals = formatApprovalsForExport(request);
      allApprovals.push(...approvals);
    });
    
    // Add approvals sheet if available
    if (allApprovals.length > 0) {
      const approvalsSheet = XLSX.utils.json_to_sheet(allApprovals);
      XLSX.utils.book_append_sheet(workbook, approvalsSheet, 'All Approvals');
    }
    
    // Create file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Bulk_Purchase_Requests_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    
    await safeDownload(blob, fileName);
    return fileName;
  } catch (error) {
    logExport('bulk-excel', `Failed to export multiple requests to Excel: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`Bulk Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export multiple purchase requests to a combined CSV file
 */
export async function exportMultipleRequestsToCSV(requests: any[]): Promise<string> {
  try {
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      throw new Error('No requests provided for export');
    }
    
    // Format all requests
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    // Create parser instances for the requests
    const requestsParser = new Parser({ 
      fields: Object.keys(formattedRequests[0]),
      defaultValue: 'N/A'
    });
    
    // Generate CSV string
    const requestsCSV = requestsParser.parse(formattedRequests);
    
    // Create and download CSV file
    const blob = new Blob([requestsCSV], { type: 'text/csv;charset=utf-8;' });
    const fileName = `Bulk_Purchase_Requests_${format(new Date(), 'yyyyMMdd')}.csv`;
    
    await safeDownload(blob, fileName);
    return fileName;
  } catch (error) {
    logExport('bulk-csv', `Failed to export multiple requests to CSV: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`Bulk CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export multiple purchase requests as individual ZIP files in a combined ZIP
 */
export async function exportMultipleRequestsAsZip(requests: any[]): Promise<string> {
  try {
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      throw new Error('No requests provided for export');
    }
    
    // Create a new JSZip instance
    const mainZip = new JSZip();
    
    // First add a bulk Excel file
    // Format all requests
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Add main requests sheet
    const requestsSheet = XLSX.utils.json_to_sheet(formattedRequests);
    XLSX.utils.book_append_sheet(workbook, requestsSheet, 'All Requests');
    
    // Add Excel to ZIP
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    mainZip.file('all_purchase_requests.xlsx', excelBuffer);
    
    // Create a dedicated folder for each request
    for (const request of requests) {
      const requestFolder = mainZip.folder(`Request_${request.id}`);
      if (!requestFolder) continue;
      
      // Add request details as JSON
      requestFolder.file('request.json', JSON.stringify(request, null, 2));
      
      // Add formatted CSV data
      const formattedRequest = formatRequestForExport(request);
      const formattedItems = formatItemsForExport(request);
      const formattedApprovals = formatApprovalsForExport(request);
      
      // Create parser instances for CSV export
      const requestParser = new Parser({ 
        fields: Object.keys(formattedRequest),
        defaultValue: 'N/A'
      });
      
      // Generate CSV string for request details
      const requestCSV = requestParser.parse(formattedRequest);
      requestFolder.file('details.csv', requestCSV);
      
      // Add items as CSV if available
      if (formattedItems.length > 0) {
        const itemsParser = new Parser({
          fields: Object.keys(formattedItems[0]),
          defaultValue: 'N/A'
        });
        const itemsCSV = itemsParser.parse(formattedItems);
        requestFolder.file('items.csv', itemsCSV);
      }
      
      // Add approvals as CSV if available
      if (formattedApprovals.length > 0) {
        const approvalsParser = new Parser({
          fields: Object.keys(formattedApprovals[0]),
          defaultValue: 'N/A'
        });
        const approvalsCSV = approvalsParser.parse(formattedApprovals);
        requestFolder.file('approvals.csv', approvalsCSV);
      }
      
      // Try to add PDF for each request
      try {
        const response = await axios.get(`/api/requests/${request.id}/pdf`, {
          responseType: 'blob'
        });
        requestFolder.file('purchase_request.pdf', response.data);
      } catch (pdfError) {
        // Continue without PDF
        logExport('bulk-zip', `Failed to add PDF for request ${request.id}`, pdfError);
      }
    }
    
    // Generate and download ZIP
    const zipBlob = await mainZip.generateAsync({ type: 'blob' });
    const fileName = `Bulk_Purchase_Requests_${format(new Date(), 'yyyyMMdd')}.zip`;
    
    await safeDownload(zipBlob, fileName);
    return fileName;
  } catch (error) {
    logExport('bulk-zip', `Failed to export multiple requests as ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`Bulk ZIP export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}