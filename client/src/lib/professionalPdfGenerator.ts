/**
 * Professional PDF Generator - Fixed Version
 * Creates clean, professional PDF documents with proper admin settings integration
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

// Simplified blob URL to base64 conversion
async function blobUrlToBase64(blobUrl: string): Promise<string | null> {
  try {
    console.log('Converting blob URL:', blobUrl);
    
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Empty blob received');
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('Base64 conversion successful');
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Failed to read blob'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Blob URL conversion failed:', error);
    return null;
  }
}

export async function generateProfessionalPdf(request: any, settings: any = {}): Promise<void> {
  try {
    console.log('Generating professional PDF for request:', request.id);
    console.log('PDF settings received:', settings);
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = 210;
    const pageHeight = 297;
    const marginLeft = settings.marginLeft || 15;
    const marginRight = settings.marginRight || 15;
    const marginTop = settings.marginTop || 15;
    const marginBottom = settings.marginBottom || 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    let currentY = marginTop;
    
    // HEADER SECTION WITH GRADIENT
    console.log('Creating header section...');
    
    // Purple to Teal gradient header
    const gradientHeight = 15;
    const gradientSteps = 30;
    const stepWidth = contentWidth / gradientSteps;
    
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const r = Math.round(147 * (1 - ratio) + 56 * ratio);  // Purple to Teal
      const g = Math.round(51 * (1 - ratio) + 178 * ratio);
      const b = Math.round(234 * (1 - ratio) + 172 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(marginLeft + (i * stepWidth), currentY, stepWidth, gradientHeight, 'F');
    }
    
    // Company logo from admin settings
    if (settings.logo && settings.logo.startsWith('blob:')) {
      try {
        console.log('Loading company logo...');
        const logoBase64 = await blobUrlToBase64(settings.logo);
        if (logoBase64) {
          const logoWidth = 25;
          const logoHeight = 12;
          const logoX = marginLeft + 5;
          const logoY = currentY + 2;
          
          let imageFormat = 'PNG';
          if (logoBase64.includes('data:image/jpeg')) {
            imageFormat = 'JPEG';
          }
          
          doc.addImage(logoBase64, imageFormat, logoX, logoY, logoWidth, logoHeight);
          console.log('Logo added successfully');
        }
      } catch (error) {
        console.error('Failed to load logo:', error);
      }
    }
    
    // Title from admin settings
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const title = settings.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES';
    doc.text(title, marginLeft + 35, currentY + 8);
    
    doc.setFontSize(12);
    const subtitle = settings.headerSubtitle || 'PURCHASE REQUEST';
    doc.text(subtitle, marginLeft + 35, currentY + 12);
    
    // Request info in top right
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`PR #${request.id}`, pageWidth - marginRight - 20, currentY + 6);
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - marginRight - 20, currentY + 10);
    
    currentY += 20;
    
    // GRAY INFO SECTION
    console.log('Creating info section...');
    
    const infoSectionHeight = 20;
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, currentY, contentWidth, infoSectionHeight, 'F');
    
    // Info content
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    const infoY = currentY + 5;
    doc.text('Requester:', marginLeft + 5, infoY);
    doc.text('Department:', marginLeft + 5, infoY + 5);
    doc.text('Status:', marginLeft + 5, infoY + 10);
    doc.text('Priority:', marginLeft + 5, infoY + 15);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.requester?.username || 'N/A', marginLeft + 25, infoY);
    doc.text(request.requester?.department || 'N/A', marginLeft + 25, infoY + 5);
    doc.text(request.status?.toUpperCase() || 'PENDING', marginLeft + 25, infoY + 10);
    doc.text(request.priority?.toUpperCase() || 'LOW', marginLeft + 25, infoY + 15);
    
    currentY += infoSectionHeight + 10;
    
    // BASIC INFORMATION SECTION
    console.log('Creating basic information section...');
    
    // Black header
    doc.setFillColor(44, 44, 44);
    doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BASIC INFORMATION', marginLeft + 3, currentY + 6);
    
    currentY += 12;
    
    // Basic info content
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    doc.text('Title:', marginLeft + 5, currentY);
    doc.text('Description:', marginLeft + 5, currentY + 5);
    doc.text('Purpose Type:', marginLeft + 5, currentY + 10);
    doc.text('Contact Info:', marginLeft + 5, currentY + 15);
    
    doc.setFont('helvetica', 'normal');
    doc.text(request.title || 'N/A', marginLeft + 25, currentY);
    doc.text(request.description || 'N/A', marginLeft + 25, currentY + 5);
    doc.text(request.purposeType || 'N/A', marginLeft + 25, currentY + 10);
    doc.text(`Email: ${request.requester?.email || 'N/A'}`, marginLeft + 25, currentY + 15);
    
    currentY += 25;
    
    // VENDOR INFORMATION SECTION
    if (request.vendor) {
      console.log('Creating vendor information section...');
      
      // Black header
      doc.setFillColor(44, 44, 44);
      doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('VENDOR INFORMATION', marginLeft + 3, currentY + 6);
      
      currentY += 12;
      
      // Vendor content
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.text('Vendor Name:', marginLeft + 5, currentY);
      doc.text('Email:', marginLeft + 5, currentY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.name || 'N/A', marginLeft + 25, currentY);
      doc.text(request.vendor.email || 'N/A', marginLeft + 25, currentY + 5);
      
      currentY += 15;
    }
    
    // ITEMS SECTION
    if (request.items && request.items.length > 0) {
      console.log('Creating items section...');
      
      // Black header
      doc.setFillColor(44, 44, 44);
      doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ITEMS', marginLeft + 3, currentY + 6);
      
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
          `${request.currency || 'QAR'} ${unitCost.toFixed(2)}`,
          `${request.currency || 'QAR'} ${totalCost.toFixed(2)}`
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
          cellPadding: 4,
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
          0: { cellWidth: 30 },
          1: { cellWidth: 80 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' }
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 5;
      
      // Total calculation
      const itemsTotal = request.items.reduce((sum: number, item: any) => {
        return sum + (Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0);
      }, 0);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const totalText = `Total: ${request.currency || 'QAR'} ${itemsTotal.toFixed(2)}`;
      const totalWidth = doc.getTextWidth(totalText);
      doc.text(totalText, pageWidth - marginRight - totalWidth, currentY);
      
      currentY += 10;
    }
    
    // ATTACHED DOCUMENTS SECTION
    if (request.attachments && request.attachments.length > 0) {
      console.log('Creating attachments section...');
      
      // Black header
      doc.setFillColor(44, 44, 44);
      doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ATTACHED DOCUMENTS', marginLeft + 3, currentY + 6);
      
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
          cellPadding: 4,
          textColor: [60, 60, 60],
          lineColor: [180, 180, 180],
          lineWidth: 0.3
        },
        headStyles: { 
          fillColor: [44, 44, 44],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 10;
    }
    
    // SIGNATURES SECTION
    console.log('Creating signatures section...');
    
    // Black header
    doc.setFillColor(44, 44, 44);
    doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SIGNATURES', marginLeft + 3, currentY + 6);

    currentY += 12;
    
    // Signature content
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('ALL RIGHTS RESERVED', marginLeft + 3, currentY + 5);
    
    // FOOTER with gradient and admin settings
    console.log('Creating footer...');
    
    const footerY = pageHeight - 25;
    
    // Footer gradient
    const footerGradientHeight = 15;
    const footerGradientSteps = 30;
    const footerStepWidth = contentWidth / footerGradientSteps;
    
    for (let i = 0; i < footerGradientSteps; i++) {
      const ratio = i / footerGradientSteps;
      const r = Math.round(56 * (1 - ratio) + 147 * ratio);  // Teal to Purple
      const g = Math.round(178 * (1 - ratio) + 51 * ratio);
      const b = Math.round(172 * (1 - ratio) + 234 * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(marginLeft + (i * footerStepWidth), footerY, footerStepWidth, footerGradientHeight, 'F');
    }
    
    // Footer content from admin settings
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    const footerText = settings.footerText || 'Designed with ❤️ by E3';
    doc.text(footerText, marginLeft + 5, footerY + 10);
    
    // Page number
    const pageText = 'Page 1 of 1';
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - marginRight - pageTextWidth - 5, footerY + 10);
    
    // Add watermark if enabled
    if (settings.watermarkText && settings.watermarkOpacity > 0) {
      console.log('Adding watermark...');
      doc.setGState(new doc.GState({opacity: settings.watermarkOpacity / 100}));
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(48);
      
      const watermarkText = settings.watermarkText;
      const watermarkWidth = doc.getTextWidth(watermarkText);
      const watermarkX = (pageWidth - watermarkWidth) / 2;
      const watermarkY = pageHeight / 2;
      
      doc.text(watermarkText, watermarkX, watermarkY, { angle: 45 });
      doc.setGState(new doc.GState({opacity: 1}));
    }
    
    // Save and download
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    console.log('Saving PDF as:', fileName);
    
    const pdfBlob = doc.output('blob');
    saveAs(pdfBlob, fileName);
    
    // Log audit event
    const trackingId = generatePdfTrackingId();
    await logPdfAuditEvent({
      requestId: request.id,
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