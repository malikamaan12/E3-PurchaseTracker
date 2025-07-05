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

// Helper function to convert blob URL to base64 synchronously with image optimization
async function blobUrlToBase64(blobUrl: string): Promise<string | null> {
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Empty blob received');
    }
    
    // Optimize image size if it's too large (>2MB)
    if (blob.size > 2 * 1024 * 1024) {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          // Calculate optimal dimensions (max 800x600)
          const maxWidth = 800;
          const maxHeight = 600;
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        
        img.onerror = () => reject(new Error('Image load error'));
        img.src = URL.createObjectURL(blob);
      });
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:')) {
          resolve(result);
        } else {
          reject(new Error('Invalid base64 data'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
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
  
  // Track PDF generation progress
  let progressStep = 'initializing';
  
  try {
    progressStep = 'creating_document';
    console.log('PDF Progress: Creating document');
    
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
    
    // HEADER SECTION - matching reference design
    progressStep = 'creating_header';
    console.log('PDF Progress: Creating header section');
    
    // Top colored header band (purple-teal gradient area)
    const headerBandHeight = 12;
    const gradientColors = [
      [128, 90, 165], // Purple
      [64, 188, 175]  // Teal
    ];
    
    // Create gradient effect with rectangles
    const gradientSteps = 20;
    const stepWidth = contentWidth / gradientSteps;
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const r = Math.round(gradientColors[0][0] * (1 - ratio) + gradientColors[1][0] * ratio);
      const g = Math.round(gradientColors[0][1] * (1 - ratio) + gradientColors[1][1] * ratio);
      const b = Math.round(gradientColors[0][2] * (1 - ratio) + gradientColors[1][2] * ratio);
      
      doc.setFillColor(r, g, b);
      doc.rect(marginLeft + (i * stepWidth), currentY, stepWidth, headerBandHeight, 'F');
    }
    
    currentY += headerBandHeight + 8;
    
    // Company logo on the left (matching reference design position)
    progressStep = 'loading_logo';
    console.log('PDF Progress: Loading company logo');
    
    const logoField = settings.logo || settings.companyLogo || settings.headerImage;
    if (logoField && logoField.startsWith('blob:')) {
      try {
        const logoWidth = 35;
        const logoHeight = 16;
        const logoX = marginLeft;
        const logoY = currentY;
        
        const base64Logo = await blobUrlToBase64(logoField);
        if (base64Logo) {
          try {
            let imageFormat = 'PNG';
            if (base64Logo.includes('data:image/jpeg') || base64Logo.includes('data:image/jpg')) {
              imageFormat = 'JPEG';
            } else if (base64Logo.includes('data:image/png')) {
              imageFormat = 'PNG';
            }
            doc.addImage(base64Logo, imageFormat, logoX, logoY, logoWidth, logoHeight);
          } catch (imageError) {
            console.warn('Could not add logo image to PDF:', imageError);
          }
        }
      } catch (error) {
        console.warn('Could not load logo from blob URL:', error);
      }
    }
    
    // Main title "PURCHASE REQUEST" - bold and prominent
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(44, 44, 44); // Dark gray
    const titleY = currentY + 12;
    doc.text('PURCHASE REQUEST', marginLeft, titleY);
    
    // Request info on the right side (PR# and Date)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102); // Medium gray
    
    const rightInfoX = pageWidth - marginRight;
    const prNumber = `PR #${request.id}`;
    const dateText = `Date: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`;
    
    doc.text(prNumber, rightInfoX - doc.getTextWidth(prNumber), currentY + 5);
    doc.text(dateText, rightInfoX - doc.getTextWidth(dateText), currentY + 12);
    
    currentY = titleY + 15;
    
    // Top info section (gray box matching reference design)
    progressStep = 'creating_info_section';
    console.log('PDF Progress: Creating info section');
    
    // Light gray background box
    const infoBoxHeight = 20;
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, currentY, contentWidth, infoBoxHeight, 'F');
    
    // Info section content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    const leftColX = marginLeft + 5;
    const midColX = marginLeft + (contentWidth * 0.4);
    const rightColX = marginLeft + (contentWidth * 0.7);
    
    currentY += 7;
    
    // Left column - Requester and Status
    doc.text('Requester:', leftColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.requester?.username || 'N/A', leftColX + 25, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Status:', leftColX, currentY + 6);
    doc.setFont('helvetica', 'bold');
    doc.text((request.status || 'pending').toUpperCase(), leftColX + 25, currentY + 6);
    
    // Middle column - Department
    doc.setFont('helvetica', 'normal');
    doc.text('Department:', midColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.requester?.department || 'N/A', midColX + 25, currentY);
    
    // Right column - Priority
    doc.setFont('helvetica', 'normal');
    doc.text('Priority:', rightColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text((request.priority || 'LOW').toUpperCase(), rightColX + 20, currentY);
    
    currentY += 22;
    
    // BASIC INFORMATION SECTION - Black header bar matching reference design
    progressStep = 'creating_basic_info';
    console.log('PDF Progress: Creating basic information section');
    
    // Black header bar
    doc.setFillColor(44, 44, 44);
    doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BASIC INFORMATION', marginLeft + 3, currentY + 6);
    
    currentY += 12;
    
    // Content in the white area below the black header
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    const basicInfoLeftX = marginLeft + 3;
    const basicInfoRightX = marginLeft + (contentWidth * 0.55);
    
    // Title
    doc.text('Title:', basicInfoLeftX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.title || 'N/A', basicInfoLeftX + 20, currentY);
    currentY += 5;
    
    // Description
    doc.setFont('helvetica', 'normal');
    doc.text('Description:', basicInfoLeftX, currentY);
    const description = request.description || 'No description provided';
    const descLines = doc.splitTextToSize(description, contentWidth - 30);
    doc.text(descLines, basicInfoLeftX + 25, currentY);
    currentY += Math.max(5, descLines.length * 4);
    
    // Purpose Type and Sub-purpose on same line
    doc.text('Purpose Type:', basicInfoLeftX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.purposeType || 'N/A', basicInfoLeftX + 28, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Sub-purpose:', basicInfoRightX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.subPurpose?.name || 'N/A', basicInfoRightX + 25, currentY);
    currentY += 5;
    
    // Contact Info
    doc.setFont('helvetica', 'normal');
    doc.text('Contact Info:', basicInfoLeftX, currentY);
    doc.text(`Email: ${request.requester?.email || 'N/A'}`, basicInfoLeftX + 28, currentY);
    
    currentY += 15;
    
    // Define section header color from admin settings
    const sectionHeaderColor = parseColor(settings.sectionHeaderColor || '#2c2c2c');
    
    // VENDOR INFORMATION SECTION - Black header bar matching reference design
    if (request.vendor && (request.vendor.companyName || request.vendor.name)) {
      progressStep = 'creating_vendor_info';
      console.log('PDF Progress: Creating vendor information section');
      
      // Black header bar
      doc.setFillColor(44, 44, 44);
      doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('VENDOR INFORMATION', marginLeft + 3, currentY + 6);
      
      currentY += 12;
      
      // Content in the white area below the black header
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const vendorLeftX = marginLeft + 3;
      const vendorRightX = marginLeft + (contentWidth * 0.55);
      
      const vendorName = request.vendor.companyName || request.vendor.name;
      doc.text('Vendor Name:', vendorLeftX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(vendorName, vendorLeftX + 28, currentY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Contact Person:', vendorRightX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(request.vendor.contactPerson || 'N/A', vendorRightX + 30, currentY);
      currentY += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text('Email:', vendorLeftX, currentY);
      doc.text(request.vendor.email || 'N/A', vendorLeftX + 15, currentY);
      
      doc.text('Phone:', vendorRightX, currentY);
      doc.text(request.vendor.contactNumber || 'N/A', vendorRightX + 18, currentY);
      
      currentY += 15;
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
          try {
            // Detect image format from base64 data
            let imageFormat = 'PNG';
            if (base64FooterImage.includes('data:image/jpeg') || base64FooterImage.includes('data:image/jpg')) {
              imageFormat = 'JPEG';
            } else if (base64FooterImage.includes('data:image/png')) {
              imageFormat = 'PNG';
            }
            doc.addImage(base64FooterImage, imageFormat, footerImageX, footerImageY, footerImageWidth, footerImageHeight);
          } catch (imageError) {
            console.warn('Could not add footer image to PDF:', imageError);
          }
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
    progressStep = 'saving_pdf';
    console.log('PDF Progress: Saving PDF');
    saveAs(pdfBlob, fileName);
    console.log("Professional PDF generated successfully");
    
  } catch (error) {
    console.error(`Professional PDF generation error at step '${progressStep}':`, error);
    
    // Provide more user-friendly error handling
    if (progressStep === 'loading_logo') {
      throw new Error('Logo image loading failed. Please check your admin panel logo settings or try generating PDF without custom logo.');
    } else if (progressStep.includes('image')) {
      throw new Error('Image loading failed. Please check your admin panel image settings or try generating PDF without custom images.');
    }
    
    throw error;
  }
}