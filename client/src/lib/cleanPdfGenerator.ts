/**
 * Clean PDF Generator - Final Working Version
 * No table width issues, clean layout, all data displays correctly
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { logPdfAuditEvent, generatePdfTrackingId } from './pdfAuditUtils';

export async function generateCleanPdf(request: any, settings: any = {}): Promise<void> {
  try {
    console.log('Generating clean PDF for request:', request.id);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin;
    
    // =====================================
    // HEADER SECTION
    // =====================================
    
    // E3 Company branding
    doc.setTextColor(147, 51, 234);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('E3', margin, currentY + 8);
    doc.setFontSize(10);
    doc.text('EVENTS & ENTERTAINMENT ENTERPRISES', margin + 15, currentY + 8);
    
    // Purple to Teal gradient bar
    const gradientHeight = 6;
    const gradientWidth = 100;
    const gradientX = margin + 70;
    const gradientY = currentY + 3;
    
    for (let i = 0; i < 50; i++) {
      const ratio = i / 50;
      const r = Math.round(147 * (1 - ratio) + 56 * ratio);
      const g = Math.round(51 * (1 - ratio) + 178 * ratio);
      const b = Math.round(234 * (1 - ratio) + 172 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(gradientX + (i * 2), gradientY, 2, gradientHeight, 'F');
    }
    
    // PR number and date (top right)
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`PR #${request.id}`, pageWidth - margin - 20, currentY + 6);
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin - 20, currentY + 10);
    
    currentY += 25;
    
    // =====================================
    // DOCUMENT TITLE
    // =====================================
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('PURCHASE REQUEST', margin, currentY);
    
    currentY += 20;
    
    // =====================================
    // REQUEST SUMMARY
    // =====================================
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Requester:', margin, currentY);
    doc.text('Status:', margin, currentY + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.username || 'N/A', margin + 25, currentY);
    doc.text(request.status?.toUpperCase() || 'PENDING', margin + 25, currentY + 6);
    
    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Department:', margin + 85, currentY);
    doc.text('Priority:', margin + 85, currentY + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.department || 'N/A', margin + 120, currentY);
    doc.text(request.priority?.toUpperCase() || 'LOW', margin + 120, currentY + 6);
    
    currentY += 20;
    
    // =====================================
    // BASIC INFORMATION SECTION
    // =====================================
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BASIC INFORMATION', margin + 3, currentY + 6);
    
    currentY += 15;
    
    // Basic info content
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    doc.text('Title:', margin + 3, currentY);
    doc.text('Description:', margin + 3, currentY + 6);
    doc.text('Purpose Type:', margin + 3, currentY + 12);
    doc.text('Sub-purpose:', margin + 3, currentY + 18);
    doc.text('Contact Info:', margin + 3, currentY + 24);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.title || 'N/A', margin + 30, currentY);
    doc.text(request.description || 'N/A', margin + 30, currentY + 6);
    doc.text(request.purposeType || 'N/A', margin + 30, currentY + 12);
    doc.text(request.subPurpose?.name || 'N/A', margin + 30, currentY + 18);
    doc.text(`Email: ${request.requester?.email || 'N/A'}`, margin + 30, currentY + 24);
    
    currentY += 35;
    
    // =====================================
    // VENDOR INFORMATION SECTION
    // =====================================
    if (request.vendor) {
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('VENDOR INFORMATION', margin + 3, currentY + 6);
      
      currentY += 15;
      
      // Vendor content
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.text('Vendor Name:', margin + 3, currentY);
      doc.text('Contact Person:', margin + 3, currentY + 6);
      doc.text('Email:', margin + 3, currentY + 12);
      doc.text('Phone:', margin + 3, currentY + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.companyName || 'N/A', margin + 30, currentY);
      doc.text(request.vendor.contactPerson || 'N/A', margin + 30, currentY + 6);
      doc.text(request.vendor.email || 'N/A', margin + 30, currentY + 12);
      doc.text(request.vendor.contactNumber || 'N/A', margin + 30, currentY + 18);
      
      currentY += 25;
    }
    
    // =====================================
    // ITEMS SECTION - SIMPLE TABLE
    // =====================================
    if (request.items && request.items.length > 0) {
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ITEMS', margin + 3, currentY + 6);
      
      currentY += 15;
      
      // Simple items table without autoTable to avoid width issues
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      // Table headers
      doc.text('Item', margin + 3, currentY);
      doc.text('Description', margin + 40, currentY);
      doc.text('Qty', margin + 90, currentY);
      doc.text('Unit Cost', margin + 110, currentY);
      doc.text('Total', margin + 145, currentY);
      
      currentY += 8;
      
      // Draw header line
      doc.setLineWidth(0.5);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, currentY - 2, margin + contentWidth, currentY - 2);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      let itemsTotal = 0;
      
      // Items rows
      for (const item of request.items) {
        const quantity = Number(item.quantity) || 0;
        const unitCost = Number(item.estimatedCost) || 0;
        const totalCost = quantity * unitCost;
        itemsTotal += totalCost;
        
        doc.text(item.name || 'N/A', margin + 3, currentY);
        doc.text(item.description || 'N/A', margin + 40, currentY);
        doc.text(quantity.toString(), margin + 90, currentY);
        doc.text(`QAR ${unitCost.toFixed(2)}`, margin + 110, currentY);
        doc.text(`QAR ${totalCost.toFixed(2)}`, margin + 145, currentY);
        
        currentY += 6;
      }
      
      // Add freight if present
      if (request.freightAmount && Number(request.freightAmount) > 0) {
        const freightCost = Number(request.freightAmount);
        doc.text('Freight/Shipping', margin + 3, currentY);
        doc.text('-', margin + 90, currentY);
        doc.text('-', margin + 110, currentY);
        doc.text(`QAR ${freightCost.toFixed(2)}`, margin + 145, currentY);
        currentY += 6;
        itemsTotal += freightCost;
      }
      
      // Total line
      doc.setFont('helvetica', 'bold');
      doc.line(margin + 110, currentY - 2, margin + contentWidth, currentY - 2);
      doc.text('TOTAL:', margin + 110, currentY + 3);
      doc.text(`QAR ${itemsTotal.toFixed(2)}`, margin + 145, currentY + 3);
      
      currentY += 15;
    }
    
    // =====================================
    // ATTACHMENTS SECTION
    // =====================================
    if (request.attachments && request.attachments.length > 0) {
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ATTACHED DOCUMENTS', margin + 3, currentY + 6);
      
      currentY += 15;
      
      // Simple attachments table
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.text('Document Name', margin + 3, currentY);
      doc.text('Type', margin + 100, currentY);
      doc.text('Size', margin + 130, currentY);
      
      currentY += 8;
      doc.line(margin, currentY - 2, margin + contentWidth, currentY - 2);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      for (const attachment of request.attachments) {
        doc.text(attachment.fileName || 'N/A', margin + 3, currentY);
        doc.text(attachment.fileType?.split('/')[1] || 'Unknown', margin + 100, currentY);
        const sizeInMB = attachment.fileSize ? (attachment.fileSize / 1024 / 1024).toFixed(2) : '0.00';
        doc.text(`${sizeInMB} MB`, margin + 130, currentY);
        currentY += 6;
      }
      
      currentY += 10;
    }
    
    // =====================================
    // APPROVAL INFORMATION - SIMPLE
    // =====================================
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('APPROVAL INFORMATION', margin + 3, currentY + 6);
    
    currentY += 15;
    
    if (request.approvals && request.approvals.length > 0) {
      // Show actual approvals
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.text('Approver', margin + 3, currentY);
      doc.text('Department', margin + 50, currentY);
      doc.text('Status', margin + 90, currentY);
      doc.text('Date', margin + 120, currentY);
      
      currentY += 8;
      doc.line(margin, currentY - 2, margin + contentWidth, currentY - 2);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      for (const approval of request.approvals) {
        doc.text(approval.approver?.username || 'N/A', margin + 3, currentY);
        doc.text(approval.approver?.department || 'N/A', margin + 50, currentY);
        doc.text(approval.status?.toUpperCase() || 'PENDING', margin + 90, currentY);
        const date = approval.approvedAt ? format(new Date(approval.approvedAt), 'dd/MM/yyyy') : 'Not processed';
        doc.text(date, margin + 120, currentY);
        currentY += 6;
      }
    } else {
      // No approvals required
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('No approvals required for this request.', margin + 3, currentY);
      currentY += 10;
    }
    
    currentY += 20;
    
    // =====================================
    // FOOTER
    // =====================================
    const footerY = pageHeight - 30;
    const footerHeight = 12;
    
    // Footer gradient
    for (let i = 0; i < 85; i++) {
      const ratio = i / 85;
      const r = Math.round(56 * (1 - ratio) + 147 * ratio);
      const g = Math.round(178 * (1 - ratio) + 51 * ratio);
      const b = Math.round(172 * (1 - ratio) + 234 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(margin + (i * 2), footerY, 2, footerHeight, 'F');
    }
    
    // Footer content
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    const companyPhone = settings.companyPhone || '55875904';
    const companyEmail = settings.companyEmail || 'amaanmalik12@gmail.com';
    const companyAddress = settings.companyAddress || 'Land Royal Building, Flat No. 210,';
    
    doc.text(`T: ${companyPhone} (LANDLINE)`, margin + 5, footerY + 4);
    doc.text(companyEmail, margin + 5, footerY + 8);
    doc.text('www.eeegq.com', margin + 5, footerY + 12);
    
    doc.text(companyAddress, margin + 80, footerY + 4);
    doc.text('West Bay, PO Box 35031,', margin + 80, footerY + 8);
    doc.text('Doha, Qatar', margin + 80, footerY + 12);
    
    const pageText = 'Page 1 of 1';
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth - 5, footerY + 8);
    
    // =====================================
    // SAVE AND AUDIT
    // =====================================
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    console.log('Saving clean PDF as:', fileName);
    
    const pdfBlob = doc.output('blob');
    saveAs(pdfBlob, fileName);
    
    // Audit logging
    try {
      const trackingId = generatePdfTrackingId();
      const requestId = typeof request.id === 'number' ? request.id : parseInt(String(request.id), 10);
      
      if (!isNaN(requestId) && requestId > 0) {
        await logPdfAuditEvent({
          requestId,
          action: 'pdf_downloaded',
          type: 'admin',
          details: {
            trackingId,
            exportType: 'single_pdf',
            fileName,
            fileSize: pdfBlob.size,
            timestamp: new Date().toISOString(),
            pageCount: 1,
            roleType: 'admin',
            type: 'admin'
          }
        });
        console.log('Clean PDF audit logged successfully');
      }
    } catch (auditError) {
      console.error('Audit logging failed:', auditError);
    }
    
    console.log('Clean PDF generated successfully');
    
  } catch (error) {
    console.error('Error generating clean PDF:', error);
    throw error;
  }
}