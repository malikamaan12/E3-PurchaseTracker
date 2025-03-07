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
 * Format a purchase request for export with comprehensive field coverage
 */
function formatRequestForExport(request: any) {
  if (!request) return {};
  
  // Calculate total cost if not already calculated
  const totalCost = request.totalEstimatedCost || calculateTotalCost(request);
  
  // Format dates consistently with enhanced error handling
  const formatDate = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return String(dateStr) || 'N/A';
    }
  };
  
  // Get requester details
  const requesterName = request.requester?.username || `User ${request.requesterId}` || 'Unknown';
  const requesterDepartment = request.requester?.department || 'Unknown';
  const requesterEmail = request.requester?.email || 'N/A';
  const requesterContact = request.requester?.contactNumber || 'N/A';
  
  // Get vendor details
  const vendorName = request.vendor?.companyName || request.vendor?.name || 'N/A';
  const vendorContact = request.vendor?.contactPerson || 'N/A';
  const vendorEmail = request.vendor?.email || 'N/A';
  const vendorPhone = request.vendor?.contactNumber || request.vendor?.phone || 'N/A';
  
  // Format attachments
  const attachmentsCount = request.attachments?.length || 0;
  const attachmentDetails = attachmentsCount > 0 ? 
    request.attachments.map((a: any) => a.fileName).join(', ') : 'None';
  
  // Format approval details
  const approvalCount = request.approvals?.length || 0;
  const approvedCount = request.approvals?.filter((a: any) => a.status === 'approved').length || 0;
  const rejectedCount = request.approvals?.filter((a: any) => a.status === 'rejected').length || 0;
  const pendingCount = request.approvals?.filter((a: any) => a.status === 'pending').length || 0;
  const changesCount = request.approvals?.filter((a: any) => a.status === 'changes_requested').length || 0;
  
  const approvalSummary = `${approvedCount} approved, ${rejectedCount} rejected, ${pendingCount} pending, ${changesCount} changes requested`;
  const approversList = request.approvals?.filter((a: any) => a.status === 'approved')
    .map((a: any) => a.approver?.username || 'Unknown')
    .join(', ') || 'None';
  
  // Calculate total file size
  const totalFileSizeMB = request.attachments?.reduce(
    (sum: number, att: any) => sum + (att.fileSize || 0), 0
  ) / (1024 * 1024) || 0;
  
  return {
    // Request Identification
    'Request ID': request.id,
    'Request Number': request.requestNumber || `REQ-${request.id}`,
    'Title': request.title || 'Untitled Request',
    'Status': request.status || 'draft',
    'Priority': request.priority || 'Normal',
    'Is Locked': request.isLocked ? 'Yes' : 'No',
    
    // Timestamps
    'Created Date': formatDate(request.createdAt),
    'Last Updated': formatDate(request.updatedAt),
    'Processed Date': formatDate(request.processedAt),
    'Submitted Date': formatDate(request.submittedAt),
    
    // Requester Information
    'Requester ID': request.requesterId,
    'Requester': requesterName,
    'Department': requesterDepartment,
    'Requester Email': requesterEmail,
    'Requester Contact': requesterContact,
    
    // Request Purpose
    'Purpose Type': request.purposeType || 'General',
    'Sub Purpose ID': request.subPurposeId || 'N/A',
    'Sub Purpose': request.subPurpose?.name || 'N/A',
    'Description': request.description || '',
    
    // Financial Information
    'Currency': request.currency || 'USD',
    'Freight Amount': request.freightAmount || 0,
    'Items Total': totalCost - (request.freightAmount || 0),
    'Total Estimated Cost': totalCost,
    
    // Vendor Information
    'Vendor ID': request.vendorId || 'N/A',
    'Vendor': vendorName,
    'Vendor Contact': vendorContact,
    'Vendor Email': vendorEmail,
    'Vendor Phone': vendorPhone,
    
    // Approvals
    'Required Approvals': request.mandatoryApproversCount || 0,
    'Total Approvals': approvalCount,
    'Approval Summary': approvalSummary,
    'Approved By': approversList,
    
    // Attachments
    'Attachments Count': attachmentsCount,
    'Attachments Size (MB)': totalFileSizeMB.toFixed(2),
    'Attachment Names': attachmentDetails,
    
    // Items
    'Items Count': request.items?.length || 0
  };
}

/**
 * Format items for export with enhanced details
 */
function formatItemsForExport(request: any) {
  if (!request?.items || !Array.isArray(request.items)) {
    return [];
  }
  
  return request.items.map((item: any, index: number) => {
    // Calculate item total cost
    const quantity = Number(item.quantity) || 0;
    const unitCost = Number(item.estimatedCost) || 0;
    const totalCost = quantity * unitCost;
    
    return {
      // Request identification
      'Request ID': request.id,
      'Request Number': request.requestNumber || `REQ-${request.id}`,
      'Request Status': request.status || 'draft',
      'Request Created': request.createdAt ? format(new Date(request.createdAt), 'yyyy-MM-dd') : 'N/A',
      
      // Item identification
      'Item #': index + 1,
      'Item Name': item.name || 'Unnamed Item',
      'Item Description': item.description || '',
      
      // Item financials
      'Quantity': quantity,
      'Unit Cost': unitCost,
      'Total Cost': totalCost,
      'Currency': request.currency || 'USD',
      
      // Related information
      'Purpose Type': request.purposeType || 'General',
      'Requester': request.requester?.username || `User ${request.requesterId}` || 'Unknown',
      'Department': request.requester?.department || 'Unknown',
      'Vendor': request.vendor?.companyName || request.vendor?.name || 'N/A'
    };
  });
}

/**
 * Format approvals for export with enhanced details
 */
function formatApprovalsForExport(request: any) {
  if (!request?.approvals || !Array.isArray(request.approvals)) {
    return [];
  }
  
  return request.approvals.map((approval: any, index: number) => {
    // Format dates
    const processedDate = approval.processedAt ? 
      format(new Date(approval.processedAt), 'yyyy-MM-dd HH:mm:ss') : 'Pending';
    
    // Map status to more readable version
    const statusMap: Record<string, string> = {
      'approved': 'Approved',
      'rejected': 'Rejected',
      'pending': 'Pending',
      'changes_requested': 'Changes Requested'
    };
    
    const readableStatus = statusMap[approval.status] || approval.status || 'Unknown';
    
    return {
      // Request identification
      'Request ID': request.id,
      'Request Number': request.requestNumber || `REQ-${request.id}`,
      'Request Title': request.title || 'Untitled Request',
      'Request Status': request.status || 'draft',
      
      // Approval details
      'Approval ID': approval.id || index + 1,
      'Approval Sequence': index + 1,
      'Department': approval.department || 'Unknown Department',
      'Status': readableStatus,
      'Is Mandatory': approval.isMandatory ? 'Yes' : 'No',
      
      // Approver details
      'Approver ID': approval.approverId || 'N/A',
      'Approver': approval.approver?.username || 'Not assigned',
      'Approver Role': approval.approver?.role || 'N/A',
      
      // Timeline
      'Process Date': processedDate,
      'Request Created': request.createdAt ? format(new Date(request.createdAt), 'yyyy-MM-dd') : 'N/A',
      
      // Decision details
      'Comments': approval.comments || '',
      'Decision Notes': approval.notes || ''
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
    
    // Ensure proper PDF content type
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const fileName = `Purchase_Request_${request.id || 'export'}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    
    // Validate if this is a valid PDF (check for PDF signature)
    const fileReader = new FileReader();
    
    return new Promise<string>((resolve, reject) => {
      fileReader.onload = () => {
        const arr = new Uint8Array(fileReader.result as ArrayBuffer);
        // Check PDF signature at the beginning of the file (should start with "%PDF-")
        const pdfSignature = String.fromCharCode(37, 80, 68, 70, 45); // "%PDF-"
        const fileSignature = String.fromCharCode(...arr.slice(0, 5));
        
        if (fileSignature !== pdfSignature) {
          const errorMsg = `Invalid PDF format: File signature doesn't match PDF standard`;
          logExport('pdf', errorMsg, new Error(errorMsg));
          // Instead of throwing, we'll try to get the JSON response and extract the data
          try {
            const jsonReader = new FileReader();
            jsonReader.onload = () => {
              try {
                const jsonContent = JSON.parse(jsonReader.result as string);
                if (jsonContent.data) {
                  // Use client-side PDF generation as fallback
                  import('./pdfGenerator').then(pdfModule => {
                    pdfModule.generateRequestPDF(jsonContent.data, type)
                      .then(pdfBlob => {
                        safeDownload(pdfBlob, fileName).then(() => resolve(fileName));
                      })
                      .catch(err => {
                        reject(new Error(`Fallback PDF generation failed: ${err.message}`));
                      });
                  });
                } else {
                  reject(new Error('Invalid server response format for PDF generation'));
                }
              } catch (parseError) {
                reject(new Error(`Failed to parse server response: ${parseError.message}`));
              }
            };
            jsonReader.onerror = () => reject(new Error('Failed to read server response'));
            jsonReader.readAsText(blob);
          } catch (fallbackError) {
            reject(new Error(`PDF validation failed and fallback generation failed: ${fallbackError.message}`));
          }
        } else {
          // Valid PDF - proceed with download
          safeDownload(blob, fileName).then(() => resolve(fileName));
        }
      };
      fileReader.onerror = () => reject(new Error('Failed to read PDF data'));
      fileReader.readAsArrayBuffer(blob.slice(0, 10)); // Only need to read the header
    });
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
    
    // Create a comprehensive index/catalog file first
    const exportInfo = {
      exportDate: new Date().toISOString(),
      totalRequests: requests.length,
      requestsSummary: requests.map(request => ({
        id: request.id,
        requestNumber: request.requestNumber || `REQ-${request.id}`,
        title: request.title || 'Untitled Request',
        status: request.status || 'draft',
        requester: request.requester?.username || 'Unknown',
        createdAt: request.createdAt ? format(new Date(request.createdAt), 'yyyy-MM-dd') : 'Unknown',
        totalCost: request.totalEstimatedCost || 0,
        currency: request.currency || 'USD',
        itemsCount: request.items?.length || 0,
        attachmentsCount: request.attachments?.length || 0,
        purposeType: request.purposeType || 'Unknown',
        subPurpose: request.subPurpose?.name || 'Unknown'
      }))
    };
    
    // Add the export info as JSON
    mainZip.file('export_info.json', JSON.stringify(exportInfo, null, 2));
    
    // Add a complete CSV catalog with all requests
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    try {
      // Add a complete CSV catalog with all requests
      const catalogParser = new Parser({
        fields: Object.keys(formattedRequests[0] || {}),
        defaultValue: 'N/A'
      });
      
      // Add BOM for Excel compatibility
      const catalogCSV = '\ufeff' + catalogParser.parse(formattedRequests);
      mainZip.file('all_requests_catalog.csv', catalogCSV);
    } catch (csvError) {
      logExport('bulk-zip', `Failed to create catalog CSV: ${csvError instanceof Error ? csvError.message : 'Unknown error'}`, csvError);
      // Continue even if catalog fails
    }
    
    // Create comprehensive Excel workbook with all requests
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
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
      
      // Create an attachments reference sheet
      const attachmentsReference: any[] = [];
      requests.forEach(request => {
        if (request.attachments && Array.isArray(request.attachments)) {
          request.attachments.forEach((attachment: any) => {
            attachmentsReference.push({
              'Request ID': request.id,
              'Request Number': request.requestNumber || `REQ-${request.id}`,
              'Attachment ID': attachment.id,
              'File Name': attachment.fileName,
              'File Type': attachment.fileType,
              'File Size (bytes)': attachment.fileSize,
              'Uploaded At': attachment.uploadedAt ? format(new Date(attachment.uploadedAt), 'yyyy-MM-dd HH:mm:ss') : 'Unknown',
              'ZIP Path': `Request_${request.id}/attachments/${attachment.fileName}`
            });
          });
        }
      });
      
      // Add attachments reference sheet if there are any attachments
      if (attachmentsReference.length > 0) {
        const attachmentsSheet = XLSX.utils.json_to_sheet(attachmentsReference);
        XLSX.utils.book_append_sheet(workbook, attachmentsSheet, 'Attachments');
      }
      
      // Add Excel to ZIP
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'array',
        compression: true
      });
      mainZip.file('all_purchase_requests.xlsx', excelBuffer);
    } catch (excelError) {
      logExport('bulk-zip', `Failed to create Excel catalog: ${excelError instanceof Error ? excelError.message : 'Unknown error'}`, excelError);
      // Continue even if Excel catalog fails
    }
    
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
      
      // Try to add PDF for each request using our enhanced PDF export
      try {
        const pdfResponse = await axios.get(`/api/requests/${request.id}/pdf`, {
          responseType: 'blob'
        });
        
        // Check if response is a valid PDF by checking the first few bytes
        const bytes = await pdfResponse.data.arrayBuffer();
        const headerView = new Uint8Array(bytes, 0, 5);
        const pdfSignature = String.fromCharCode(37, 80, 68, 70, 45); // "%PDF-"
        const fileSignature = String.fromCharCode(...headerView);
        
        if (fileSignature === pdfSignature) {
          // Valid PDF - add it to the ZIP
          requestFolder.file('purchase_request.pdf', pdfResponse.data);
        } else {
          // Invalid PDF - try to use client-side generation
          try {
            // Parse the response as JSON to get request data
            const jsonText = await pdfResponse.data.text();
            const jsonResponse = JSON.parse(jsonText);
            
            if (jsonResponse.data) {
              // Use client-side PDF generation as fallback
              const pdfGenerator = await import('./pdfGenerator');
              const pdfBlob = await pdfGenerator.generateRequestPDF(jsonResponse.data, 'user');
              
              if (pdfBlob) {
                const pdfBuffer = await pdfBlob.arrayBuffer();
                requestFolder.file('purchase_request.pdf', pdfBuffer);
              }
            }
          } catch (fallbackError) {
            logExport('bulk-zip', `Failed to add fallback PDF for request ${request.id}`, fallbackError);
          }
        }
      } catch (pdfError) {
        // Continue without PDF
        logExport('bulk-zip', `Failed to add PDF for request ${request.id}`, pdfError);
      }
      
      // Add attachments to a subfolder
      if (request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
        const attachmentsFolder = requestFolder.folder('attachments');
        if (!attachmentsFolder) continue;
        
        for (const attachment of request.attachments) {
          try {
            const response = await axios.get(`/api/attachments/${attachment.id}`, {
              responseType: 'blob'
            });
            attachmentsFolder.file(attachment.fileName, response.data);
          } catch (attachmentError) {
            logExport('bulk-zip', `Failed to add attachment ${attachment.fileName}`, attachmentError);
            // Continue with other attachments
          }
        }
      }
    }
    
    // Generate and download ZIP with better compression
    const zipBlob = await mainZip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6 // Higher compression level (0-9)
      }
    });
    
    const fileName = `Purchase_Requests_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;
    
    await safeDownload(zipBlob, fileName);
    return fileName;
  } catch (error) {
    logExport('bulk-zip', `Failed to export multiple requests as ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new Error(`Bulk ZIP export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}