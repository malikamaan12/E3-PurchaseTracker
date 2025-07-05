/**
 * Professional PDF Generator - Clean Business Layout
 * Matches the exact design specification provided by user
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { logPdfAuditEvent, generatePdfTrackingId } from './pdfAuditUtils';

// Helper function to parse color from hex to RGB
function parseColor(colorHex: string): [number, number, number] {
  if (!colorHex || !colorHex.startsWith('#')) return [0, 0, 0];
  const hex = colorHex.substring(1);
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16)
  ];
}

// Reliable blob URL to base64 conversion
async function blobUrlToBase64(blobUrl: string): Promise<string | null> {
  try {
    console.log('Converting blob URL:', blobUrl);
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Empty blob');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Blob conversion failed:', error);
    return null;
  }
}

export async function generateProfessionalPdf(request: any, settings: any = {}): Promise<void> {
  try {
    console.log('Generating professional PDF for request:', request.id);
    console.log('PDF settings received:', settings);
    
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
    // HEADER SECTION - Purple to Teal Gradient
    // =====================================
    console.log('Creating header section...');
    
    const headerHeight = 25;
    const gradientSteps = 50;
    const stepWidth = contentWidth / gradientSteps;
    
    // Create gradient (purple to teal)
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const r = Math.round(147 * (1 - ratio) + 56 * ratio);  // Purple to Teal
      const g = Math.round(51 * (1 - ratio) + 178 * ratio);
      const b = Math.round(234 * (1 - ratio) + 172 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(margin + (i * stepWidth), currentY, stepWidth, headerHeight, 'F');
    }
    
    // Company logo (from admin settings)
    if (settings.logo && settings.logo.startsWith('blob:')) {
      try {
        const logoBase64 = await blobUrlToBase64(settings.logo);
        if (logoBase64) {
          const logoWidth = 20;
          const logoHeight = 15;
          const logoX = margin + 8;
          const logoY = currentY + 5;
          
          let imageFormat = 'PNG';
          if (logoBase64.includes('data:image/jpeg')) imageFormat = 'JPEG';
          
          doc.addImage(logoBase64, imageFormat, logoX, logoY, logoWidth, logoHeight);
        }
      } catch (error) {
        console.error('Logo loading failed:', error);
      }
    }
    
    // Company name and title (from admin settings)
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const companyName = settings.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES';
    doc.text(companyName, margin + 35, currentY + 10);
    
    doc.setFontSize(12);
    const documentTitle = settings.headerSubtitle || 'PURCHASE REQUEST';
    doc.text(documentTitle, margin + 35, currentY + 16);
    
    // Date and PR number (top right)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const dateText = `Date: ${format(new Date(), 'dd/MM/yyyy')}`;
    const prText = `PR #${request.id}`;
    doc.text(dateText, pageWidth - margin - 40, currentY + 10);
    doc.text(prText, pageWidth - margin - 40, currentY + 16);
    
    currentY += headerHeight + 15;
    
    // =====================================
    // REQUEST SUMMARY SECTION - Gray Box
    // =====================================
    console.log('Creating request summary section...');
    
    const summaryHeight = 25;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, currentY, contentWidth, summaryHeight, 'F');
    
    // Summary content
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    const summaryY = currentY + 8;
    doc.text('Requester:', margin + 5, summaryY);
    doc.text('Department:', margin + 5, summaryY + 6);
    doc.text('Status:', margin + 100, summaryY);
    doc.text('Priority:', margin + 100, summaryY + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.username || 'N/A', margin + 30, summaryY);
    doc.text(request.requester?.department || 'N/A', margin + 30, summaryY + 6);
    doc.text(request.status?.toUpperCase() || 'PENDING', margin + 120, summaryY);
    doc.text(request.priority?.toUpperCase() || 'LOW', margin + 120, summaryY + 6);
    
    currentY += summaryHeight + 15;
    
    // =====================================
    // BASIC INFORMATION SECTION
    // =====================================
    console.log('Creating basic information section...');
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BASIC INFORMATION', margin + 5, currentY + 6);
    
    currentY += 12;
    
    // Basic info content
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    doc.text('Title:', margin + 5, currentY);
    doc.text('Description:', margin + 5, currentY + 6);
    doc.text('Purpose Type:', margin + 5, currentY + 12);
    doc.text('Sub-purpose:', margin + 5, currentY + 18);
    doc.text('Contact Info:', margin + 5, currentY + 24);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.title || 'N/A', margin + 35, currentY);
    doc.text(request.description || 'N/A', margin + 35, currentY + 6);
    doc.text(request.purposeType || 'N/A', margin + 35, currentY + 12);
    doc.text(request.subPurpose?.name || 'N/A', margin + 35, currentY + 18);
    doc.text(`Email: ${request.requester?.email || 'N/A'}`, margin + 35, currentY + 24);
    
    currentY += 36;
    
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
      doc.setFontSize(11);
      doc.text('VENDOR INFORMATION', margin + 5, currentY + 6);
      
      currentY += 12;
      
      // Vendor content
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      
      doc.text('Vendor Name:', margin + 5, currentY);
      doc.text('Contact Person:', margin + 5, currentY + 6);
      doc.text('Email:', margin + 5, currentY + 12);
      doc.text('Phone:', margin + 5, currentY + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.companyName || request.vendor.name || 'N/A', margin + 40, currentY);
      doc.text(request.vendor.contactPerson || 'N/A', margin + 40, currentY + 6);
      doc.text(request.vendor.email || 'N/A', margin + 40, currentY + 12);
      doc.text(request.vendor.contactNumber || 'N/A', margin + 40, currentY + 18);
      
      currentY += 30;
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
      doc.setFontSize(11);
      doc.text('ITEMS', margin + 5, currentY + 6);
      
      currentY += 12;
      
      // Items table
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
          fontSize: 10,
          cellPadding: 3,
          textColor: [60, 60, 60],
          lineColor: [180, 180, 180],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [44, 44, 44],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 60 },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 36, halign: 'right' },
          4: { cellWidth: 36, halign: 'right' }
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 8;
      
      // Total calculation
      const itemsTotal = request.items.reduce((sum: number, item: any) => {
        return sum + (Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0);
      }, 0);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      const totalText = `Total: QAR ${itemsTotal.toFixed(2)}`;
      const totalWidth = doc.getTextWidth(totalText);
      doc.text(totalText, pageWidth - margin - totalWidth, currentY);
      
      currentY += 15;
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
      doc.setFontSize(11);
      doc.text('ATTACHED DOCUMENTS', margin + 5, currentY + 6);
      
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
          fontSize: 10,
          cellPadding: 3,
          textColor: [60, 60, 60],
          lineColor: [180, 180, 180],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [44, 44, 44],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10
        },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 45, halign: 'right' }
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 15;
    }
    
    // =====================================
    // SIGNATURES SECTION
    // =====================================
    console.log('Creating signatures section...');
    
    // Ensure signatures section has proper spacing from content above
    currentY += 10;
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('SIGNATURES', margin + 5, currentY + 6);

    currentY += 12;
    
    // Signature content
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('All rights reserved', margin + 5, currentY + 5);
    
    // =====================================
    // FOOTER SECTION - Teal to Purple Gradient
    // =====================================
    console.log('Creating footer...');
    
    const footerY = pageHeight - 30;
    const footerHeight = 15;
    
    // Footer gradient (teal to purple)
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const r = Math.round(56 * (1 - ratio) + 147 * ratio);  // Teal to Purple
      const g = Math.round(178 * (1 - ratio) + 51 * ratio);
      const b = Math.round(172 * (1 - ratio) + 234 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(margin + (i * stepWidth), footerY, stepWidth, footerHeight, 'F');
    }
    
    // Footer content
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const footerText = settings.footerText || 'Designed with ♡ by E3';
    doc.text(footerText, margin + 8, footerY + 10);
    
    // Page number
    const pageText = 'Page 1 of 1';
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth - 8, footerY + 10);
    
    // =====================================
    // WATERMARK (disabled to prevent text overlap)
    // =====================================
    // Watermark disabled as it causes readability issues
    console.log('Watermark disabled for better readability');
    
    // =====================================
    // SAVE AND AUDIT
    // =====================================
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    console.log('Saving PDF as:', fileName);
    
    const pdfBlob = doc.output('blob');
    saveAs(pdfBlob, fileName);
    
    // Log audit event
    const trackingId = generatePdfTrackingId();
    await logPdfAuditEvent({
      requestId: Number(request.id),
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
    
    console.log('Professional PDF generated successfully');
    
  } catch (error) {
    console.error('Error generating professional PDF:', error);
    throw error;
  }
}