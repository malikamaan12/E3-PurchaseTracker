import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateRequestPDF } from './pdfGenerator';
import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';

/**
 * Exports a purchase request as a PDF document
 * 
 * @param request The purchase request data
 * @param type The type of PDF to generate (user, approver, admin)
 */
export async function exportRequestToPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user') {
  try {
    const doc = await generateRequestPDF(request, type);
    const pdfName = `Purchase_Request_${request.requestNumber || request.id}_${type}.pdf`;
    doc.save(pdfName);
    return pdfName;
  } catch (error) {
    console.error('Error exporting request to PDF:', error);
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
    const response = await fetch(attachment.fileUrl);
    const blob = await response.blob();
    saveAs(blob, attachment.fileName);
  } catch (error) {
    console.error('Error downloading attachment:', error);
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
 */
export async function exportRequestAsZip(
  request: any, 
  includeAttachments: boolean = true, 
  type: 'user' | 'approver' | 'admin' = 'user'
) {
  try {
    const zip = new JSZip();
    const folderName = `request_${request.requestNumber || request.id}`;
    const folder = zip.folder(folderName);
    
    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }
    
    // Add purchase request data as JSON
    folder.file('request-data.json', formatRequestJSON(request));
    
    // Add request PDF 
    const doc = await generateRequestPDF(request, type);
    const pdfData = doc.output('blob');
    folder.file(`Purchase_Request_${request.requestNumber || request.id}.pdf`, pdfData);
    
    // If admin export, include all PDFs
    if (type === 'admin') {
      const userPdf = await generateRequestPDF(request, 'user');
      const approverPdf = await generateRequestPDF(request, 'approver');
      
      folder.file(`Purchase_Request_${request.requestNumber || request.id}_user.pdf`, userPdf.output('blob'));
      folder.file(`Purchase_Request_${request.requestNumber || request.id}_approver.pdf`, approverPdf.output('blob'));
    }
    
    // Add attachments if required
    if (includeAttachments && request.attachments?.length > 0) {
      const attachmentsFolder = folder.folder('attachments');
      
      if (!attachmentsFolder) {
        throw new Error('Failed to create attachments folder');
      }
      
      // Process each attachment
      const attachmentPromises = request.attachments.map(async (attachment: any) => {
        try {
          const response = await fetch(attachment.fileUrl);
          const blob = await response.blob();
          const fileName = attachment.fileName || attachment.name || `file_${attachment.id}`;
          attachmentsFolder.file(fileName, blob);
        } catch (error) {
          console.error(`Error processing attachment ${attachment.id}:`, error);
          // Continue with other attachments even if one fails
        }
      });
      
      // Wait for all attachments to be processed
      await Promise.all(attachmentPromises);
    }
    
    // Generate the zip file and trigger download
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${folderName}.zip`);
    
    return `${folderName}.zip`;
  } catch (error) {
    console.error('Error exporting request as ZIP:', error);
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
    console.log('Starting Excel export...');
    
    // Validate request data
    if (!request || !request.id) {
      throw new Error('Invalid request data');
    }
    
    // Create simplified request object for basic information
    const requestData = {
      'Request Number': request.requestNumber || `REQ-${request.id}`,
      'Title': request.title || 'Untitled Request',
      'Status': request.status || 'draft',
      'Priority': request.priority || 'medium',
      'Created Date': request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A',
      'Requester': request.requester?.username || 'Unknown',
      'Department': request.requester?.department || 'N/A',
      'Purpose Type': request.purposeType || 'N/A',
      'Sub-Purpose': request.subPurpose?.name || 'N/A',
      'Description': request.description || '',
      'Total Estimated Cost': calculateTotalCost(request) || 0,
      'Currency': request.currency || 'USD',
      'Vendor': request.vendor?.companyName || request.vendor?.name || 'N/A'
    };
    
    // Create workbook and add requests worksheet
    const wb = XLSX.utils.book_new();
    const wsRequest = XLSX.utils.json_to_sheet([requestData]);
    XLSX.utils.book_append_sheet(wb, wsRequest, 'Request Info');
    
    // Add items worksheet if there are items
    if (Array.isArray(request.items) && request.items.length > 0) {
      try {
        const items = request.items.map((item: any, index: number) => ({
          'Item #': index + 1,
          'Name': item?.name || 'Unnamed Item',
          'Quantity': item?.quantity || 0,
          'Estimated Cost': item?.estimatedCost || 0,
          'Total': (item?.quantity || 0) * (item?.estimatedCost || 0),
          'Description': item?.description || ''
        }));
        
        const wsItems = XLSX.utils.json_to_sheet(items);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
      } catch (itemError) {
        console.error('Error processing items for Excel export:', itemError);
        const wsItemsError = XLSX.utils.aoa_to_sheet([['Error processing items']]);
        XLSX.utils.book_append_sheet(wb, wsItemsError, 'Items (Error)');
      }
    }
    
    // Add approvals worksheet if includeDetails is true
    if (includeDetails && Array.isArray(request.approvals) && request.approvals.length > 0) {
      try {
        const approvals = request.approvals.map((approval: any, index: number) => ({
          'Approval #': index + 1,
          'Department': approval?.department || 'N/A',
          'Approver': approval?.approver?.username || 'N/A',
          'Status': approval?.status || 'pending',
          'Date': approval?.processedAt ? new Date(approval?.processedAt).toLocaleString() : 'N/A',
          'Comments': approval?.comments || ''
        }));
        
        const wsApprovals = XLSX.utils.json_to_sheet(approvals);
        XLSX.utils.book_append_sheet(wb, wsApprovals, 'Approvals');
      } catch (approvalError) {
        console.error('Error processing approvals for Excel export:', approvalError);
        const wsApprovalsError = XLSX.utils.aoa_to_sheet([['Error processing approvals']]);
        XLSX.utils.book_append_sheet(wb, wsApprovalsError, 'Approvals (Error)');
      }
    }
    
    // Add attachments worksheet if includeDetails is true
    if (includeDetails && Array.isArray(request.attachments) && request.attachments.length > 0) {
      try {
        const attachments = request.attachments.map((attachment: any, index: number) => ({
          'Attachment #': index + 1,
          'File Name': attachment?.fileName || attachment?.name || `file_${attachment?.id || index}`,
          'File Type': attachment?.fileType || attachment?.type || 'Unknown',
          'File Size (bytes)': attachment?.fileSize || attachment?.size || 0,
          'Download URL': attachment?.fileUrl || 'N/A'
        }));
        
        const wsAttachments = XLSX.utils.json_to_sheet(attachments);
        XLSX.utils.book_append_sheet(wb, wsAttachments, 'Attachments');
      } catch (attachmentError) {
        console.error('Error processing attachments for Excel export:', attachmentError);
        const wsAttachmentsError = XLSX.utils.aoa_to_sheet([['Error processing attachments']]);
        XLSX.utils.book_append_sheet(wb, wsAttachmentsError, 'Attachments (Error)');
      }
    }
    
    // Generate Excel file and trigger download
    const fileName = `Purchase_Request_${request.requestNumber || request.id}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    console.log('Excel export complete:', fileName);
    return fileName;
  } catch (error) {
    console.error('Error exporting request to Excel:', error);
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
export async function exportRequestToCSV(
  request: any, 
  exportType: 'basic' | 'items' | 'approvals' | 'all' = 'all'
): Promise<string> {
  try {
    console.log('Starting CSV export...');
    
    // Validate request data
    if (!request || !request.id) {
      throw new Error('Invalid request data');
    }
    
    const fileName = `Purchase_Request_${request.requestNumber || request.id}`;
    
    if (exportType === 'basic' || exportType === 'all') {
      // Export basic request information
      try {
        const basicData = {
          request_number: request.requestNumber || `REQ-${request.id}`,
          title: request.title || 'Untitled Request',
          status: request.status || 'draft',
          priority: request.priority || 'medium',
          created_date: request.createdAt || new Date().toISOString(),
          requester: request.requester?.username || 'Unknown',
          department: request.requester?.department || 'N/A',
          purpose_type: request.purposeType || 'N/A',
          sub_purpose: request.subPurpose?.name || 'N/A',
          description: request.description || '',
          total_estimated_cost: calculateTotalCost(request) || 0,
          currency: request.currency || 'USD',
          vendor: request.vendor?.companyName || request.vendor?.name || 'N/A'
        };
        
        const parser = new Parser();
        const csv = parser.parse([basicData]);
        
        const basicFileName = `${fileName}_basic.csv`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, basicFileName);
        
        if (exportType === 'basic') {
          console.log('CSV export complete:', basicFileName);
          return basicFileName;
        }
      } catch (basicError) {
        console.error('Error exporting basic request data to CSV:', basicError);
        if (exportType === 'basic') {
          throw basicError;
        }
      }
    }
    
    if (exportType === 'items' || exportType === 'all') {
      // Export items information
      if (Array.isArray(request.items) && request.items.length > 0) {
        try {
          const items = request.items.map((item: any, index: number) => ({
            item_number: index + 1,
            name: item?.name || 'Unnamed Item',
            quantity: item?.quantity || 0,
            estimated_cost: item?.estimatedCost || 0,
            total: (item?.quantity || 0) * (item?.estimatedCost || 0),
            description: item?.description || ''
          }));
          
          const parser = new Parser();
          const csv = parser.parse(items);
          
          const itemsFileName = `${fileName}_items.csv`;
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          saveAs(blob, itemsFileName);
          
          if (exportType === 'items') {
            console.log('CSV export complete:', itemsFileName);
            return itemsFileName;
          }
        } catch (itemsError) {
          console.error('Error exporting items to CSV:', itemsError);
          if (exportType === 'items') {
            throw itemsError;
          }
        }
      } else if (exportType === 'items') {
        const noItemsFileName = `${fileName}_no_items.csv`;
        const blob = new Blob(['No items found'], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, noItemsFileName);
        return noItemsFileName;
      }
    }
    
    if (exportType === 'approvals' || exportType === 'all') {
      // Export approvals information
      if (Array.isArray(request.approvals) && request.approvals.length > 0) {
        try {
          const approvals = request.approvals.map((approval: any, index: number) => ({
            approval_number: index + 1,
            department: approval?.department || 'N/A',
            approver: approval?.approver?.username || 'N/A',
            status: approval?.status || 'pending',
            processed_date: approval?.processedAt || '',
            comments: approval?.comments || ''
          }));
          
          const parser = new Parser();
          const csv = parser.parse(approvals);
          
          const approvalsFileName = `${fileName}_approvals.csv`;
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          saveAs(blob, approvalsFileName);
          
          if (exportType === 'approvals') {
            console.log('CSV export complete:', approvalsFileName);
            return approvalsFileName;
          }
        } catch (approvalsError) {
          console.error('Error exporting approvals to CSV:', approvalsError);
          if (exportType === 'approvals') {
            throw approvalsError;
          }
        }
      } else if (exportType === 'approvals') {
        const noApprovalsFileName = `${fileName}_no_approvals.csv`;
        const blob = new Blob(['No approvals found'], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, noApprovalsFileName);
        return noApprovalsFileName;
      }
    }
    
    if (exportType === 'all') {
      console.log('CSV export complete: Multiple files generated');
      return `${fileName}_all.csv`;
    }
    
    return `${fileName}.csv`;
  } catch (error) {
    console.error('Error exporting request to CSV:', error);
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
    console.log('Starting bulk Excel export...');
    
    // Validate requests data
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('No valid requests to export');
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create summary sheet
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
    
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Add individual request sheets for the first 10 requests 
    // (to avoid extremely large files)
    const maxDetailedRequests = Math.min(requests.length, 10);
    
    for (let i = 0; i < maxDetailedRequests; i++) {
      try {
        const request = requests[i];
        const requestNumber = request.requestNumber || request.id || `Request_${i+1}`;
        
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
        
        const wsRequest = XLSX.utils.aoa_to_sheet(requestData);
        XLSX.utils.book_append_sheet(wb, wsRequest, `REQ-${i+1}`);
      } catch (requestError) {
        console.error(`Error processing request ${i+1} for Excel export:`, requestError);
      }
    }
    
    // Generate Excel file and trigger download
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `Purchase_Requests_Export_${timestamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    console.log('Bulk Excel export complete:', fileName);
    return fileName;
  } catch (error) {
    console.error('Error exporting multiple requests to Excel:', error);
    throw error;
  }
}

export async function exportMultipleRequestsAsZip(
  requests: any[], 
  type: 'user' | 'approver' | 'admin' = 'admin'
) {
  try {
    console.log(`Starting bulk export of ${requests?.length || 0} requests`);
    
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
    console.log('Processing requests one by one...');
    let successCount = 0;
    let failureCount = 0;
    const errors: Record<string, string> = {};
    
    const requestPromises = requests.map(async (request, index) => {
      try {
        // Validate request object
        if (!request || !request.id) {
          console.warn(`Skipping invalid request at index ${index}`);
          failureCount++;
          errors[`request_${index}`] = 'Invalid request data';
          return;
        }
        
        const requestNumber = request.requestNumber || request.id;
        const folderName = `request_${requestNumber}`;
        const folder = mainFolder.folder(folderName);
        
        if (!folder) {
          console.warn(`Failed to create folder for request ${requestNumber}`);
          failureCount++;
          errors[`request_${requestNumber}`] = 'Failed to create folder';
          return;
        }
        
        // Add request data as JSON
        try {
          folder.file('request-data.json', formatRequestJSON(request));
        } catch (jsonError: any) {
          console.error(`Error creating JSON for request ${requestNumber}:`, jsonError);
          folder.file('json-error.txt', `Failed to format JSON: ${jsonError.message || 'Unknown error'}`);
        }
        
        // Add PDF file
        try {
          const doc = await generateRequestPDF(request, type);
          const pdfData = doc.output('blob');
          folder.file(`Purchase_Request_${requestNumber}.pdf`, pdfData);
        } catch (pdfError: any) {
          console.error(`Error generating PDF for request ${requestNumber}:`, pdfError);
          folder.file('pdf-error.txt', `Failed to generate PDF: ${pdfError.message || 'Unknown error'}`);
          errors[`request_${requestNumber}_pdf`] = pdfError.message || 'Unknown PDF generation error';
        }
        
        // Add attachments information if available
        if (request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
          try {
            const attachmentsFolder = folder.folder('attachments');
            
            if (!attachmentsFolder) {
              console.warn(`Failed to create attachments folder for request ${requestNumber}`);
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
            console.error(`Error processing attachments for request ${requestNumber}:`, attachmentError);
            errors[`request_${requestNumber}_attachments`] = attachmentError.message || 'Error processing attachments';
          }
        }
        
        successCount++;
        console.log(`Processed request ${index + 1}/${requests.length}: ${requestNumber}`);
      } catch (requestError: any) {
        console.error(`Error processing request ${index + 1}/${requests.length}:`, requestError);
        failureCount++;
        errors[`request_${index + 1}`] = requestError.message || 'Unknown error';
      }
    });
    
    // Wait for all requests to be processed
    await Promise.all(requestPromises);
    
    // Add processing summary and error log
    mainFolder.file('processing-log.txt', 
      `Export completed at: ${new Date().toISOString()}\n` +
      `Total requests: ${requests.length}\n` +
      `Successfully processed: ${successCount}\n` +
      `Failed to process: ${failureCount}\n\n` +
      (Object.keys(errors).length > 0 ? 
        `Errors encountered:\n${Object.entries(errors).map(([key, msg]) => `- ${key}: ${msg}`).join('\n')}` : 
        'No errors encountered during processing.')
    );
    
    console.log(`Export processing complete. Success: ${successCount}, Failures: ${failureCount}`);
    
    // Generate and download the ZIP file
    console.log('Generating ZIP file...');
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const filename = `purchase_requests_export_${new Date().toISOString().split('T')[0]}.zip`;
    saveAs(content, filename);
    
    console.log(`ZIP file '${filename}' created and download initiated`);
    return filename;
  } catch (error: any) {
    console.error('Error exporting multiple requests as ZIP:', error);
    throw new Error(`Bulk export failed: ${error.message || 'Unknown error'}`);
  }
}