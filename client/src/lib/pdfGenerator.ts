import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TemplateConfig {
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    footerText: string;
    logo: string | null;
    logoMimeType: string | null;
    headerImage: string | null;
    headerImageMimeType: string | null;
    footerImage: string | null;
    footerImageMimeType: string | null;
    headerStyle: 'modern' | 'classic' | 'minimal';
  };
  layout?: 'modern' | 'classic' | 'bento';
  headerHeight?: number;
  footerHeight?: number;
  showLogo?: boolean;
}

// Helper function to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [113, 86, 158];
  try {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : defaultColor;
  } catch (error) {
    console.error('Error converting hex to RGB:', error);
    return defaultColor;
  }
}

async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      companyName: data.companyName || "Events & Entertainment Enterprises",
      primaryColor: data.primaryColor || "#71569E",
      secondaryColor: data.secondaryColor || "#F0F0FA",
      accentColor: data.accentColor || "#191160",
      footerText: data.footerText || "Designed with ❤️ by E3",
      logo: data.logo || null,
      logoMimeType: data.logoMimeType || null,
      headerImage: data.headerImage || null,
      headerImageMimeType: data.headerImageMimeType || null,
      footerImage: data.footerImage || null,
      footerImageMimeType: data.footerImageMimeType || null,
      headerStyle: data.headerStyle || "modern"
    };
  } catch (error) {
    console.error('Error fetching branding:', error);
    return {
      companyName: "Events & Entertainment Enterprises",
      primaryColor: "#71569E",
      secondaryColor: "#F0F0FA",
      accentColor: "#191160",
      footerText: "Designed with ❤️ by E3",
      logo: null,
      logoMimeType: null,
      headerImage: null,
      headerImageMimeType: null,
      footerImage: null,
      footerImageMimeType: null,
      headerStyle: "modern"
    };
  }
}

function addGradientHeader(doc: jsPDF, color: string) {
  const pageWidth = doc.internal.pageSize.width;
  const headerHeight = 70;
  const rgbColor = hexToRgb(color);

  // Create a softer gradient effect
  const steps = 25;
  const stepHeight = headerHeight / steps;

  for (let i = 0; i < steps; i++) {
    const opacity = Math.max(0.1, 0.7 - (i * 0.025)); // Softer fade
    doc.saveGraphicsState();
    doc.setFillColor(...rgbColor);
    doc.setGState(new doc.GState({ opacity }));
    doc.rect(0, i * stepHeight, pageWidth, stepHeight, 'F');
    doc.restoreGraphicsState();
  }
}

function addImage(doc: jsPDF, imageData: string | null, mimeType: string | null, x: number, y: number, width: number, height: number): void {
  if (!imageData || !mimeType) return;

  try {
    const format = mimeType.split('/')[1].toUpperCase();
    if (!['PNG', 'JPEG', 'JPG'].includes(format)) return;

    const base64Data = imageData.includes('base64,') ? 
      imageData.split('base64,')[1] : 
      imageData;

    doc.addImage(base64Data, format, x, y, width, height);
  } catch (error) {
    console.error('Error adding image:', error);
  }
}

function addHeader(doc: jsPDF, config: TemplateConfig): number {
  const headerHeight = 70;

  // Add gradient header using branding primary color
  addGradientHeader(doc, config.branding.primaryColor);

  // Add company name
  doc.saveGraphicsState();
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.companyName, 80, 40);
  doc.restoreGraphicsState();

  // Add logo if available
  if (config.branding.logo && config.showLogo) {
    addImage(doc, config.branding.logo, config.branding.logoMimeType, 25, 15, 45, 45);
  }

  // Add header image if available
  if (config.branding.headerImage) {
    addImage(doc, config.branding.headerImage, config.branding.headerImageMimeType, 0, 0, doc.internal.pageSize.width, headerHeight);
  }

  return headerHeight;
}

function addFooter(doc: jsPDF, config: TemplateConfig): number {
  const pageHeight = doc.internal.pageSize.height;
  const footerHeight = 45;
  const footerY = pageHeight - footerHeight;
  const margin = 25;

  // Add footer image if available
  if (config.branding.footerImage) {
    addImage(
      doc, 
      config.branding.footerImage, 
      config.branding.footerImageMimeType,
      0,
      footerY,
      doc.internal.pageSize.width,
      footerHeight
    );
  }

  doc.saveGraphicsState();
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  // Left column - Contact info
  const contactInfo = [
    { text: "+974 44659290 / 33259617", y: footerY + 15 },
    { text: "info@e3qe.com", y: footerY + 25 },
    { text: "www.e3qe.com", y: footerY + 35 }
  ];

  contactInfo.forEach(item => {
    doc.text(item.text, margin, item.y);
  });

  // Right column - Address
  const addressInfo = [
    { text: "Floor No. GF15-22715", y: footerY + 15 },
    { text: "Twar Tower 2, B-Mall, Al Taawon Street,", y: footerY + 25 },
    { text: "West Bay, P.O.Box 58221, Doha", y: footerY + 35 }
  ];

  addressInfo.forEach(item => {
    const textWidth = doc.getTextWidth(item.text);
    doc.text(item.text, doc.internal.pageSize.width - margin - textWidth, item.y);
  });

  // Add custom footer text if available
  if (config.branding.footerText) {
    const footerText = config.branding.footerText;
    const textWidth = doc.getTextWidth(footerText);
    doc.text(footerText, (doc.internal.pageSize.width - textWidth) / 2, footerY + 25);
  }

  doc.restoreGraphicsState();
  return footerHeight;
}

export async function generateRequestPDF(request: any, templateConfig: Partial<TemplateConfig> = {}) {
  try {
    const branding = await fetchBranding();
    const config: TemplateConfig = {
      branding,
      layout: templateConfig.layout || 'modern',
      headerHeight: 70,
      footerHeight: 45,
      showLogo: templateConfig.showLogo ?? true,
    };

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 25;
    const contentWidth = pageWidth - (2 * margin);

    // Add header
    const headerHeight = addHeader(doc, config);
    let yPos = headerHeight + 15;

    // Request Purpose & Priority Section
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 35, 2, 2, 'F');

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("Request Purpose & Priority", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Purpose Type: ${request.purposeType || 'N/A'}`, margin + 10, yPos + 25);
    doc.text(`Sub-purpose: ${request.subPurpose?.name || 'N/A'}`, margin + contentWidth/2, yPos + 25);

    yPos += 45;

    // Basic Information Section
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 40, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text("Basic Information", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Request Title: ${request.title || 'N/A'}`, margin + 10, yPos + 25);

    const descriptionLines = doc.splitTextToSize(
      `Description: ${request.description || 'N/A'}`,
      contentWidth - 20
    );
    descriptionLines.slice(0, 2).forEach((line: string, index: number) => {
      doc.text(line, margin + 10, yPos + 25 + ((index + 1) * 10));
    });

    yPos += 50;

    // Items Section
    doc.setFont('helvetica', 'bold');
    doc.text("Items", margin, yPos + 10);

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
      startY: yPos + 20,
      head: [['Item', 'Quantity', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Items Total:', formatCurrency(itemsTotal, request.currency)],
        ['', '', 'Freight Amount:', formatCurrency(freightAmount, request.currency)],
        ['', '', 'Total Cost:', formatCurrency(totalCost, request.currency)]
      ],
      headStyles: {
        fillColor: [248, 249, 250],
        textColor: [60, 60, 60],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      footStyles: {
        fillColor: [248, 249, 250],
        textColor: [60, 60, 60],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 6
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 5,
        textColor: [60, 60, 60]
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      },
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        cellWidth: 'auto',
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
        font: 'helvetica',
        halign: 'left'
      }
    });

    // Add footer
    addFooter(doc, config);

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