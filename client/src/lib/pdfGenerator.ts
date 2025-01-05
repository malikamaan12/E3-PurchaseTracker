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
  layout?: 'modern' | 'classic' | 'bento';
  headerHeight?: number;
  footerHeight?: number;
  showLogo?: boolean;
}

function hexToRGB(hex: string): [number, number, number] {
  // Remove the hash if it exists
  hex = hex.replace(/^#/, '');

  // Parse the hex values
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Return as RGB tuple
  return [r, g, b];
}

async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Branding data received:', data);

    // Convert hex colors to RGB
    const primaryColor = hexToRGB(data.primaryColor);
    const secondaryColor = hexToRGB(data.secondaryColor);
    const accentColor = hexToRGB(data.accentColor);

    return {
      companyName: data.companyName || 'Company Name',
      primaryColor,
      secondaryColor,
      accentColor,
      footerText: data.footerText || "Confidential Document",
      logo: data.logo || null,
      logoMimeType: data.logoMimeType || null,
      headerImage: data.headerImageUrl || null,
      headerImageMimeType: data.headerImageMimeType || null,
      footerImage: data.footerImageUrl || null,
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

function addImageToPDF(doc: jsPDF, imageData: string | null, mimeType: string | null, x: number, y: number, width: number, height: number): boolean {
  if (!imageData || !mimeType) {
    return false;
  }

  try {
    const base64Data = imageData.includes('base64,') ?
      imageData :
      `data:${mimeType};base64,${imageData}`;

    const imgFormat = mimeType.split('/')[1].toUpperCase();
    if (!['PNG', 'JPEG', 'JPG'].includes(imgFormat)) {
      return false;
    }

    doc.addImage(base64Data, imgFormat, x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
}

function addHeader(doc: jsPDF, config: TemplateConfig, pageWidth: number): number {
  const headerHeight = config.headerHeight || 45; // Increased height to match reference

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

  // Add gradient effect
  const gradientHeight = headerHeight / 3;
  doc.setFillColor(...config.branding.secondaryColor.map(c => Math.min(c + 20, 255)) as [number, number, number]);
  doc.setGState(new doc.GState({ opacity: 0.1 }));
  doc.rect(0, headerHeight - gradientHeight, pageWidth, gradientHeight, 'F');

  // Add logo if available
  let logoWidth = 0;
  if (config.branding.logo && config.showLogo) {
    const logoAdded = addImageToPDF(
      doc,
      config.branding.logo,
      config.branding.logoMimeType || 'image/png',
      10,
      5,
      35,
      35
    );
    if (logoAdded) logoWidth = 45;
  }

  // Company name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.companyName, logoWidth + 10, 28);

  // Add date and request number
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const date = format(new Date(), 'PPP');
  doc.text(date, pageWidth - 15, 20, { align: 'right' });

  return headerHeight;
}

function addFooter(doc: jsPDF, config: TemplateConfig, pageWidth: number, pageHeight: number): number {
  const footerHeight = config.footerHeight || 35; // Increased height to match reference
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

  // Add gradient effect
  const gradientHeight = footerHeight / 3;
  doc.setFillColor(...config.branding.secondaryColor.map(c => Math.min(c + 20, 255)) as [number, number, number]);
  doc.setGState(new doc.GState({ opacity: 0.1 }));
  doc.rect(0, footerY, pageWidth, gradientHeight, 'F');

  // Footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(config.branding.footerText, pageWidth / 2, pageHeight - 20, { align: 'center' });

  // Page number
  doc.setFontSize(10);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 15, pageHeight - 15, { align: 'right' });

  return footerHeight;
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
      layout: templateConfig.layout || 'modern',
      headerHeight: templateConfig.headerHeight || 45,
      footerHeight: templateConfig.footerHeight || 35,
      showLogo: templateConfig.showLogo ?? true,
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Add header
    const headerHeight = addHeader(doc, config, pageWidth);
    let yPos = headerHeight + margin;

    // Request Details Section
    doc.setTextColor(...config.branding.accentColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Request Details", margin, yPos);
    yPos += 10;

    // Basic Information
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    const basicInfo = [
      [`Request Number: ${request.requestNumber || 'N/A'}`, `Status: ${request.status?.toUpperCase() || 'N/A'}`],
      [`Created Date: ${format(new Date(request.createdAt), 'PP')}`, `Priority: ${request.priority?.toUpperCase() || 'N/A'}`],
      [`Department: ${request.requester?.department || 'N/A'}`]
    ];

    basicInfo.forEach(line => {
      doc.text(line[0], margin, yPos);
      if (line[1]) {
        doc.text(line[1], margin + contentWidth/2, yPos);
      }
      yPos += 8;
    });

    // Title and Description
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...config.branding.primaryColor);
    doc.text("Title", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(request.title || 'N/A', margin, yPos);
    yPos += 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...config.branding.primaryColor);
    doc.text("Description", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const description = doc.splitTextToSize(request.description || 'No description provided', contentWidth);
    doc.text(description, margin, yPos);
    yPos += description.length * 7 + 15;

    // Items Table
    const items = (request.items || []).map((item: any) => [
      item.name || 'N/A',
      item.quantity?.toString() || '0',
      formatCurrency(item.estimatedCost || 0, request.currency),
      formatCurrency((item.quantity || 0) * (item.estimatedCost || 0), request.currency)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Quantity', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Total:', formatCurrency(calculateTotalCost(request), request.currency)]
      ],
      headStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 8
      },
      footStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 8
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 6
      },
      alternateRowStyles: {
        fillColor: [...config.branding.secondaryColor.map(c => Math.min(c + 5, 255))] as [number, number, number]
      },
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        cellWidth: 'auto',
        fontSize: 10,
        textColor: [60, 60, 60],
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      }
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

function calculateTotalCost(request: any): number {
  return (request.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)),
    0
  );
}