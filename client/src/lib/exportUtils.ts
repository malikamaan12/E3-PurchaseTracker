import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import { format } from 'date-fns';

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
  if (!request?.items || !Array.isArray(request.items)) return 0;
  
  return request.items.reduce((sum: number, item: { quantity: number; estimatedCost: number }) => {
    return sum + (item.quantity * item.estimatedCost || 0);
  }, 0) + (request.freightAmount || 0);
}

/**
 * Format a purchase request for export with comprehensive field coverage
 */
function formatRequestForExport(request: any) {
  if (!request) return {};
  
  const totalCost = calculateTotalCost(request);
  
  return {
    'Request ID': request.id,
    'Request Number': request.requestNumber || `PR-${request.id}`,
    'Title': request.title,
    'Description': request.description,
    'Status': request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : '',
    'Priority': request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : '',
    'Created Date': request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '',
    'Updated Date': request.updatedAt ? new Date(request.updatedAt).toLocaleDateString() : '',
    'Requester': request.requester?.username || '',
    'Department': request.requester?.department || '',
    'Vendor': request.vendor?.companyName || request.vendor?.name || '',
    'Purpose Type': request.purposeType || '',
    'Sub Purpose': request.subPurpose?.name || '',
    'Total Cost': totalCost.toFixed(2),
    'Currency': request.currency || 'USD',
    'Items Count': request.items?.length || 0,
    'Freight Amount': request.freightAmount ? request.freightAmount.toFixed(2) : '0.00',
    'Approval Status': getApprovalSummary(request),
    'Has Attachments': request.attachments && request.attachments.length > 0 ? 'Yes' : 'No',
    'Attachment Count': request.attachments?.length || 0
  };
}

/**
 * Get a summary of approval status
 */
function getApprovalSummary(request: any): string {
  if (!request.approvals || request.approvals.length === 0) {
    return 'No approvals';
  }
  
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
  
  // Count approvals by status
  const approved = uniqueApprovals.filter((a: any) => a.status === 'approved').length;
  const rejected = uniqueApprovals.filter((a: any) => a.status === 'rejected').length;
  const pending = uniqueApprovals.filter((a: any) => a.status === 'pending').length;
  const total = uniqueApprovals.length;
  
  return `${approved}/${total} approved, ${rejected} rejected, ${pending} pending`;
}

/**
 * Export a purchase request to CSV format
 */
export async function exportRequestToCSV(request: any): Promise<string> {
  const formattedRequest = formatRequestForExport(request);
  
  try {
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    const csv = parser.parse([formattedRequest]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    await safeDownload(blob, `purchase-request-${request.id}.csv`);
    return 'success';
  } catch (csvError) {
    console.error('CSV export error:', csvError);
    throw new Error(`Failed to export CSV: ${csvError}`);
  }
}

/**
 * Export a purchase request to Excel format with multiple sheets
 */
export async function exportRequestToExcel(request: any): Promise<string> {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add main request sheet
    const mainData = [formatRequestForExport(request)];
    const mainWs = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, mainWs, 'Request Details');
    
    // Add items sheet if present
    if (request.items && request.items.length > 0) {
      const itemsData = request.items.map((item: any, index: number) => ({
        'Item #': index + 1,
        'Name': item.name || '',
        'Description': item.description || '',
        'Quantity': item.quantity || 0,
        'Unit Cost': item.estimatedCost ? item.estimatedCost.toFixed(2) : '0.00',
        'Total Cost': (item.quantity * item.estimatedCost).toFixed(2) || '0.00'
      }));
      const itemsWs = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, itemsWs, 'Items');
    }
    
    // Add approvals sheet if present
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
    }
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await safeDownload(blob, `purchase-request-${request.id}.xlsx`);
    return 'success';
  } catch (excelError) {
    console.error('Excel export error:', excelError);
    throw new Error(`Failed to export Excel file: ${excelError}`);
  }
}

/**
 * Export a purchase request to PDF format
 */
export async function exportRequestToPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
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
    
    // Generate the PDF
    const pdfOutput = doc.output('blob');
    await safeDownload(pdfOutput, `purchase-request-${request.id}.pdf`);
    return 'success';
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error(`Failed to export PDF: ${error}`);
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
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add summary sheet with all requests
    const summaryData = requests.map((request: any) => formatRequestForExport(request));
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
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
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await safeDownload(blob, `purchase-requests-export.xlsx`);
    return 'success';
  } catch (error) {
    console.error('Multiple Excel export error:', error);
    throw new Error(`Failed to export multiple requests to Excel: ${error}`);
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
    // Format all requests
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    // Create CSV
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    const csv = parser.parse(formattedRequests);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    await safeDownload(blob, `purchase-requests-export.csv`);
    return 'success';
  } catch (error) {
    console.error('Multiple CSV export error:', error);
    throw new Error(`Failed to export multiple requests to CSV: ${error}`);
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
    const content = await zip.generateAsync({ type: 'blob' });
    await safeDownload(content, 'purchase-requests-pdf-export.zip');
    return 'success';
  } catch (error) {
    console.error('Multiple PDF export error:', error);
    throw new Error(`Failed to export multiple requests to PDF: ${error}`);
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
    const content = await zip.generateAsync({ type: 'blob' });
    await safeDownload(content, 'purchase-requests-export.zip');
    return 'success';
  } catch (error) {
    console.error('ZIP export error:', error);
    throw new Error(`Failed to export requests as ZIP: ${error}`);
  }
}