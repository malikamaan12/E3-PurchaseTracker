import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { logPdfAuditEvent } from './pdfAuditUtils';

/**
 * Safely download a file using FileSaver with fallbacks
 */
export async function safeDownload(blob: Blob, fileName: string): Promise<boolean> {
  try {
    saveAs(blob, fileName);
    return true;
  } catch (error) {
    console.error("Download error:", error);
    // Fallback method using object URLs
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
      console.error("Fallback download error:", fallbackError);
      return false;
    }
  }
}

/**
 * Calculate the total cost of a purchase request
 */
function calculateTotalCost(request: any): number {
  try {
    if (!request?.items || !Array.isArray(request.items)) return 0;
    
    // Calculate the sum of all items
    const itemsTotal = request.items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0;
      const cost = Number(item.estimatedCost) || 0;
      const itemCost = quantity * cost;
      return sum + itemCost;
    }, 0);
    
    // Add any freight amount
    const freightAmount = Number(request.freightAmount) || 0;
    
    return itemsTotal + freightAmount;
  } catch (error) {
    console.error('Error calculating total cost:', error);
    return 0;
  }
}

/**
 * Format a purchase request for export with comprehensive field coverage
 */
function formatRequestForExport(request: any) {
  try {
    if (!request) return {};
    
    // Calculate totals
    const totalCost = calculateTotalCost(request);
    
    // Format dates safely
    const formatDate = (dateString: string | null | undefined): string => {
      if (!dateString) return '';
      try {
        return new Date(dateString).toLocaleDateString();
      } catch (e) {
        console.warn(`Failed to format date: ${dateString}`, e);
        return '';
      }
    };
    
    // Log request format for debugging
    console.log(`Formatting request #${request.id} for export`);
    
    return {
      'Request ID': request.id || '',
      'Request Number': request.requestNumber || `PR-${request.id || ''}`,
      'Title': request.title || '',
      'Description': request.description || '',
      'Status': request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : '',
      'Priority': request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : '',
      'Created Date': formatDate(request.createdAt),
      'Updated Date': formatDate(request.updatedAt),
      'Requester': request.requester?.username || '',
      'Department': request.requester?.department || '',
      'Vendor': request.vendor?.companyName || request.vendor?.name || '',
      'Purpose Type': request.purposeType || '',
      'Sub Purpose': request.subPurpose?.name || '',
      'Total Cost': totalCost.toFixed(2),
      'Currency': request.currency || 'USD',
      'Items Count': request.items?.length || 0,
      'Freight Amount': Number(request.freightAmount || 0).toFixed(2),
      'Approval Status': getApprovalSummary(request),
      'Has Attachments': request.attachments && request.attachments.length > 0 ? 'Yes' : 'No',
      'Attachment Count': request.attachments?.length || 0
    };
  } catch (error) {
    console.error(`Error formatting request ${request?.id} for export:`, error);
    
    // Return a minimal fallback object if formatting fails
    return {
      'Request ID': request?.id || 'Unknown',
      'Error': 'Failed to format request data',
      'Raw Data Available': 'Yes'
    };
  }
}

/**
 * Get a summary of approval status
 */
function getApprovalSummary(request: any): string {
  try {
    if (!request?.approvals || !Array.isArray(request.approvals) || request.approvals.length === 0) {
      return 'No approvals';
    }
    
    // Process approvals to ensure unique departments (fix for duplicate CEO Office approvals)
    // Create a map to hold the latest approval for each department
    const departmentApprovals = new Map();
    
    // Make a safe copy of the approvals array
    const approvalsToCopy = [...request.approvals];
    
    // Sort approvals by processed date (newest first)
    const sortedApprovals = approvalsToCopy.sort((a, b) => {
      const dateA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
      const dateB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Keep only the latest approval for each department
    sortedApprovals.forEach(approval => {
      if (approval.department && !departmentApprovals.has(approval.department)) {
        departmentApprovals.set(approval.department, approval);
      }
    });
    
    // Convert map back to array
    const uniqueApprovals = Array.from(departmentApprovals.values());
    
    // Count approvals by status
    const approved = uniqueApprovals.filter((a: any) => a.status === 'approved').length;
    const rejected = uniqueApprovals.filter((a: any) => a.status === 'rejected').length;
    const pending = uniqueApprovals.filter((a: any) => 
      !a.status || a.status === 'pending' || a.status === ''
    ).length;
    const total = uniqueApprovals.length;
    
    return `${approved}/${total} approved, ${rejected} rejected, ${pending} pending`;
  } catch (error) {
    console.error('Error generating approval summary:', error);
    return 'Error in approval status';
  }
}

/**
 * Export a purchase request to CSV format
 */
export async function exportRequestToCSV(request: any): Promise<string> {
  try {
    console.log(`Starting CSV export for request #${request.id}`);
    const formattedRequest = formatRequestForExport(request);
    
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    const csv = parser.parse([formattedRequest]);
    
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
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.csv`;
    
    // Create a blob with the BOM-prefixed content
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' });
    
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`CSV export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('CSV export error:', error);
    throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export a purchase request to Excel format with multiple sheets
 */
export async function exportRequestToExcel(request: any): Promise<string> {
  try {
    console.log(`Starting Excel export for request #${request.id}`);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add main request sheet
    const mainData = [formatRequestForExport(request)];
    const mainWs = XLSX.utils.json_to_sheet(mainData);
    
    // Add column widths for better readability
    const columns = Object.keys(mainData[0] || {});
    const wscols = columns.map((col) => ({ 
      wch: Math.max(col.length, 15) 
    }));
    mainWs['!cols'] = wscols;
    
    XLSX.utils.book_append_sheet(wb, mainWs, 'Request Details');
    
    // Add items sheet if present
    if (request.items && request.items.length > 0) {
      try {
        const itemsData = request.items.map((item: any, index: number) => ({
          'Item #': index + 1,
          'Name': item.name || '',
          'Description': item.description || '',
          'Quantity': Number(item.quantity) || 0,
          'Unit Cost': (Number(item.estimatedCost) || 0).toFixed(2),
          'Total Cost': ((Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0)).toFixed(2)
        }));
        const itemsWs = XLSX.utils.json_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(wb, itemsWs, 'Items');
      } catch (itemError) {
        console.error('Error processing items for Excel export:', itemError);
        // Continue without items sheet rather than failing the whole export
      }
    }
    
    // Add approvals sheet if present
    if (request.approvals && request.approvals.length > 0) {
      try {
        // Process approvals to ensure unique departments (fix for duplicate CEO Office approvals)
        // Create a map to hold the latest approval for each department
        const departmentApprovals = new Map();
        
        // Make a safe copy of the approvals array
        const approvalsToCopy = [...request.approvals];
        
        // Sort approvals by processed date (newest first)
        const sortedApprovals = approvalsToCopy.sort((a, b) => {
          const dateA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
          const dateB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
          return dateB - dateA; // Descending order (newest first)
        });
        
        // Keep only the latest approval for each department
        sortedApprovals.forEach(approval => {
          if (approval.department && !departmentApprovals.has(approval.department)) {
            departmentApprovals.set(approval.department, approval);
          }
        });
        
        // Convert map back to array
        const uniqueApprovals = Array.from(departmentApprovals.values());
        
        // Create approval data for Excel sheet
        const approvalsData = uniqueApprovals.map((approval: any, index: number) => ({
          'Approval #': index + 1,
          'Department': approval.department || '',
          'Status': approval.status ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1) : '',
          'Approver': approval.approver?.username || '',
          'Processed Date': approval.processedAt ? new Date(approval.processedAt).toLocaleDateString() : '',
          'Comments': approval.comments || ''
        }));
        
        const approvalsWs = XLSX.utils.json_to_sheet(approvalsData);
        XLSX.utils.book_append_sheet(wb, approvalsWs, 'Approvals');
      } catch (approvalError) {
        console.error('Error processing approvals for Excel export:', approvalError);
        // Continue without approvals sheet rather than failing the whole export
      }
    }
    
    // Generate Excel file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`Excel export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Excel export error:', error);
    throw new Error(`Failed to export Excel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export a purchase request to PDF format with enhanced approval status visualization
 */
import { generateEnhancedPDF } from './enhancedPdfGenerator';

export async function exportRequestToPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
  try {
    console.log(`Starting PDF export for request #${request.id}`);
    
    // Try to fetch PDF settings
    let pdfSettings = null;
    try {
      const response = await fetch('/api/pdf/print-settings');
      if (response.ok) {
        pdfSettings = await response.json();
      }
    } catch (error) {
      console.error('Error fetching PDF settings:', error);
    }
    
    // Generate the PDF document using our new generator
    const { generatePurchaseRequestPDF } = await import('./purchaseRequestPdf');
    const doc = await generatePurchaseRequestPDF(request, {
      type,
      showApprovals: true,
      showAttachments: true,
      showSignatures: type === 'admin' || type === 'approver',
      headerImage: pdfSettings?.headerImage || null,
      footerImage: pdfSettings?.footerImage || null,
      headerColor: pdfSettings?.headerColor || '#6F2AE6',
      footerColor: pdfSettings?.footerColor || '#6F2AE6',
      footerText: pdfSettings?.footerText || 'ALL RIGHTS RESERVED BY E3',
      pageNumbering: pdfSettings?.pageNumbering !== false,
      companyInfo: {
        phone: pdfSettings?.companyPhone || '+974 44332340 / 55255417',
        email: pdfSettings?.companyEmail || 'info@e3corp.com',
        website: pdfSettings?.companyWebsite || 'www.e3corp.com',
        address: pdfSettings?.companyAddress || 'Floor 36, Office 3602, Palm Tower B, Marina 41, Port Area, P.O.Box 55821, Doha'
      }
    });
    
    // Generate the PDF
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.pdf`;
    const pdfOutput = doc.output('blob');
    
    const downloadResult = await safeDownload(pdfOutput, fileName);
    console.log(`PDF export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('PDF export error:', error);
    
    // Create a basic fallback PDF with error information
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      doc.setFontSize(18);
      doc.text(`Purchase Request: ${request.requestNumber || request.id}`, 14, 20);
      doc.setFontSize(12);
      doc.text('Error generating PDF document', 14, 30);
      doc.text(`Error: ${error instanceof Error ? error.message : String(error)}`, 14, 40);
      
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
      const fileName = `purchase-request-${request.id}-${timestamp}-error.pdf`;
      const pdfOutput = doc.output('blob');
      
      await safeDownload(pdfOutput, fileName);
      return fileName;
    } catch (fallbackError) {
      console.error('Fallback PDF creation failed:', fallbackError);
      throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Export multiple purchase requests to a combined Excel file
 */
export async function exportMultipleRequestsToExcel(requests: any[]): Promise<string> {
  if (!requests || requests.length === 0) {
    throw new Error('No requests to export');
  }
  
  try {
    console.log(`Starting Excel export for ${requests.length} requests`);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add summary sheet with all requests
    const summaryData = requests.map((request: any) => formatRequestForExport(request));
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    
    // Add column widths for better readability
    const columns = Object.keys(summaryData[0] || {});
    const wscols = columns.map((col) => ({ 
      wch: Math.max(col.length, 15) 
    }));
    summaryWs['!cols'] = wscols;
    
    XLSX.utils.book_append_sheet(wb, summaryWs, 'All Requests');
    
    // Add items from all requests
    const allItems: any[] = [];
    requests.forEach((request: any) => {
      if (request.items && request.items.length > 0) {
        request.items.forEach((item: any) => {
          allItems.push({
            'Request ID': request.id,
            'Request Number': request.requestNumber || `PR-${request.id}`,
            'Item Name': item.name || '',
            'Description': item.description || '',
            'Quantity': item.quantity || 0,
            'Unit Cost': item.estimatedCost ? item.estimatedCost.toFixed(2) : '0.00',
            'Total Cost': (item.quantity * item.estimatedCost).toFixed(2) || '0.00'
          });
        });
      }
    });
    
    if (allItems.length > 0) {
      const itemsWs = XLSX.utils.json_to_sheet(allItems);
      XLSX.utils.book_append_sheet(wb, itemsWs, 'All Items');
    }
    
    // Add approvals from all requests
    const allApprovals: any[] = [];
    requests.forEach((request: any) => {
      if (request.approvals && request.approvals.length > 0) {
        // Process approvals to ensure unique departments (fix for duplicate CEO Office approvals)
        // Create a map to hold the latest approval for each department
        const departmentApprovals = new Map();
        
        // Sort approvals by processed date (newest first)
        const sortedApprovals = [...request.approvals].sort((a, b) => {
          const dateA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
          const dateB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
          return dateB - dateA; // Descending order (newest first)
        });
        
        // Keep only the latest approval for each department
        sortedApprovals.forEach(approval => {
          if (!departmentApprovals.has(approval.department)) {
            departmentApprovals.set(approval.department, approval);
          }
        });
        
        // Convert map back to array
        const uniqueApprovals = Array.from(departmentApprovals.values());
        
        // Add each unique approval to the export
        uniqueApprovals.forEach((approval: any) => {
          allApprovals.push({
            'Request ID': request.id,
            'Request Number': request.requestNumber || `PR-${request.id}`,
            'Department': approval.department || '',
            'Status': approval.status ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1) : '',
            'Approver': approval.approver?.username || '',
            'Processed Date': approval.processedAt ? new Date(approval.processedAt).toLocaleDateString() : '',
            'Comments': approval.comments || ''
          });
        });
      }
    });
    
    if (allApprovals.length > 0) {
      const approvalsWs = XLSX.utils.json_to_sheet(allApprovals);
      XLSX.utils.book_append_sheet(wb, approvalsWs, 'All Approvals');
    }
    
    // Generate Excel file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-export-${timestamp}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`Excel export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Multiple Excel export error:', error);
    throw new Error(`Failed to export Excel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests to a combined CSV file
 */
export async function exportMultipleRequestsToCSV(requests: any[]): Promise<string> {
  if (!requests || requests.length === 0) {
    throw new Error('No requests to export');
  }
  
  try {
    console.log(`Starting CSV export for ${requests.length} requests`);
    
    // Format all requests
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    // Create CSV
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    const csv = parser.parse(formattedRequests);
    
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
    
    // Create blob and initiate download
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-export-${timestamp}.csv`;
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' });
    
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`CSV export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Multiple CSV export error:', error);
    throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests as PDFs in a combined ZIP
 */
export async function exportMultipleRequestsToPDF(requests: any[]): Promise<string> {
  if (!requests || requests.length === 0) {
    throw new Error('No requests to export');
  }
  
  try {
    const zip = new JSZip();
    
    // Create PDF for each request and add to zip
    for (const request of requests) {
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Add title
      doc.setFontSize(18);
      doc.text(`Purchase Request: ${request.requestNumber || request.id}`, 14, 20);
      
      // Add basic info
      doc.setFontSize(12);
      doc.text(`Title: ${request.title}`, 14, 30);
      doc.text(`Status: ${request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Unknown'}`, 14, 38);
      doc.text(`Priority: ${request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : 'Unknown'}`, 14, 46);
      doc.text(`Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}`, 14, 54);
      doc.text(`Requester: ${request.requester?.username || 'Unknown'}`, 14, 62);
      doc.text(`Department: ${request.requester?.department || 'Unknown'}`, 14, 70);
      
      // Add description
      doc.text('Description:', 14, 82);
      const splitDescription = doc.splitTextToSize(request.description || 'No description provided', 180);
      doc.text(splitDescription, 14, 90);
      
      // Set y position after description
      let yPos = 90 + (splitDescription.length * 7);
      
      // Add items
      if (request.items && request.items.length > 0) {
        yPos += 10;
        doc.text('Items:', 14, yPos);
        yPos += 8;
        
        // Item table headers
        const itemHead = [['#', 'Name', 'Quantity', 'Est. Cost', 'Total']];
        const itemBody = request.items.map((item: any, index: number) => [
          index + 1,
          item.name || '',
          item.quantity || 0,
          (item.estimatedCost || 0).toFixed(2),
          ((item.quantity || 0) * (item.estimatedCost || 0)).toFixed(2)
        ]);
        
        // @ts-ignore
        doc.autoTable({
          head: itemHead,
          body: itemBody,
          startY: yPos,
          margin: { left: 14 },
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [66, 139, 202] }
        });
        
        // @ts-ignore
        yPos = doc.autoTable.previous.finalY + 10;
      }
      
      // Add approvals if they exist
      if (request.approvals && request.approvals.length > 0) {
        doc.text('Approval Status:', 14, yPos);
        yPos += 8;
        
        // Process approvals to ensure unique departments (fix for duplicate CEO Office approvals)
        // Create a map to hold the latest approval for each department
        const departmentApprovals = new Map();
        
        // Sort approvals by processed date (newest first)
        const sortedApprovals = [...request.approvals].sort((a, b) => {
          const dateA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
          const dateB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
          return dateB - dateA; // Descending order (newest first)
        });
        
        // Keep only the latest approval for each department
        sortedApprovals.forEach(approval => {
          if (!departmentApprovals.has(approval.department)) {
            departmentApprovals.set(approval.department, approval);
          }
        });
        
        // Convert map back to array
        const uniqueApprovals = Array.from(departmentApprovals.values());
        
        // Approval table headers
        const approvalHead = [['Department', 'Status', 'Approver', 'Date', 'Comments']];
        const approvalBody = uniqueApprovals.map((approval: any) => [
          approval.department || '',
          approval.status ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1) : '',
          approval.approver?.username || '',
          approval.processedAt ? new Date(approval.processedAt).toLocaleDateString() : 'Pending',
          approval.comments || ''
        ]);
        
        // @ts-ignore
        doc.autoTable({
          head: approvalHead,
          body: approvalBody,
          startY: yPos,
          margin: { left: 14 },
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [66, 139, 202] }
        });
      }
      
      // Add footer with total
      const totalCost = calculateTotalCost(request);
      doc.setFontSize(12);
      doc.text(`Total Amount: ${totalCost.toFixed(2)} ${request.currency || 'USD'}`, 14, doc.internal.pageSize.height - 20);
      
      // Generate PDF output as blob
      const pdfOutput = doc.output('blob');
      
      // Add PDF to the zip file
      zip.file(`purchase-request-${request.id}.pdf`, pdfOutput);
    }
    
    // Generate the ZIP file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-pdf-export-${timestamp}.zip`;
    const content = await zip.generateAsync({ type: 'blob' });
    
    const downloadResult = await safeDownload(content, fileName);
    console.log(`PDF export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Multiple PDF export error:', error);
    throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests as individual ZIP files in a combined ZIP
 */
export async function exportMultipleRequestsAsZip(requests: any[], includeAttachments: boolean = true): Promise<string> {
  if (!requests || requests.length === 0) {
    throw new Error('No requests to export');
  }
  
  try {
    const zip = new JSZip();
    
    // Create a folder for each request
    for (const request of requests) {
      const requestFolder = zip.folder(`request-${request.id}`);
      if (!requestFolder) continue;
      
      // Add JSON data
      const jsonData = JSON.stringify(request, null, 2);
      requestFolder.file(`request-${request.id}.json`, jsonData);
      
      // Add CSV export
      const parser = new Parser({
        delimiter: ',',
        header: true
      });
      const formattedRequest = formatRequestForExport(request);
      const csv = parser.parse([formattedRequest]);
      requestFolder.file(`request-${request.id}.csv`, csv);
      
      // Add PDF export for each request
      try {
        // Create new PDF document
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // Add title
        doc.setFontSize(18);
        doc.text(`Purchase Request: ${request.requestNumber || request.id}`, 14, 20);
        
        // Add basic info
        doc.setFontSize(12);
        doc.text(`Title: ${request.title}`, 14, 30);
        doc.text(`Status: ${request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Unknown'}`, 14, 38);
        doc.text(`Priority: ${request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : 'Unknown'}`, 14, 46);
        doc.text(`Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}`, 14, 54);
        doc.text(`Requester: ${request.requester?.username || 'Unknown'}`, 14, 62);
        doc.text(`Department: ${request.requester?.department || 'Unknown'}`, 14, 70);
        
        // Add description
        doc.text('Description:', 14, 82);
        const splitDescription = doc.splitTextToSize(request.description || 'No description provided', 180);
        doc.text(splitDescription, 14, 90);
        
        // Set y position after description
        let yPos = 90 + (splitDescription.length * 7);
        
        // Add items
        if (request.items && request.items.length > 0) {
          yPos += 10;
          doc.text('Items:', 14, yPos);
          yPos += 8;
          
          // Item table headers
          const itemHead = [['#', 'Name', 'Quantity', 'Est. Cost', 'Total']];
          const itemBody = request.items.map((item: any, index: number) => [
            index + 1,
            item.name || '',
            item.quantity || 0,
            (item.estimatedCost || 0).toFixed(2),
            ((item.quantity || 0) * (item.estimatedCost || 0)).toFixed(2)
          ]);
          
          // @ts-ignore
          doc.autoTable({
            head: itemHead,
            body: itemBody,
            startY: yPos,
            margin: { left: 14 },
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [66, 139, 202] }
          });
          
          // @ts-ignore
          yPos = doc.autoTable.previous.finalY + 10;
        }
        
        // Add approvals if they exist
        if (request.approvals && request.approvals.length > 0) {
          doc.text('Approval Status:', 14, yPos);
          yPos += 8;
          
          // Process approvals to ensure unique departments (fix for duplicate CEO Office approvals)
          // Create a map to hold the latest approval for each department
          const departmentApprovals = new Map();
          
          // Sort approvals by processed date (newest first)
          const sortedApprovals = [...request.approvals].sort((a, b) => {
            const dateA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
            const dateB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
            return dateB - dateA; // Descending order (newest first)
          });
          
          // Keep only the latest approval for each department
          sortedApprovals.forEach(approval => {
            if (!departmentApprovals.has(approval.department)) {
              departmentApprovals.set(approval.department, approval);
            }
          });
          
          // Convert map back to array
          const uniqueApprovals = Array.from(departmentApprovals.values());
          
          // Approval table headers
          const approvalHead = [['Department', 'Status', 'Approver', 'Date', 'Comments']];
          const approvalBody = uniqueApprovals.map((approval: any) => [
            approval.department || '',
            approval.status ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1) : '',
            approval.approver?.username || '',
            approval.processedAt ? new Date(approval.processedAt).toLocaleDateString() : 'Pending',
            approval.comments || ''
          ]);
          
          // @ts-ignore
          doc.autoTable({
            head: approvalHead,
            body: approvalBody,
            startY: yPos,
            margin: { left: 14 },
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [66, 139, 202] }
          });
        }
        
        // Add footer with total
        const totalCost = calculateTotalCost(request);
        doc.setFontSize(12);
        doc.text(`Total Amount: ${totalCost.toFixed(2)} ${request.currency || 'USD'}`, 14, doc.internal.pageSize.height - 20);
        
        // Generate PDF output as blob
        const pdfOutput = doc.output('blob');
        
        // Add PDF to the request folder
        requestFolder.file(`request-${request.id}.pdf`, pdfOutput);
      } catch (pdfError) {
        console.warn(`Failed to create PDF for request ${request.id}:`, pdfError);
      }
      
      // Add attachments if requested
      if (includeAttachments && request.attachments && request.attachments.length > 0) {
        const attachmentsFolder = requestFolder.folder('attachments');
        if (attachmentsFolder) {
          // For each attachment, fetch and add to zip
          for (const attachment of request.attachments) {
            try {
              const response = await fetch(attachment.fileUrl);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              attachmentsFolder.file(attachment.fileName, arrayBuffer);
            } catch (err) {
              console.warn(`Failed to include attachment ${attachment.fileName}:`, err);
            }
          }
        }
      }
    }
    
    // Generate the ZIP file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-export-${timestamp}.zip`;
    const content = await zip.generateAsync({ type: 'blob' });
    
    const downloadResult = await safeDownload(content, fileName);
    console.log(`ZIP export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('ZIP export error:', error);
    throw new Error(`Failed to export ZIP: ${error instanceof Error ? error.message : String(error)}`);
  }
}