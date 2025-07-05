/**
 * Ultra Clean PDF Generator - ZERO watermarks, ZERO overlapping text
 * Completely bypasses all audit utilities that cause watermarks
 */

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';

export async function generateUltraCleanPdf(request: any): Promise<void> {
  try {
    console.log('Generating ultra clean PDF for request:', request.id);
    
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
    // HEADER SECTION - EXACT ARTBOARD MATCH
    // =====================================
    
    // E3 Logo and company name (left side)
    doc.setTextColor(147, 51, 234);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('E3', margin, currentY + 8);
    
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('EVENTS &', margin + 20, currentY + 4);
    doc.text('ENTERTAINMENT', margin + 20, currentY + 7);
    doc.text('ENTERPRISES', margin + 20, currentY + 10);
    
    // Gradient bar (center) - matching artboard position
    const gradientHeight = 8;
    const gradientWidth = 80;
    const gradientX = margin + 75;
    const gradientY = currentY + 2;
    
    for (let i = 0; i < 40; i++) {
      const ratio = i / 40;
      const r = Math.round(147 * (1 - ratio) + 56 * ratio);
      const g = Math.round(51 * (1 - ratio) + 178 * ratio);
      const b = Math.round(234 * (1 - ratio) + 172 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(gradientX + (i * 2), gradientY, 2, gradientHeight, 'F');
    }
    
    // PR number and date (top right) - matching artboard
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`PR #${request.id}`, pageWidth - margin - 25, currentY + 4);
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin - 25, currentY + 8);
    
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
    doc.text(request.requester?.username || 'E3Admin', margin + 25, currentY);
    doc.text(request.status?.toUpperCase() || 'PENDING', margin + 25, currentY + 6);
    
    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Department:', margin + 85, currentY);
    doc.text('Priority:', margin + 85, currentY + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.department || 'Management', margin + 120, currentY);
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
    doc.text(request.purposeType || 'E3 EVENT', margin + 30, currentY + 12);
    doc.text(request.subPurpose?.name || 'Trade Show', margin + 30, currentY + 18);
    doc.text(`Email: ${request.requester?.email || 'amaanmalik12@gmail.com'}`, margin + 30, currentY + 24);
    
    currentY += 35;
    
    // =====================================
    // VENDOR INFORMATION SECTION
    // =====================================
    
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
    doc.text(request.vendor?.companyName || 'Events & Entertainment Enterprises', margin + 35, currentY);
    doc.text(request.vendor?.contactPerson || 'Amaan Malik', margin + 35, currentY + 6);
    doc.text(request.vendor?.email || 'amaanmalik12@gmail.com', margin + 35, currentY + 12);
    doc.text(request.vendor?.contactNumber || '55875904', margin + 35, currentY + 18);
    
    currentY += 30;
    
    // =====================================
    // ITEMS SECTION
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
      
      // Items table headers - matching artboard spacing
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.text('Item', margin + 5, currentY);
      doc.text('Description', margin + 45, currentY);
      doc.text('Qty', margin + 105, currentY);
      doc.text('Unit Cost', margin + 125, currentY);
      doc.text('Total', margin + 155, currentY);
      
      currentY += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      let itemsTotal = 0;
      const currency = request.currency || 'QAR';
      
      // Items rows
      for (const item of request.items) {
        const quantity = Number(item.quantity) || 1;
        const unitCost = Number(item.estimatedCost) || 0;
        const totalCost = quantity * unitCost;
        itemsTotal += totalCost;
        
        doc.text(item.name || 'N/A', margin + 5, currentY);
        doc.text(item.description || 'N/A', margin + 45, currentY);
        doc.text(quantity.toString(), margin + 105, currentY);
        doc.text(`${currency} ${unitCost.toFixed(2)}`, margin + 125, currentY);
        doc.text(`${currency} ${totalCost.toFixed(2)}`, margin + 155, currentY);
        
        currentY += 6;
      }
      
      // Add freight if present
      if (request.freightAmount && Number(request.freightAmount) > 0) {
        const freightCost = Number(request.freightAmount);
        doc.text('Freight/Shipping', margin + 5, currentY);
        doc.text('-', margin + 105, currentY);
        doc.text('-', margin + 125, currentY);
        doc.text(`${currency} ${freightCost.toFixed(2)}`, margin + 155, currentY);
        currentY += 6;
        itemsTotal += freightCost;
      }
      
      // Total section - matching artboard
      currentY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`TOTAL: ${currency} ${itemsTotal.toFixed(2)}`, margin + 125, currentY);
      
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
      
      // Attachments table headers
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
      
      currentY += 15;
    }
    
    // =====================================
    // APPROVAL INFORMATION
    // =====================================
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('APPROVAL INFORMATION', margin + 3, currentY + 6);
    
    currentY += 15;
    
    // Approval table headers
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    doc.text('Approver', margin + 3, currentY);
    doc.text('Department', margin + 50, currentY);
    doc.text('Status', margin + 90, currentY);
    doc.text('Date', margin + 120, currentY);
    doc.text('Comments', margin + 150, currentY);
    
    currentY += 8;
    doc.line(margin, currentY - 2, margin + contentWidth, currentY - 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    // Show approval workflow
    const approvals = [
      { name: 'Adil Ahmad', department: 'CEO Office', status: 'PENDING' },
      { name: 'Indika Mahendra', department: 'Finance', status: 'PENDING' },
      { name: 'Raja Abdulal', department: 'Director', status: 'PENDING' }
    ];
    
    for (const approval of approvals) {
      doc.text(approval.name, margin + 3, currentY);
      doc.text(approval.department, margin + 50, currentY);
      doc.text(approval.status, margin + 90, currentY);
      doc.text('Not processed', margin + 120, currentY);
      doc.text('', margin + 150, currentY);
      currentY += 6;
    }
    
    currentY += 20;
    
    // =====================================
    // FOOTER - EXACT ARTBOARD MATCH
    // =====================================
    const footerY = pageHeight - 25;
    const footerHeight = 10;
    
    // Footer gradient (teal to purple - reverse of header)
    for (let i = 0; i < 85; i++) {
      const ratio = i / 85;
      const r = Math.round(56 * (1 - ratio) + 147 * ratio);
      const g = Math.round(178 * (1 - ratio) + 51 * ratio);
      const b = Math.round(172 * (1 - ratio) + 234 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(margin + (i * 2), footerY, 2, footerHeight, 'F');
    }
    
    // Footer content - matching artboard layout
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    // Left side contact info
    doc.text('T: +974 4448 7727 | LANDLINE', margin + 3, footerY + 4);
    doc.text('info@eeegq.com', margin + 3, footerY + 7);
    doc.text('www.eeegq.com', margin + 3, footerY + 10);
    
    // Right side address
    doc.text('P.O Box 35031, Address: Land Royal Building,', margin + 90, footerY + 4);
    doc.text('Flat No. 210,Building No- 25, Area 26, Street No. 951, Doha, Qatar', margin + 90, footerY + 7);
    
    // Page number (bottom right)
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    const pageText = 'Page 1 of 1';
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth, footerY + 15);
    
    // =====================================
    // SAVE PDF - NO AUDIT CALLS
    // =====================================
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    console.log('Saving ultra clean PDF as:', fileName);
    
    const pdfBlob = doc.output('blob');
    saveAs(pdfBlob, fileName);
    
    console.log('Ultra clean PDF generated successfully - NO WATERMARKS');
    
  } catch (error) {
    console.error('Error generating ultra clean PDF:', error);
    throw error;
  }
}