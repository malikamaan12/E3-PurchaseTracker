import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type CompanyBranding } from '@db/schema';
import { format } from 'date-fns';

// Interfaces
interface TemplateConfig {
  branding: {
    name: string;
    primaryColor: [number, number, number];
    secondaryColor: [number, number, number];
    accentColor: [number, number, number];
    headerStyle: string;
    logo: string | null;
    logoMimeType: string | null;
    headerImage: string | null;
    headerImageMimeType: string | null;
    footerImage: string | null;
    footerImageMimeType: string | null;
    footerText: string;
  };
  layout: 'modern' | 'classic' | 'bento';
  headerHeight: number;
  footerHeight: number;
  showLogo: boolean;
}

// Enhanced branding fetch
async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data: CompanyBranding = await response.json();
    if (!data) {
      throw new Error('No branding data received');
    }

    return {
      name: data.company_name || 'Company Name',
      primaryColor: hexToRGB(data.primary_color || '#212121'),
      secondaryColor: hexToRGB(data.secondary_color || '#f5f5f5'),
      accentColor: hexToRGB(data.accent_color || '#0070c9'),
      headerStyle: data.header_style || 'modern',
      logo: data.logo,
      logoMimeType: data.logo_mime_type,
      headerImage: data.header_image_url,
      headerImageMimeType: data.header_image_mime_type,
      footerImage: data.footer_image_url,
      footerImageMimeType: data.footer_image_mime_type,
      footerText: data.footer_text || "Confidential Document"
    };
  } catch (error) {
    console.error('Error fetching branding:', error);
    return {
      name: "Company Name",
      primaryColor: [33, 33, 33],
      secondaryColor: [245, 245, 245],
      accentColor: [0, 112, 201],
      headerStyle: "modern",
      logo: null,
      logoMimeType: null,
      headerImage: null,
      headerImageMimeType: null,
      footerImage: null,
      footerImageMimeType: null,
      footerText: "Confidential Document"
    };
  }
}

function hexToRGB(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [33, 33, 33];
}

function addImageToPDF(doc: jsPDF, imageData: string | null, mimeType: string | null, x: number, y: number, width: number, height: number): boolean {
  if (!imageData || !mimeType) {
    return false;
  }

  try {
    const base64Data = imageData.includes('base64,') ?
      imageData.split('base64,')[1] :
      imageData;

    const imgFormat = mimeType.split('/')[1].toUpperCase();
    if (!['PNG', 'JPEG', 'JPG'].includes(imgFormat)) {
      return false;
    }

    doc.addImage(`data:${mimeType};base64,${base64Data}`, imgFormat, x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
}

function addHeader(doc: jsPDF, config: TemplateConfig, pageWidth: number): number {
  const headerHeight = 35;

  // Try header image first
  if (config.branding.headerImage) {
    const added = addImageToPDF(
      doc,
      config.branding.headerImage,
      config.branding.headerImageMimeType || 'image/png',
      0,
      0,
      pageWidth,
      headerHeight
    );
    if (added) return headerHeight;
  }

  // Fallback to styled header
  doc.setFillColor(...config.branding.primaryColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Add logo if available
  let logoWidth = 0;
  if (config.branding.logo) {
    const logoAdded = addImageToPDF(
      doc,
      config.branding.logo,
      config.branding.logoMimeType || 'image/png',
      10,
      5,
      25,
      25
    );
    if (logoAdded) logoWidth = 35;
  }

  // Company name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.name, logoWidth + 10, 20);

  // Add date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const date = format(new Date(), 'PPP');
  doc.text(date, pageWidth - 15, 15, { align: 'right' });

  return headerHeight;
}

function addFooter(doc: jsPDF, config: TemplateConfig, pageWidth: number, pageHeight: number): number {
  const footerHeight = 25;
  const footerY = pageHeight - footerHeight;

  // Try footer image first
  if (config.branding.footerImage) {
    const added = addImageToPDF(
      doc,
      config.branding.footerImage,
      config.branding.footerImageMimeType || 'image/png',
      0,
      footerY,
      pageWidth,
      footerHeight
    );
    if (added) return footerHeight;
  }

  // Fallback to styled footer
  doc.setFillColor(...config.branding.primaryColor);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  // Footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(config.branding.footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Page number
  const pageNumber = `Page ${doc.internal.getNumberOfPages()}`;
  doc.text(pageNumber, pageWidth - 15, pageHeight - 10, { align: 'right' });

  return footerHeight;
}

function addBentoTile(doc: jsPDF, title: string, content: string[], x: number, y: number, width: number, height: number, config: TemplateConfig) {
  // Compact tile with smaller padding
  doc.setFillColor(...config.branding.secondaryColor);
  doc.roundedRect(x, y, width, height, 2, 2, 'F');

  // Compact header
  doc.setFillColor(...config.branding.primaryColor);
  doc.roundedRect(x, y, width, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), x + 5, y + 10);

  // Compact content
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  content.forEach((text, index) => {
    if (text) {
      doc.text(text, x + 5, y + 22 + (index * 10));
    }
  });
}

export async function generateRequestPDF(request: any, templateConfig: Partial<TemplateConfig> = {}) {
  try {
    const branding = await fetchBranding();
    const config: TemplateConfig = {
      branding,
      layout: 'bento',
      headerHeight: 35, // Reduced header height
      footerHeight: 25, // Reduced footer height
      showLogo: true,
      ...templateConfig
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10; // Reduced margin
    const contentWidth = pageWidth - (margin * 2);
    const columnWidth = (contentWidth - margin) / 2;
    const tileHeight = 50; // Reduced tile height

    // Add header
    const headerHeight = addHeader(doc, config, pageWidth);
    let yPos = headerHeight + 5; // Reduced spacing

    // Title and Description Tile (full width, compact)
    const titleInfo = [
      `Title: ${request.title || 'N/A'}`,
      `Description: ${request.description || 'N/A'}`
    ];
    addBentoTile(doc, 'Request Details', titleInfo, margin, yPos, contentWidth, 35, config);

    // Request Info and Vendor Info (side by side)
    yPos += 40;
    const requestInfo = [
      `Request #: ${request.requestNumber}`,
      `Status: ${request.status.toUpperCase()}`,
      `Priority: ${request.priority.toUpperCase()}`
    ];
    addBentoTile(doc, 'Request Info', requestInfo, margin, yPos, columnWidth, 45, config);

    const vendorInfo = [
      `Vendor: ${request.vendor?.name || 'N/A'}`,
      `Contact: ${request.vendor?.contactPerson || 'N/A'}`,
      `Email: ${request.vendor?.email || 'N/A'}`
    ];
    addBentoTile(doc, 'Vendor Details', vendorInfo, margin + columnWidth + margin/2, yPos, columnWidth, 45, config);

    // Purpose Information (full width, compact)
    yPos += 50;
    const purposeInfo = [
      `Purpose: ${request.purposeType.replace('_', ' ').toUpperCase()}`,
      `Sub Purpose: ${request.subPurpose?.name || 'N/A'}`,
      `Details: ${request.purposeDetails || 'N/A'}`
    ];
    addBentoTile(doc, 'Purpose Information', purposeInfo, margin, yPos, contentWidth, 45, config);

    // Items Table with optimized spacing
    yPos += 50;
    const items = (request.items || []).map((item: any) => [
      item.name || 'N/A',
      item.description || 'N/A',
      item.quantity?.toString() || '0',
      formatCurrency(item.estimatedCost || 0, request.currency),
      formatCurrency((item.quantity || 0) * (item.estimatedCost || 0), request.currency)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
        ['', '', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
      ],
      headStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2
      },
      footStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 }
      },
      margin: { left: margin, right: margin }
    });

    // Approvals in compact table
    if (request.approvals?.length > 0) {
      yPos = (doc as any).lastAutoTable.finalY + 5;
      const approvals = request.approvals.map((approval: any) => [
        approval.department || 'N/A',
        approval.approver?.username || 'N/A',
        approval.status.toUpperCase(),
        format(new Date(approval.createdAt || new Date()), 'PP'),
        approval.comments || '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Dept', 'Approver', 'Status', 'Date', 'Comments']],
        body: approvals,
        headStyles: {
          fillColor: config.branding.primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });
    }

    // Attachments in compact list
    if (request.attachments?.length > 0) {
      yPos = (doc as any).lastAutoTable.finalY + 5;
      const attachments = request.attachments.map((attachment: any) => [
        attachment.fileName || 'N/A',
        attachment.fileType || 'N/A',
        formatFileSize(attachment.fileSize || 0),
        format(new Date(attachment.uploadedAt || new Date()), 'PP')
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['File Name', 'Type', 'Size', 'Date']],
        body: attachments,
        headStyles: {
          fillColor: config.branding.primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2
        },
        margin: { left: margin, right: margin }
      });
    }

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, config, pageWidth, pageHeight);
    }

    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

// Helper functions
function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `${currency} ${amount}`;
  }
}

function calculateItemsTotal(request: any): number {
  return (request.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)),
    0
  );
}

function calculateTotalCost(request: any): number {
  return calculateItemsTotal(request) + Number(request.freightAmount || 0);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}