/**
 * Professional PDF Generator
 * Creates clean, professional PDF documents matching business standards
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

// Helper function to convert blob URL to base64 synchronously
async function blobUrlToBase64(blobUrl: string): Promise<string | null> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not convert blob URL to base64:', error);
    return null;
  }
}

export async function generateProfessionalPdf(request: any, settings: any = {}): Promise<void> {
  console.log("Generating professional PDF for request:", request.id);
  console.log("PDF settings received:", settings);
  
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
    
    // Apply margins from settings
    const marginTop = settings.marginTop || 15;
    const marginLeft = settings.marginLeft || 15;
    const marginRight = settings.marginRight || 15;
    const marginBottom = settings.marginBottom || 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    // Apply global font settings
    const baseFontSize = settings.fontSize || 9;
    const baseFontFamily = settings.fontFamily || 'helvetica';
    const textColor = parseColor(settings.textColor || '#000000');
    
    let currentY = marginTop + 5;
    
    // HEADER SECTION with dynamic settings
    const headerColor = parseColor(settings.headerColor || '#000000');
    const headerFontSize = settings.headerFontSize || 20;
    const headerFontFamily = settings.headerFontFamily || baseFontFamily;
    
    doc.setFont(headerFontFamily, 'bold');
    doc.setFontSize(headerFontSize);
    doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
    
    // Custom header title from admin settings - use the actual title from settings
    const headerTitle = settings.headerTitle || 'PURCHASE REQUEST';
    doc.text(headerTitle, marginLeft, currentY + 8);
    
    // Add header subtitle if available
    if (settings.headerSubtitle) {
      doc.setFontSize(12);
      doc.setFont(headerFontFamily, 'normal');
      doc.text(settings.headerSubtitle, marginLeft, currentY + 16);
    }
    
    // Add company logo if available (check different logo field names)
    const logoField = settings.logo || settings.companyLogo || settings.headerImage;
    if (logoField && logoField.startsWith('blob:')) {
      try {
        // Add logo on the right side of header
        const logoWidth = 30;
        const logoHeight = 20;
        const logoX = pageWidth - marginRight - logoWidth;
        const logoY = currentY - 5;
        
        // Convert blob URL to base64 for PDF
        const base64Logo = await blobUrlToBase64(logoField);
        if (base64Logo) {
          doc.addImage(base64Logo, 'PNG', logoX, logoY, logoWidth, logoHeight);
        }
      } catch (error) {
        console.warn('Could not load logo from blob URL:', error);
      }
    }
    
    // Add header image if available and different from logo
    const headerImageField = settings.headerImage;
    if (headerImageField && headerImageField.startsWith('blob:') && headerImageField !== logoField) {
      try {
        const headerImageWidth = 40;
        const headerImageHeight = 15;
        const headerImageX = (pageWidth - headerImageWidth) / 2; // Center the header image
        const headerImageY = currentY - 5;
        
        const base64HeaderImage = await blobUrlToBase64(headerImageField);
        if (base64HeaderImage) {
          doc.addImage(base64HeaderImage, 'PNG', headerImageX, headerImageY, headerImageWidth, headerImageHeight);
        }
      } catch (error) {
        console.warn('Could not load header image from blob URL:', error);
      }
    }
    
    // Request info on right side
    doc.setFont(baseFontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const rightAlign = pageWidth - marginRight;
    
    const prNumber = `PR #${request.id}`;
    const dateText = `Date: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`;
    
    doc.text(prNumber, rightAlign - doc.getTextWidth(prNumber), currentY + 3);
    doc.text(dateText, rightAlign - doc.getTextWidth(dateText), currentY + 8);
    
    currentY += settings.headerSubtitle ? 25 : 20;
    
    // Separator line
    doc.setDrawColor(220, 220, 220);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 8;
    
    // TOP INFO SECTION (Gray background box)
    doc.setFillColor(245, 245, 245);
    doc.rect(marginLeft, currentY, contentWidth, 16, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    // Two columns layout
    const leftColX = marginLeft + 3;
    const rightColX = marginLeft + (contentWidth / 2) + 3;
    
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
    
    // BASIC INFORMATION SECTION with admin settings
    const sectionHeaderColor = parseColor(settings.sectionHeaderColor || '#000000');
    
    // Show basic information section if enabled
    if (settings.showBasicInfo !== false) {
      doc.setFillColor(sectionHeaderColor[0], sectionHeaderColor[1], sectionHeaderColor[2]);
      doc.rect(marginLeft, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('BASIC INFORMATION', marginLeft + 2, currentY + 4);
    
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
    } // End of basic information section
    
    // VENDOR INFORMATION SECTION
    if (settings.showVendorInfo !== false && request.vendor && (request.vendor.companyName || request.vendor.name)) {
      doc.setFillColor(sectionHeaderColor[0], sectionHeaderColor[1], sectionHeaderColor[2]);
      doc.rect(marginLeft, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('VENDOR INFORMATION', marginLeft + 2, currentY + 4);
      
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
      const watermarkOpacity = settings.watermarkOpacity || 0.1;
      doc.setGState(new doc.GState({opacity: watermarkOpacity}));
      doc.setTextColor(180, 180, 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      
      // Center the watermark
      const watermarkWidth = doc.getTextWidth(settings.watermarkText);
      const watermarkX = (pageWidth - watermarkWidth * 0.7) / 2;
      const watermarkY = pageHeight / 2;
      
      doc.saveGraphicsState();
      // Rotate and place watermark text
      doc.text(settings.watermarkText, watermarkX, watermarkY);
      doc.restoreGraphicsState();
      doc.setGState(new doc.GState({opacity: 1}));
    }
    
    // ITEMS SECTION
    if (settings.showItems !== false && request.items && request.items.length > 0) {
      doc.setFillColor(sectionHeaderColor[0], sectionHeaderColor[1], sectionHeaderColor[2]);
      doc.rect(marginLeft, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ITEMS', marginLeft + 2, currentY + 4);
      
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
        theme: 'grid',
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          textColor: [40, 40, 40],
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: parseColor(settings.tableHeaderColor || '#f0f0f0'),
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
      
      const summaryX = pageWidth - marginLeft - 65;
      
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
    if (settings.showAttachments !== false && request.attachments && request.attachments.length > 0) {
      doc.setFillColor(sectionHeaderColor[0], sectionHeaderColor[1], sectionHeaderColor[2]);
      doc.rect(marginLeft, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ATTACHED DOCUMENTS', marginLeft + 2, currentY + 4);
      
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
        theme: 'grid',
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          textColor: [40, 40, 40],
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: parseColor(settings.tableHeaderColor || '#f0f0f0'),
          textColor: [40, 40, 40],
          fontStyle: 'bold',
          fontSize: 8
        }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // SIGNATURES SECTION
    if (settings.showSignatures !== false) {
      doc.setFillColor(sectionHeaderColor[0], sectionHeaderColor[1], sectionHeaderColor[2]);
      doc.rect(marginLeft, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('SIGNATURES', marginLeft + 2, currentY + 4);
    
      currentY += 10;
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('ALL RIGHTS RESERVED', marginLeft + 2, currentY);
    } // End of signatures section
    
    // FOOTER with admin settings
    const footerY = pageHeight - 12;
    
    // Apply footer color from settings
    const footerColor = parseColor(settings.footerColor || '#888888');
    doc.setFontSize(7);
    doc.setTextColor(footerColor[0], footerColor[1], footerColor[2]);
    doc.setFont('helvetica', 'normal');
    
    // Add footer image if available
    const footerImageField = settings.footerImage;
    if (footerImageField && footerImageField.startsWith('blob:')) {
      try {
        const footerImageWidth = 20;
        const footerImageHeight = 10;
        const footerImageX = pageWidth - marginRight - footerImageWidth;
        const footerImageY = footerY - 8;
        
        const base64FooterImage = await blobUrlToBase64(footerImageField);
        if (base64FooterImage) {
          doc.addImage(base64FooterImage, 'PNG', footerImageX, footerImageY, footerImageWidth, footerImageHeight);
        }
      } catch (error) {
        console.warn('Could not load footer image from blob URL:', error);
      }
    }
    
    // Use footer from admin settings or default
    const footerText = settings.footerText || 
      `Phone: ${settings.companyPhone || '+974 30488565'} | Email: ${settings.companyEmail || 'info@eeegq.com'} | Web: ${settings.companyWebsite || 'www.eeegq.com'}`;
    const footerAddress = settings.companyAddress || 'Palm Tower B 36th Floor, 3602 West Bay, Doha, Qatar';
    
    doc.text(footerText, marginLeft, footerY);
    doc.text(footerAddress, marginLeft, footerY + 3);
    
    // Page number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageText = `Page ${i} of ${pageCount}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - marginLeft - pageTextWidth, footerY + 3);
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
    
    await logPdfAuditEvent(Number(request.id), 'pdf_downloaded', auditDetails, 'admin');
    
    // Download the file
    saveAs(pdfBlob, fileName);
    console.log("Professional PDF generated successfully");
    
  } catch (error) {
    console.error("Professional PDF generation error:", error);
    throw error;
  }
}