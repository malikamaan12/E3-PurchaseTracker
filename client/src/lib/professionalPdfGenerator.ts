/**
 * Professional PDF Generator
 * Creates clean, professional PDF documents matching business standards
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { logPdfAuditEvent, generatePdfTrackingId } from './pdfAuditUtils';

export async function generateProfessionalPdf(request: any, settings: any = {}): Promise<void> {
  console.log("Generating professional PDF for request:", request.id);
  
  try {
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    }) as any;
    
    // Page settings
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin + 5;
    
    // HEADER SECTION
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    
    // Main title
    doc.text('PURCHASE REQUEST', margin, currentY + 8);
    
    // Request info on right side
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const rightAlign = pageWidth - margin;
    
    const prNumber = `PR #${request.id}`;
    const dateText = `Date: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`;
    
    doc.text(prNumber, rightAlign - doc.getTextWidth(prNumber), currentY + 3);
    doc.text(dateText, rightAlign - doc.getTextWidth(dateText), currentY + 8);
    
    currentY += 20;
    
    // Separator line
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;
    
    // TOP INFO SECTION (Gray background box)
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, currentY, contentWidth, 16, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    // Two columns layout
    const leftColX = margin + 3;
    const rightColX = margin + (contentWidth / 2) + 3;
    
    // Left column
    doc.text('Requester:', leftColX, currentY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(request.requester?.username || 'N/A', leftColX + 22, currentY + 4);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Status:', leftColX, currentY + 9);
    doc.setFont('helvetica', 'bold');
    doc.text((request.status || 'PENDING').toUpperCase(), leftColX + 22, currentY + 9);
    
    // Right column
    doc.setFont('helvetica', 'normal');
    doc.text('Department:', rightColX, currentY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(request.requester?.department || 'N/A', rightColX + 25, currentY + 4);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Priority:', rightColX, currentY + 9);
    doc.setFont('helvetica', 'bold');
    doc.text((request.priority || 'MEDIUM').toUpperCase(), rightColX + 25, currentY + 9);
    
    currentY += 22;
    
    // BASIC INFORMATION SECTION
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('BASIC INFORMATION', margin + 2, currentY + 4);
    
    currentY += 10;
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // Basic info fields
    doc.text('Title:', leftColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.title || 'N/A', leftColX + 15, currentY);
    currentY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text('Description:', leftColX, currentY);
    doc.setFont('helvetica', 'normal');
    const description = request.description || 'No description provided';
    // Handle long descriptions
    const lines = doc.splitTextToSize(description, contentWidth - 25);
    doc.text(lines, leftColX + 25, currentY);
    currentY += Math.max(5, lines.length * 3.5);
    
    doc.text('Purpose Type:', leftColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.purposeType || 'N/A', leftColX + 25, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Sub-purpose:', rightColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.subPurpose?.name || 'N/A', rightColX + 25, currentY);
    currentY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text('Contact Info:', leftColX, currentY);
    doc.text(`Email: ${request.requester?.email || 'N/A'}`, leftColX + 25, currentY);
    
    currentY += 12;
    
    // VENDOR INFORMATION SECTION
    if (request.vendor && (request.vendor.companyName || request.vendor.name)) {
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('VENDOR INFORMATION', margin + 2, currentY + 4);
      
      currentY += 10;
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const vendorName = request.vendor.companyName || request.vendor.name;
      doc.text('Vendor Name:', leftColX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(vendorName, leftColX + 25, currentY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Contact Person:', rightColX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(request.vendor.contactPerson || 'N/A', rightColX + 30, currentY);
      currentY += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text('Email:', leftColX, currentY);
      doc.text(request.vendor.email || 'N/A', leftColX + 15, currentY);
      
      doc.text('Phone:', rightColX, currentY);
      doc.text(request.vendor.contactNumber || 'N/A', rightColX + 15, currentY);
      
      currentY += 12;
    }
    
    // Add watermark if specified
    if (settings.watermarkText) {
      doc.setGState(new doc.GState({opacity: 0.1}));
      doc.setTextColor(180, 180, 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      
      // Center the watermark
      const watermarkWidth = doc.getTextWidth(settings.watermarkText);
      const watermarkX = (pageWidth - watermarkWidth * 0.7) / 2;
      const watermarkY = pageHeight / 2;
      
      doc.saveGraphicsState();
      doc.text(settings.watermarkText, watermarkX, watermarkY, { angle: 45 } as any);
      doc.restoreGraphicsState();
      doc.setGState(new doc.GState({opacity: 1}));
    }
    
    // ITEMS SECTION
    if (request.items && request.items.length > 0) {
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ITEMS', margin + 2, currentY + 4);
      
      currentY += 10;
      
      const tableHead = [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']];
      const tableBody = request.items.map((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitCost = Number(item.estimatedCost) || 0;
        const totalCost = quantity * unitCost;
        
        return [
          item.name || 'N/A',
          item.description || 'N/A',
          quantity.toString(),
          `${request.currency || 'QAR'} ${unitCost.toFixed(2)}`,
          `${request.currency || 'QAR'} ${totalCost.toFixed(2)}`
        ];
      });

      // @ts-ignore
      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: currentY,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          textColor: [40, 40, 40],
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [240, 240, 240],
          textColor: [40, 40, 40],
          fontStyle: 'bold',
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 60 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' }
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 5;
      
      // Financial summary
      const itemsTotal = request.items.reduce((sum: number, item: any) => {
        return sum + (Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0);
      }, 0);
      
      const summaryX = pageWidth - margin - 65;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Items Total:', summaryX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${request.currency || 'QAR'} ${itemsTotal.toFixed(2)}`, summaryX + 30, currentY);
      currentY += 4;
      
      if (request.freightAmount) {
        doc.setFont('helvetica', 'normal');
        doc.text('Freight:', summaryX, currentY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${request.currency || 'QAR'} ${Number(request.freightAmount).toFixed(2)}`, summaryX + 30, currentY);
        currentY += 4;
      }
      
      const totalCost = request.totalEstimatedCost || (itemsTotal + (Number(request.freightAmount) || 0));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Total Cost:', summaryX, currentY);
      doc.text(`${request.currency || 'QAR'} ${Number(totalCost).toFixed(2)}`, summaryX + 30, currentY);
      
      currentY += 12;
    }
    
    // ATTACHED DOCUMENTS SECTION
    if (request.attachments && request.attachments.length > 0) {
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ATTACHED DOCUMENTS', margin + 2, currentY + 4);
      
      currentY += 10;
      
      const attachmentHead = [['Document Name', 'Type', 'Size']];
      const attachmentBody = request.attachments.map((attachment: any) => [
        attachment.fileName || 'N/A',
        attachment.fileType?.split('/')[1] || 'Unknown',
        attachment.fileSize ? `${(attachment.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'
      ]);

      // @ts-ignore
      autoTable(doc, {
        head: attachmentHead,
        body: attachmentBody,
        startY: currentY,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          textColor: [40, 40, 40],
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [240, 240, 240],
          textColor: [40, 40, 40],
          fontStyle: 'bold',
          fontSize: 8
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // SIGNATURES SECTION
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SIGNATURES', margin + 2, currentY + 4);
    
    currentY += 10;
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('ALL RIGHTS RESERVED', margin + 2, currentY);
    
    // FOOTER
    const footerY = pageHeight - 12;
    
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    
    const footerText = 'Phone: +974 30488565 | Email: info@eeegq.com | Web: www.eeegq.com';
    const footerAddress = 'Palm Tower B 36th Floor, 3602 West Bay, Doha, Qatar';
    
    doc.text(footerText, margin, footerY);
    doc.text(footerAddress, margin, footerY + 3);
    
    // Page number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageText = `Page ${i} of ${pageCount}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, footerY + 3);
    }
    
    // Save the PDF
    const pdfBlob = doc.output('blob');
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    
    // Generate tracking ID and log audit event
    const trackingId = generatePdfTrackingId(request.id);
    const auditDetails = {
      trackingId,
      exportType: 'single_pdf',
      fileName,
      fileSize: pdfBlob.size,
      timestamp: new Date().toISOString(),
      pageCount: doc.internal.getNumberOfPages(),
      roleType: 'admin',
      type: 'admin'
    };
    
    // Log the audit event
    console.log("Sending audit log payload:", JSON.stringify({
      requestId: request.id,
      action: 'pdf_downloaded',
      type: 'admin',
      details: auditDetails
    }));
    
    await logPdfAuditEvent(request.id, 'pdf_downloaded', 'admin', auditDetails);
    
    // Download the file
    saveAs(pdfBlob, fileName);
    console.log("Professional PDF generated successfully");
    
  } catch (error) {
    console.error("Professional PDF generation error:", error);
    throw error;
  }
}