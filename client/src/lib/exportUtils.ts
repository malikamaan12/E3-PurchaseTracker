import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateRequestPDF } from './pdfGenerator';

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
 * Exports multiple purchase requests as a ZIP file with advanced error handling
 * 
 * @param requests An array of purchase requests
 * @param type The user type (user, approver, admin)
 * @returns The name of the created ZIP file
 * @throws Error if the export process fails
 */
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