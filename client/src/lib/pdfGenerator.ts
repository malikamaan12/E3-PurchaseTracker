import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// Interfaces
interface TemplateConfig {
  branding: {
    companyName: string;
    primaryColor: [number, number, number];
    secondaryColor: [number, number, number];
    accentColor: [number, number, number];
    footerText: string;
    logo: string | null;
    logoMimeType: string | null;
    headerImage: string | null;
    headerImageMimeType: string | null;
    footerImage: string | null;
    footerImageMimeType: string | null;
  };
  layout: 'modern' | 'classic' | 'bento';
  headerHeight: number;
  footerHeight: number;
  showLogo: boolean;
}

async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Branding data received:', data);

    return {
      companyName: data.companyName || 'Company Name',
      primaryColor: hexToRGB(data.primaryColor || '#71569E'),
      secondaryColor: hexToRGB(data.secondaryColor || '#F0F0FA'),
      accentColor: hexToRGB(data.accentColor || '#191160'),
      footerText: data.footerText || "Confidential Document",
      logo: data.logo || null,
      logoMimeType: data.logoMimeType || null,
      headerImage: data.headerImage || null,
      headerImageMimeType: data.headerImageMimeType || null,
      footerImage: data.footerImage || null,
      footerImageMimeType: data.footerImageMimeType || null,
    };
  } catch (error) {
    console.error('Error fetching branding:', error);
    return {
      companyName: "Company Name",
      primaryColor: [113, 86, 158], // #71569E
      secondaryColor: [240, 240, 250], // #F0F0FA
      accentColor: [25, 17, 96], // #191160
      footerText: "Confidential Document",
      logo: null,
      logoMimeType: null,
      headerImage: null,
      headerImageMimeType: null,
      footerImage: null,
      footerImageMimeType: null,
    };
  }
}

function hexToRGB(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [113, 86, 158]; // Default to #71569E if invalid
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
  const headerHeight = config.headerHeight;

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
  if (config.branding.logo && config.showLogo) {
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
  doc.text(config.branding.companyName, logoWidth + 10, 20);

  // Add date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const date = format(new Date(), 'PPP');
  doc.text(date, pageWidth - 15, 15, { align: 'right' });

  return headerHeight;
}

function addFooter(doc: jsPDF, config: TemplateConfig, pageWidth: number, pageHeight: number): number {
  const footerHeight = config.footerHeight;
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
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 15, pageHeight - 10, { align: 'right' });

  return footerHeight;
}

function addBentoTile(doc: jsPDF, title: string, content: string[], x: number, y: number, width: number, height: number, config: TemplateConfig) {
  // Background with secondary color
  doc.setFillColor(...config.branding.secondaryColor);
  doc.roundedRect(x, y, width, height, 2, 2, 'F');

  // Header with primary color
  doc.setFillColor(...config.branding.primaryColor);
  doc.roundedRect(x, y, width, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), x + 5, y + 10);

  // Content with accent color for text
  doc.setTextColor(...config.branding.accentColor);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  let contentY = y + 22;

  content.forEach((text) => {
    if (text) {
      const maxWidth = width - 10;
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        doc.text(line, x + 5, contentY);
        contentY += 10;
      });
    }
  });
}

export async function generateRequestPDF(request: any, templateConfig: Partial<TemplateConfig> = {}) {
  try {
    console.log('Starting PDF generation for request:', {
      id: request.id,
      status: request.status,
      items: request.items?.length
    });

    const branding = await fetchBranding();
    console.log('Using PDF config:', { branding });

    const config: TemplateConfig = {
      branding,
      layout: 'bento',
      headerHeight: 35,
      footerHeight: 25,
      showLogo: true,
      ...templateConfig
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    const columnWidth = (contentWidth - margin) / 2;

    // Add header
    const headerHeight = addHeader(doc, config, pageWidth);
    console.log('Header applied at height:', headerHeight);
    let yPos = headerHeight + 5;

    // Title and Description
    const titleInfo = [
      `Title: ${request.title || 'N/A'}`,
      `Description: ${request.description || 'N/A'}`
    ];
    addBentoTile(doc, 'Request Details', titleInfo, margin, yPos, contentWidth, 45, config);

    // Request Info and Vendor Info (side by side)
    yPos += 50;
    const requestInfo = [
      `Request #: ${request.requestNumber || 'N/A'}`,
      `Status: ${(request.status || 'N/A').toUpperCase()}`,
      `Priority: ${(request.priority || 'N/A').toUpperCase()}`
    ];
    addBentoTile(doc, 'Request Info', requestInfo, margin, yPos, columnWidth, 45, config);

    const vendor = request.vendor || {};
    const vendorInfo = [
      `Name: ${vendor.name || vendor.vendorName || 'N/A'}`,
      `Category: ${vendor.category || vendor.vendorCategory || 'N/A'}`,
      `Contact: ${vendor.contactPerson || vendor.contact || 'N/A'}`,
      `Email: ${vendor.email || vendor.contactEmail || 'N/A'}`
    ];
    addBentoTile(doc, 'Vendor Details', vendorInfo, margin + columnWidth + margin/2, yPos, columnWidth, 45, config);

    // Items Table
    yPos += 50;
    const items = (request.items || []).map((item: any) => [
      item.name || 'N/A',
      item.description || 'N/A',
      item.quantity?.toString() || '0',
      formatCurrency(item.estimatedCost || 0, request.currency),
      formatCurrency((item.quantity || 0) * (item.estimatedCost || 0), request.currency)
    ]);

    console.log('Processing items for table:', items);

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
        cellPadding: 2,
        textColor: config.branding.accentColor
      },
      footStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2
      },
      theme: 'plain',
      margin: { left: margin, right: margin }
    });

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, config, pageWidth, pageHeight);
    }

    console.log('PDF generation completed successfully');
    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

// Helper functions
function formatCurrency(amount: number, currency: string = 'QAR'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'QAR',
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
  return calculateItemsTotal(request);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}