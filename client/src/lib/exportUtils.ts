/**
 * Export Utilities
 * 
 * Functions for exporting data to various formats
 */

import { generateEnhancedPdf } from './enhancedPdfRenderer';
import { fetchPdfSettings } from './pdfTemplateSettings';
import { PurchaseRequestWithRelations } from '@/types/requests';
import axios from 'axios';

/**
 * Export a purchase request to PDF
 */
export async function exportRequestToPDF(
  request: PurchaseRequestWithRelations,
  userRoleForAudit: string = 'user',
  includeAttachments = true,
  includeSignatures = true
): Promise<string> {
  try {
    // Fetch PDF settings
    const settings = await fetchPdfSettings();
    
    // Generate PDF
    const pdfData = await generateEnhancedPdf(request, settings, {
      includeAttachments,
      includeSignatures,
    });
    
    // Log audit event
    await logPdfExport(request.id, 'generated');
    
    // Create file name
    const filename = `PR-${request.requestNumber || request.id}-${Date.now()}.pdf`;
    
    // Create temporary URL for the PDF
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    return filename;
  } catch (error) {
    console.error('Failed to export request to PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Download a purchase request as PDF
 */
export async function downloadRequestAsPdf(
  request: PurchaseRequestWithRelations,
  includeAttachments = true,
  includeSignatures = true
): Promise<void> {
  try {
    // Generate PDF filename
    const filename = await exportRequestToPDF(request, 'user', includeAttachments, includeSignatures);
    
    // Fetch PDF settings
    const settings = await fetchPdfSettings();
    
    // Generate PDF
    const pdfData = await generateEnhancedPdf(request, settings, {
      includeAttachments,
      includeSignatures,
    });
    
    // Create blob
    const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
    
    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Purchase_Request_${request.requestNumber || request.id}.pdf`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    
    // Log audit event
    await logPdfExport(request.id, 'downloaded');
  } catch (error) {
    console.error('Failed to download request as PDF:', error);
    throw new Error('Failed to download PDF');
  }
}

/**
 * Log PDF export for audit
 */
export async function logPdfExport(requestId: number, action: 'generated' | 'downloaded' | 'viewed'): Promise<void> {
  try {
    const auditAction = `pdf_${action}` as const;
    
    await axios.post('/api/pdf/audit', {
      resourceId: requestId,
      action: auditAction,
      details: {
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Failed to log PDF export for audit:', error);
    // Don't throw error here to avoid interrupting the main flow
  }
}

/**
 * Export multiple requests as a PDF
 */
export async function exportMultipleRequestsToPDF(
  requests: PurchaseRequestWithRelations[],
  userType: string = 'user'
): Promise<string> {
  try {
    // Only handle the first request for PDF (multiple go to ZIP)
    if (requests.length === 0) {
      throw new Error('No requests provided for PDF export');
    }
    
    // Use the first request for single PDF export
    const request = requests[0];
    
    // Generate PDF file name
    return await exportRequestToPDF(request, userType);
  } catch (error) {
    console.error('Failed to export multiple requests to PDF:', error);
    throw new Error('Failed to generate PDF for multiple requests');
  }
}

/**
 * Export multiple requests bundled as a ZIP file
 */
export async function exportMultipleRequestsAsZip(
  requests: PurchaseRequestWithRelations[],
  userType: string = 'user'
): Promise<string> {
  try {
    // Create a JSZip instance
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Add each request as a PDF to the zip
    for (const request of requests) {
      // Get PDF data for this request
      const settings = await fetchPdfSettings();
      const pdfData = await generateEnhancedPdf(request, settings, {
        includeAttachments: true,
        includeSignatures: true,
      });
      
      // Add PDF to zip
      const filename = `PR-${request.requestNumber || request.id}.pdf`;
      zip.file(filename, pdfData);
      
      // Log audit event
      await logPdfExport(request.id, 'generated');
    }
    
    // Generate the zip file
    const zipContent = await zip.generateAsync({ type: 'blob' });
    
    // Create a filename for the ZIP
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFilename = `purchase-requests-${timestamp}.zip`;
    
    // Create and trigger download link
    const url = URL.createObjectURL(zipContent);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    return zipFilename;
  } catch (error) {
    console.error('Failed to export requests as ZIP:', error);
    throw new Error('Failed to generate ZIP file');
  }
}

/**
 * Export purchase requests to CSV format
 */
export async function exportRequestsToCsv(requests: PurchaseRequestWithRelations[]): Promise<Blob> {
  try {
    // Import json2csv dynamically to reduce initial load time
    const { Parser } = await import('@json2csv/plainjs');
    
    // Define fields to include
    const fields = [
      { label: 'Request Number', value: 'requestNumber' },
      { label: 'Title', value: 'title' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Purpose Type', value: 'purposeType' },
      { label: 'Total Cost', value: 'totalEstimatedCost' },
      { label: 'Created Date', value: 'createdAt' },
      { label: 'Requestor', value: row => row.requester?.username || '' },
      { label: 'Department', value: row => row.requester?.department || '' },
      { label: 'Sub-Purpose', value: row => row.subPurpose?.name || '' },
      { label: 'Vendor', value: row => row.vendor?.companyName || row.vendor?.name || '' },
    ];
    
    // Create parser instance
    const parser = new Parser({ fields });
    
    // Convert to CSV
    const csv = parser.parse(requests);
    
    // Add BOM for Excel compatibility
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvData = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
    
    return csvData;
  } catch (error) {
    console.error('Failed to export requests to CSV:', error);
    throw new Error('Failed to generate CSV');
  }
}