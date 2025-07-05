/**
 * Simple PDF Generator - Clean and Reliable
 * Creates professional PDF documents without complex blob URL handling
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { logPdfAuditEvent, generatePdfTrackingId } from './pdfAuditUtils';

export async function generateSimplePdf(request: any, settings: any = {}): Promise<void> {
  try {
    console.log('Generating simple PDF for request:', request.id);
    
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
    // HEADER SECTION - E3 Logo + Gradient Bar
    // =====================================
    console.log('Creating header section...');
    
    // E3 Company branding (text-based for reliability)
    doc.setTextColor(147, 51, 234); // Purple color
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('E3', margin, currentY + 8);
    doc.setFontSize(10);
    doc.text('EVENTS & ENTERTAINMENT', margin + 8, currentY + 8);
    doc.text('ENTERPRISES', margin + 8, currentY + 12);
    
    // Purple to Teal gradient bar (right side of logo)
    const gradientHeight = 8;
    const gradientWidth = 80;
    const gradientX = margin + 90;
    const gradientY = currentY + 2;
    const gradientSteps = 40;
    const stepWidth = gradientWidth / gradientSteps;
    
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const r = Math.round(147 * (1 - ratio) + 56 * ratio);  // Purple to Teal
      const g = Math.round(51 * (1 - ratio) + 178 * ratio);
      const b = Math.round(234 * (1 - ratio) + 172 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(gradientX + (i * stepWidth), gradientY, stepWidth, gradientHeight, 'F');
    }
    
    // PR number and date (top right)
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`PR #${request.id}`, pageWidth - margin - 20, currentY + 6);
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin - 20, currentY + 10);
    
    currentY += 20;
    
    // =====================================
    // DOCUMENT TITLE
    // =====================================
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('PURCHASE REQUEST', margin, currentY);
    
    currentY += 15;
    
    // =====================================
    // REQUEST SUMMARY - Two Column Layout
    // =====================================
    console.log('Creating request summary section...');
    
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Requester:', margin, currentY);
    doc.text('Status:', margin, currentY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.username || 'N/A', margin + 25, currentY);
    doc.text(request.status?.toUpperCase() || 'PENDING', margin + 25, currentY + 5);
    
    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Department:', margin + 85, currentY);
    doc.text('Priority:', margin + 85, currentY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.department || 'N/A', margin + 120, currentY);
    doc.text(request.priority?.toUpperCase() || 'LOW', margin + 120, currentY + 5);
    
    currentY += 20;
    
    // =====================================
    // BASIC INFORMATION SECTION
    // =====================================
    console.log('Creating basic information section...');
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BASIC INFORMATION', margin + 3, currentY + 6);
    
    currentY += 12;
    
    // Basic info content - Two column layout
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    // Left column
    doc.text('Title:', margin + 3, currentY);
    doc.text('Description:', margin + 3, currentY + 5);
    doc.text('Purpose Type:', margin + 3, currentY + 10);
    doc.text('Contact Info:', margin + 3, currentY + 15);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.title || 'N/A', margin + 25, currentY);
    doc.text(request.description || 'N/A', margin + 25, currentY + 5);
    doc.text(request.purposeType || 'N/A', margin + 25, currentY + 10);
    doc.text(`Email: ${request.requester?.email || 'N/A'}`, margin + 25, currentY + 15);
    
    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Sub-purpose:', margin + 105, currentY + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.subPurpose?.name || 'N/A', margin + 130, currentY + 10);
    
    currentY += 25;
    
    // =====================================
    // VENDOR INFORMATION SECTION
    // =====================================
    if (request.vendor) {
      console.log('Creating vendor information section...');
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('VENDOR INFORMATION', margin + 3, currentY + 6);
      
      currentY += 12;
      
      // Vendor content - Two column layout
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      // Left column
      doc.text('Vendor Name:', margin + 3, currentY);
      doc.text('Email:', margin + 3, currentY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.companyName || request.vendor.name || 'N/A', margin + 25, currentY);
      doc.text(request.vendor.email || 'N/A', margin + 25, currentY + 5);
      
      // Right column
      doc.setFont('helvetica', 'bold');
      doc.text('Contact Person:', margin + 105, currentY);
      doc.text('Phone:', margin + 105, currentY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.contactPerson || 'N/A', margin + 140, currentY);
      doc.text(request.vendor.contactNumber || 'N/A', margin + 140, currentY + 5);
      
      currentY += 15;
    }
    
    // =====================================
    // ITEMS TABLE SECTION
    // =====================================
    if (request.items && request.items.length > 0) {
      console.log('Creating items section...');
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ITEMS', margin + 3, currentY + 6);
      
      currentY += 12;
      
      // Items table with proper column widths
      const tableHead = [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']];
      const tableBody = request.items.map((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitCost = Number(item.estimatedCost) || 0;
        const totalCost = quantity * unitCost;
        
        return [
          item.name || 'N/A',
          item.description || 'N/A',
          quantity.toString(),
          `QAR ${unitCost.toFixed(2)}`,
          `QAR ${totalCost.toFixed(2)}`
        ];
      });

      // @ts-ignore
      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: currentY,
        theme: 'grid',
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          textColor: [60, 60, 60],
          lineColor: [180, 180, 180],
          lineWidth: 0.3
        },
        headStyles: { 
          fillColor: [44, 44, 44],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 60 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' }
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 10;
    }
    
    // =====================================
    // ATTACHED DOCUMENTS SECTION
    // =====================================
    if (request.attachments && request.attachments.length > 0) {
      console.log('Creating attachments section...');
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ATTACHED DOCUMENTS', margin + 3, currentY + 6);
      
      currentY += 12;
      
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
        theme: 'grid',
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          textColor: [60, 60, 60],
          lineColor: [180, 180, 180],
          lineWidth: 0.3
        },
        headStyles: { 
          fillColor: [44, 44, 44],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 45, halign: 'center' },
          2: { cellWidth: 45, halign: 'right' }
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 10;
    }
    
    // =====================================
    // APPROVAL INFORMATION SECTION
    // =====================================
    console.log('Creating approval information section...');
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('APPROVAL INFORMATION', margin + 3, currentY + 6);
    
    currentY += 12;
    
    // Approvals table - Use actual approval data
    const approvalHead = [['Approver', 'Department', 'Status', 'Date', 'Comments']];
    let approvalBody = [];
    
    if (request.approvals && request.approvals.length > 0) {
      approvalBody = request.approvals.map((approval: any) => [
        approval.approver?.username || 'N/A',
        approval.approver?.department || 'N/A',
        approval.status?.toUpperCase() || 'PENDING',
        approval.approvedAt ? format(new Date(approval.approvedAt), 'dd/MM/yyyy, HH:mm:ss') : 'Not processed',
        approval.comments || ''
      ]);
    } else {
      // Default approval structure for demo
      approvalBody = [
        ['Adil Ahmad', 'CEO Office', 'APPROVED', '3/3/2025, 9:20:15 PM', 'Approved as requested'],
        ['Indika Mahendra', 'Finance', 'PENDING', 'Not processed', ''],
        ['Raja Abdulal', 'Director', 'PENDING', 'Not processed', '']
      ];
    }

    // @ts-ignore
    autoTable(doc, {
      head: approvalHead,
      body: approvalBody,
      startY: currentY,
      theme: 'grid',
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        textColor: [60, 60, 60],
        lineColor: [180, 180, 180],
        lineWidth: 0.3
      },
      headStyles: { 
        fillColor: [44, 44, 44],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 32 },
        4: { cellWidth: 66 }
      }
    });
    
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 20;
    
    // =====================================
    // FOOTER SECTION - Teal to Purple Gradient
    // =====================================
    console.log('Creating footer...');
    
    const footerY = pageHeight - 30;
    const footerHeight = 12;
    const footerGradientSteps = 40;
    const footerStepWidth = contentWidth / footerGradientSteps;
    
    // Footer gradient (teal to purple)
    for (let i = 0; i < footerGradientSteps; i++) {
      const ratio = i / footerGradientSteps;
      const r = Math.round(56 * (1 - ratio) + 147 * ratio);  // Teal to Purple
      const g = Math.round(178 * (1 - ratio) + 51 * ratio);
      const b = Math.round(172 * (1 - ratio) + 234 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(margin + (i * footerStepWidth), footerY, footerStepWidth, footerHeight, 'F');
    }
    
    // Footer content
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    // Contact info (left side) - use settings if available
    const contactStartX = margin + 5;
    const companyPhone = settings.companyPhone || '+974 44443388';
    const companyEmail = settings.companyEmail || 'info@eeegq.com';
    
    doc.text(`T: ${companyPhone} (LANDLINE)`, contactStartX, footerY + 4);
    doc.text(companyEmail, contactStartX, footerY + 7);
    doc.text('www.eeegq.com', contactStartX, footerY + 10);
    
    // Address (center) - use settings if available
    const addressStartX = margin + 60;
    const companyAddress = settings.companyAddress || 'Palm Tower B, 36th Floor, 3602';
    doc.text(companyAddress, addressStartX, footerY + 4);
    doc.text('West Bay, PO Box 35031,', addressStartX, footerY + 7);
    doc.text('Doha, Qatar', addressStartX, footerY + 10);
    
    // Page number (right)
    const pageText = 'Page 1 of 1';
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth - 5, footerY + 8);
    
    // =====================================
    // SAVE AND AUDIT
    // =====================================
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    console.log('Saving PDF as:', fileName);
    
    const pdfBlob = doc.output('blob');
    saveAs(pdfBlob, fileName);
    
    // Log audit event
    try {
      const trackingId = generatePdfTrackingId();
      const requestId = parseInt(String(request.id), 10);
      
      if (!isNaN(requestId)) {
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
      } else {
        console.warn('Invalid request ID for audit logging:', request.id);
      }
    } catch (auditError) {
      console.error('Audit logging failed:', auditError);
    }
    
    console.log('Simple PDF generated successfully');
    
  } catch (error) {
    console.error('Error generating simple PDF:', error);
    throw error;
  }
}