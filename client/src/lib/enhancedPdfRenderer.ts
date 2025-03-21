/**
 * Enhanced PDF Renderer
 * 
 * This file provides improved PDF rendering with consistent handling of:
 * - Header titles
 * - Watermarks
 * - Content/section visibility
 * - Footer content
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseRequestWithRelations } from '../types/requests';
import {
  PdfTemplateSettings,
  applyHeaderSettings,
  applyFooterSettings,
  applyWatermarkSettings,
  getSectionVisibility,
  fetchPdfSettings
} from './pdfTemplateSettings';
import { generatePdfTrackingId, logPdfAuditEvent } from './pdfAuditUtils';

/**
 * Generate a PDF from a purchase request
 */
export async function generateEnhancedPdf(
  request: PurchaseRequestWithRelations,
  type: 'user' | 'approver' | 'admin' = 'user'
): Promise<jsPDF> {
  try {
    // Generate a tracking ID for this PDF instance
    const trackingId = generatePdfTrackingId(request.id, request.requesterId);
    console.log(`Generating PDF with tracking ID: ${trackingId}`);
    
    // Get template configuration and settings
    let pdfSettings: PdfTemplateSettings = await fetchPdfSettings();
    console.log('Fetched PDF settings for rendering');
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true,
      floatPrecision: 16 // Better precision for graphics
    });
    
    // Apply header with settings
    let yPos = applyHeaderSettings(doc, pdfSettings);
    
    // Add Request Information section
    yPos = addSection(doc, 'Request Information', yPos);
    
    const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString();
      } catch (e) {
        return 'N/A';
      }
    };
    
    // Add request details
    if (getSectionVisibility(pdfSettings, 'BasicInfo')) {
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        body: [
          ['Title:', request.title || 'N/A'],
          ['Description:', request.description || 'N/A'],
          ['Purpose:', `${request.purposeType || 'N/A'} - ${request.subPurpose?.name || 'N/A'}`],
          ['Priority:', request.priority?.toUpperCase() || 'N/A'],
          ['Status:', request.status?.toUpperCase() || 'N/A'],
          ['Created Date:', formatDate(request.createdAt)],
          ['Last Updated:', formatDate(request.updatedAt)]
        ]
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add Vendor Information if available
    if (getSectionVisibility(pdfSettings, 'VendorDetails') && request.vendor) {
      yPos = addSection(doc, 'Vendor Information', yPos);
      
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        body: [
          ['Vendor Name:', request.vendor.companyName || request.vendor.name || 'N/A'],
          ['Contact Person:', request.vendor.contactPerson || 'N/A'],
          ['Contact Number:', request.vendor.contactNumber || request.vendor.phone || 'N/A'],
          ['Email:', request.vendor.email || 'N/A']
        ]
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add Items section
    if (getSectionVisibility(pdfSettings, 'Items') && request.items?.length > 0) {
      yPos = addSection(doc, 'Requested Items', yPos);
      
      // Calculate if we need a new page
      if (yPos > doc.internal.pageSize.height - 100) {
        doc.addPage();
        yPos = 20;
      }
      
      // Add items table
      const itemRows = request.items.map(item => [
        item.name || 'N/A',
        item.quantity.toString(),
        (request.currency || 'QAR') + ' ' + item.estimatedCost.toFixed(2),
        (request.currency || 'QAR') + ' ' + (item.quantity * item.estimatedCost).toFixed(2),
        item.description || ''
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Item Name', 'Quantity', 'Unit Price', 'Total', 'Description']],
        body: itemRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [80, 80, 80] }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
      
      // Add totals if needed
      if (getSectionVisibility(pdfSettings, 'TotalsTable')) {
        const itemsTotal = request.items.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
        const freightAmount = request.freightAmount || 0;
        const totalCost = itemsTotal + freightAmount;
        
        autoTable(doc, {
          startY: yPos,
          body: [
            ['', '', 'Items Total:', (request.currency || 'QAR') + ' ' + itemsTotal.toFixed(2)],
            ['', '', 'Freight Amount:', (request.currency || 'QAR') + ' ' + freightAmount.toFixed(2)],
            ['', '', 'Total Cost:', (request.currency || 'QAR') + ' ' + totalCost.toFixed(2)]
          ],
          styles: { fontSize: 10 },
          columnStyles: {
            2: { fontStyle: 'bold', halign: 'right' },
            3: { halign: 'right' }
          }
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
    }
    
    // Add Approvals section
    if (getSectionVisibility(pdfSettings, 'ApprovalFlow') && request.approvals?.length > 0) {
      // Check if we need a new page
      if (yPos > doc.internal.pageSize.height - 100) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = addSection(doc, 'Approval Flow', yPos);
      
      const approvalRows = request.approvals.map(approval => [
        approval.department || 'N/A',
        approval.approver?.username || 'N/A',
        approval.status?.toUpperCase() || 'PENDING',
        formatDate(approval.processedAt),
        approval.comments || ''
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Department', 'Approver', 'Status', 'Date', 'Comments']],
        body: approvalRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [80, 80, 80] }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add Attachments section
    if (getSectionVisibility(pdfSettings, 'Attachments') && request.attachments?.length > 0) {
      // Check if we need a new page
      if (yPos > doc.internal.pageSize.height - 80) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = addSection(doc, 'Attachments', yPos);
      
      const attachmentRows = request.attachments.map(attachment => [
        attachment.fileName || 'N/A',
        formatFileSize(attachment.fileSize),
        attachment.fileType || 'N/A'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['File Name', 'Size', 'Type']],
        body: attachmentRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [80, 80, 80] }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add Signature Lines if enabled
    if (getSectionVisibility(pdfSettings, 'SignatureLines')) {
      // Check if we need a new page
      if (yPos > doc.internal.pageSize.height - 80) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = addSection(doc, 'Signatures', yPos);
      
      // Add signature lines
      const lineWidth = 60;
      const pageWidth = doc.internal.pageSize.width;
      const startX = (pageWidth - (lineWidth * 2 + 20)) / 2;
      
      // First signature line
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.5);
      doc.line(startX, yPos + 20, startX + lineWidth, yPos + 20);
      
      doc.setFontSize(10);
      doc.text('Requester', startX + lineWidth / 2, yPos + 25, { align: 'center' });
      
      // Second signature line
      doc.line(startX + lineWidth + 20, yPos + 20, startX + lineWidth * 2 + 20, yPos + 20);
      doc.text('Final Approver', startX + lineWidth + 20 + lineWidth / 2, yPos + 25, { align: 'center' });
      
      yPos = yPos + 35;
    }
    
    // Apply footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      applyFooterSettings(doc, pdfSettings, i, pageCount);
    }
    
    // Apply watermark if enabled
    applyWatermarkSettings(doc, pdfSettings);
    
    // Log audit event for PDF generation (non-blocking async)
    logPdfAuditEvent(
      request.id, 
      'pdf_generated', 
      {
        trackingId,
        pdfType: type,
        securityLevel: 'internal',
        pageCount,
        timestamp: new Date().toISOString()
      },
      type
    ).catch(err => console.error('Error logging PDF generation:', err));
    
    return doc;
  } catch (error) {
    console.error('Error generating enhanced PDF:', error);
    throw error;
  }
}

/**
 * Add a section title to the PDF
 */
function addSection(doc: jsPDF, title: string, yPos: number): number {
  // Add section title
  doc.setFillColor(240, 240, 240);
  doc.rect(0, yPos, doc.internal.pageSize.width, 8, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(title, 15, yPos + 5.5);
  
  return yPos + 12;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return 'N/A';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}