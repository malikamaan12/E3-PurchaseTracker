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
function formatRequestJSON(request: any): string {
  // Create a simplified version of the request for better readability
  const simplifiedRequest = {
    id: request.id,
    requestNumber: request.requestNumber,
    title: request.title,
    description: request.description,
    status: request.status,
    priority: request.priority,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requester: request.requester ? {
      id: request.requester.id,
      username: request.requester.username,
      department: request.requester.department
    } : null,
    vendor: request.vendor ? {
      id: request.vendor.id,
      name: request.vendor.companyName || request.vendor.name,
      contactPerson: request.vendor.contactPerson,
      email: request.vendor.email,
      phone: request.vendor.contactNumber || request.vendor.phone
    } : null,
    purposeType: request.purposeType,
    subPurpose: request.subPurpose ? {
      id: request.subPurpose.id,
      name: request.subPurpose.name
    } : null,
    items: Array.isArray(request.items) ? request.items : [],
    approvals: Array.isArray(request.approvals) ? request.approvals.map(approval => ({
      id: approval.id,
      status: approval.status,
      department: approval.department,
      approver: approval.approver ? approval.approver.username : null,
      processedAt: approval.processedAt,
      comments: approval.comments
    })) : [],
    attachments: Array.isArray(request.attachments) ? request.attachments.map(attachment => ({
      id: attachment.id,
      fileName: attachment.fileName || attachment.name,
      fileType: attachment.fileType || attachment.type,
      fileSize: attachment.fileSize || attachment.size
    })) : []
  };
  
  return JSON.stringify(simplifiedRequest, null, 2);
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
 * Exports multiple purchase requests as a ZIP file
 * 
 * @param requests An array of purchase requests
 * @param type The user type (user, approver, admin)
 */
export async function exportMultipleRequestsAsZip(
  requests: any[], 
  type: 'user' | 'approver' | 'admin' = 'admin'
) {
  try {
    const zip = new JSZip();
    const mainFolder = zip.folder('purchase_requests_export');
    
    if (!mainFolder) {
      throw new Error('Failed to create main ZIP folder');
    }
    
    // Process each request
    const requestPromises = requests.map(async (request, index) => {
      try {
        const requestNumber = request.requestNumber || request.id;
        const folderName = `request_${requestNumber}`;
        const folder = mainFolder.folder(folderName);
        
        if (!folder) {
          throw new Error(`Failed to create folder for request ${requestNumber}`);
        }
        
        // Add request data as JSON
        folder.file('request-data.json', formatRequestJSON(request));
        
        // Add PDF file
        const doc = await generateRequestPDF(request, type);
        folder.file(`Purchase_Request_${requestNumber}.pdf`, doc.output('blob'));
        
        // Include basic information about attachments
        if (request.attachments?.length > 0) {
          folder.file('attachments-info.json', JSON.stringify(
            request.attachments.map((attachment: any) => ({
              id: attachment.id,
              fileName: attachment.fileName || attachment.name,
              fileType: attachment.fileType || attachment.type,
              fileSize: attachment.fileSize || attachment.size,
              url: attachment.fileUrl
            })), 
            null, 
            2
          ));
        }
      } catch (error) {
        console.error(`Error processing request ${request.id}:`, error);
        // Continue with other requests even if one fails
      }
    });
    
    // Wait for all requests to be processed
    await Promise.all(requestPromises);
    
    // Create a summary file
    const summary = {
      exportDate: new Date().toISOString(),
      totalRequests: requests.length,
      exportType: type,
      requestIds: requests.map(r => r.id)
    };
    
    mainFolder.file('export-summary.json', JSON.stringify(summary, null, 2));
    
    // Generate the zip file and trigger download
    const content = await zip.generateAsync({ type: 'blob' });
    const exportName = `purchase_requests_export_${new Date().toISOString().split('T')[0]}.zip`;
    saveAs(content, exportName);
    
    return exportName;
  } catch (error) {
    console.error('Error exporting multiple requests as ZIP:', error);
    throw error;
  }
}