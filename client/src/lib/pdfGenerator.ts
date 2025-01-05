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
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
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
      primaryColor: [113, 86, 158],
      secondaryColor: [240, 240, 250],
      accentColor: [25, 17, 96],
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
  if (!imageData || !mimeType) return false;

  try {
    const base64Data = imageData.includes('base64,') ? 
      imageData : 
      `data:${mimeType};base64,${imageData}`;

    const imgFormat = mimeType.split('/')[1].toUpperCase();
    if (!['PNG', 'JPEG', 'JPG'].includes(imgFormat)) return false;

    doc.addImage(base64Data, imgFormat, x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
}

function addHeader(doc: jsPDF, config: TemplateConfig, pageWidth: number): number {
  const headerHeight = 50; 

  // Add gradient background
  doc.setFillColor(...config.branding.primaryColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Add lighter gradient overlay at bottom
  const gradientHeight = headerHeight / 3;
  doc.setFillColor(...config.branding.secondaryColor);
  doc.setGState(new doc.GState({ opacity: 0.1 }));
  doc.rect(0, headerHeight - gradientHeight, pageWidth, gradientHeight, 'F');

  // Add logo if available
  if (config.branding.logo && config.showLogo) {
    addImageToPDF(
      doc,
      config.branding.logo,
      config.branding.logoMimeType || 'image/png',
      10,
      5,
      40,
      40
    );
  }

  // Add company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.companyName, 60, 30);

  return headerHeight;
}

function addFooter(doc: jsPDF, config: TemplateConfig, pageWidth: number, pageHeight: number): number {
  const footerHeight = 40;
  const footerY = pageHeight - footerHeight;

  // Add gradient background
  doc.setFillColor(...config.branding.primaryColor);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  // Add lighter gradient overlay at top
  const gradientHeight = footerHeight / 3;
  doc.setFillColor(...config.branding.secondaryColor);
  doc.setGState(new doc.GState({ opacity: 0.1 }));
  doc.rect(0, footerY, pageWidth, gradientHeight, 'F');

  // Add footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(config.branding.footerText, pageWidth / 2, pageHeight - 20, { align: 'center' });

  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 20, pageHeight - 15, { align: 'right' });

  return footerHeight;
}

export async function generateRequestPDF(request: any, templateConfig: Partial<TemplateConfig> = {}) {
  try {
    const branding = await fetchBranding();
    console.log('Using PDF config:', { branding });

    const config: TemplateConfig = {
      branding,
      layout: templateConfig.layout || 'modern',
      headerHeight: 50,
      footerHeight: 40,
      showLogo: templateConfig.showLogo ?? true,
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Add header
    const headerHeight = addHeader(doc, config, pageWidth);
    let yPos = headerHeight + 20;

    // Request Purpose & Priority Section
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3, 'F');

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');

    // Purpose Type and Sub-purpose
    doc.text("Request Purpose & Priority", margin + 10, yPos + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(`Purpose Type: ${request.purposeType || 'N/A'}`, margin + 10, yPos + 30);
    doc.text(`Sub-purpose: ${request.subPurpose?.name || 'N/A'}`, margin + contentWidth/2, yPos + 30);

    yPos += 50;

    // Basic Information Section
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, yPos, contentWidth, 50, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text("Basic Information", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Request Title: ${request.title || 'N/A'}`, margin + 10, yPos + 30);
    doc.text(`Description: ${request.description || 'N/A'}`, margin + 10, yPos + 45);

    yPos += 60;

    // Items Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Items", margin, yPos);
    yPos += 10;

    const items = (request.items || []).map((item: any) => [
      item.name || 'N/A',
      item.quantity?.toString() || '0',
      formatCurrency(item.estimatedCost || 0, request.currency),
      formatCurrency((item.quantity || 0) * (item.estimatedCost || 0), request.currency)
    ]);

    const freightAmount = request.freightAmount || 0;
    const itemsTotal = calculateTotalCost(request);
    const totalCost = itemsTotal + freightAmount;

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Quantity', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Items Total:', formatCurrency(itemsTotal, request.currency)],
        ['', '', 'Freight Amount:', formatCurrency(freightAmount, request.currency)],
        ['', '', 'Total Cost:', formatCurrency(totalCost, request.currency)]
      ],
      headStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 8
      },
      footStyles: {
        fillColor: [245, 245, 250],
        textColor: [60, 60, 60],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 8
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 6,
        textColor: [60, 60, 60]
      },
      alternateRowStyles: {
        fillColor: [250, 250, 255]
      },
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        cellWidth: 'auto',
        lineColor: [220, 220, 230],
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

function calculateTotalCost(request: any): number {
  return (request.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)),
    0
  );
}

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