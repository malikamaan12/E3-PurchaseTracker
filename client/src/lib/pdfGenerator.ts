import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      companyName: data.companyName || "Events & Entertainment Enterprises",
      primaryColor: [113, 86, 158], // #71569E
      secondaryColor: [240, 240, 250], // #F0F0FA
      accentColor: [25, 17, 96], // #191160
      footerText: data.footerText || "Designed with ❤️ by E3",
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
      companyName: "Events & Entertainment Enterprises",
      primaryColor: [113, 86, 158],
      secondaryColor: [240, 240, 250],
      accentColor: [25, 17, 96],
      footerText: "Designed with ❤️ by E3",
      logo: null,
      logoMimeType: null,
      headerImage: null,
      headerImageMimeType: null,
      footerImage: null,
      footerImageMimeType: null,
    };
  }
}

function addGradientBackground(doc: jsPDF, y: number, height: number, color: [number, number, number]) {
  const pageWidth = doc.internal.pageSize.width;
  const steps = 20;
  const stepHeight = height / steps;

  for (let i = 0; i < steps; i++) {
    const opacity = Math.max(0.1, 0.8 - (i * 0.035));
    doc.saveGraphicsState();
    doc.setFillColor(...color);
    doc.setGState(new doc.GState({ opacity }));
    doc.rect(0, y + (i * stepHeight), pageWidth, stepHeight, 'F');
    doc.restoreGraphicsState();
  }
}

function addHeader(doc: jsPDF, config: TemplateConfig): number {
  const headerHeight = 85;

  // Add gradient background
  addGradientBackground(doc, 0, headerHeight, config.branding.primaryColor);

  // Add company name
  doc.saveGraphicsState();
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.companyName, 80, 45);
  doc.restoreGraphicsState();

  // Add logo if available
  if (config.branding.logo && config.showLogo) {
    try {
      doc.addImage(config.branding.logo, 'PNG', 25, 20, 45, 45);
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  return headerHeight;
}

function addFooter(doc: jsPDF): number {
  const pageHeight = doc.internal.pageSize.height;
  const footerHeight = 45;
  const footerY = pageHeight - footerHeight;

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
    doc.text(item.text, 25, item.y);
  });

  // Right column - Address
  const addressInfo = [
    { text: "Floor No. GF15-22715", y: footerY + 15 },
    { text: "Twar Tower 2, B-Mall, Al Taawon Street,", y: footerY + 25 },
    { text: "West Bay, P.O.Box 58221, Doha", y: footerY + 35 }
  ];

  addressInfo.forEach(item => {
    const textWidth = doc.getTextWidth(item.text);
    doc.text(item.text, doc.internal.pageSize.width - 25 - textWidth, item.y);
  });

  doc.restoreGraphicsState();
  return footerHeight;
}

export async function generateRequestPDF(request: any, templateConfig: Partial<TemplateConfig> = {}) {
  try {
    const branding = await fetchBranding();
    const config: TemplateConfig = {
      branding,
      layout: templateConfig.layout || 'modern',
      headerHeight: 85,
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
    let yPos = headerHeight + 10;

    // Request Purpose & Priority Section
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 45, 2, 2, 'F');

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("Request Purpose & Priority", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Purpose Type: ${request.purposeType || 'N/A'}`, margin + 10, yPos + 30);
    doc.text(`Sub-purpose: ${request.subPurpose?.name || 'N/A'}`, margin + contentWidth/2, yPos + 30);

    yPos += 55;

    // Basic Information Section
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 50, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text("Basic Information", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Request Title: ${request.title || 'N/A'}`, margin + 10, yPos + 30);

    const descriptionLines = doc.splitTextToSize(
      `Description: ${request.description || 'N/A'}`,
      contentWidth - 20
    );
    descriptionLines.slice(0, 2).forEach((line: string, index: number) => {
      doc.text(line, margin + 10, yPos + 30 + ((index + 1) * 10));
    });

    yPos += 60;

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
        cellPadding: 8,
      },
      footStyles: {
        fillColor: [248, 249, 250],
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
    addFooter(doc);

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