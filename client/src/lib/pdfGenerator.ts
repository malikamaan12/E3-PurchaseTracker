import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanyBranding, HeaderConfig, FooterConfig } from '@db/schema';

interface DefaultConfig {
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
}

const defaultHeaderConfig: HeaderConfig = {
  style: "modern",
  textAlignment: "left",
  showLogo: true,
  showDate: true,
  showPageNumber: true,
  customText: "",
  fontSize: 12
};

const defaultFooterConfig: FooterConfig = {
  showLogo: false,
  textAlignment: "center",
  showPageNumber: true,
  showCopyright: true,
  customText: "",
  fontSize: 10
};

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

async function fetchBranding(): Promise<CompanyBranding> {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Branding data received:', data);
    return data;
  } catch (error) {
    console.error('Error fetching branding:', error);
    throw error;
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
    const opacity = Math.max(0.1, 0.7 - (i * 0.025));
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

function addHeader(doc: jsPDF, branding: CompanyBranding): number {
  const pageWidth = doc.internal.pageSize.width;
  const headerHeight = 70;
  const margin = 25;
  const headerConfig = branding.headerConfig || defaultHeaderConfig;

  // Add gradient header using branding primary color
  addGradientHeader(doc, branding.primaryColor);

  // Add header image if available
  if (branding.headerImage) {
    addImage(
      doc,
      branding.headerImage,
      branding.headerImageMimeType || null,
      0,
      0,
      pageWidth,
      headerHeight
    );
  }

  // Add company name with proper alignment
  doc.saveGraphicsState();
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(headerConfig.fontSize);
  doc.setFont(branding.fontFamily || 'helvetica', 'bold');

  const text = branding.companyName;
  const textWidth = doc.getTextWidth(text);
  let x = margin;

  if (headerConfig.textAlignment === 'center') {
    x = (pageWidth - textWidth) / 2;
  } else if (headerConfig.textAlignment === 'right') {
    x = pageWidth - margin - textWidth;
  }

  doc.text(text, x, 40);
  doc.restoreGraphicsState();

  // Add logo if configured
  if (headerConfig.showLogo && branding.logo) {
    addImage(
      doc,
      branding.logo,
      branding.logoMimeType || null,
      25,
      15,
      45,
      45
    );
  }

  // Add date if configured
  if (headerConfig.showDate) {
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    const date = new Date().toLocaleDateString();
    doc.text(date, pageWidth - margin - doc.getTextWidth(date), 25);
  }

  // Add custom text if available
  if (headerConfig.customText) {
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(headerConfig.customText, margin, headerHeight - 10);
  }

  return headerHeight;
}

function addFooter(doc: jsPDF, branding: CompanyBranding): number {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const footerHeight = 45;
  const footerY = pageHeight - footerHeight;
  const margin = 25;
  const footerConfig = branding.footerConfig || defaultFooterConfig;

  // Add footer image if available
  if (branding.footerImage) {
    addImage(
      doc,
      branding.footerImage,
      branding.footerImageMimeType || null,
      0,
      footerY,
      pageWidth,
      footerHeight
    );
  }

  doc.saveGraphicsState();
  doc.setFontSize(footerConfig.fontSize);
  doc.setTextColor(80, 80, 80);
  doc.setFont(branding.fontFamily || 'helvetica', 'normal');

  // Add footer content based on alignment
  const footerText = footerConfig.customText || branding.companyName;
  const textWidth = doc.getTextWidth(footerText);
  let x = margin;

  if (footerConfig.textAlignment === 'center') {
    x = (pageWidth - textWidth) / 2;
  } else if (footerConfig.textAlignment === 'right') {
    x = pageWidth - margin - textWidth;
  }

  doc.text(footerText, x, footerY + 25);

  // Add copyright if configured
  if (footerConfig.showCopyright) {
    const copyright = `© ${new Date().getFullYear()} ${branding.companyName}`;
    const copyrightWidth = doc.getTextWidth(copyright);
    doc.text(copyright, (pageWidth - copyrightWidth) / 2, footerY + 35);
  }

  // Add page number if configured
  if (footerConfig.showPageNumber) {
    const pageInfo = `Page ${doc.getCurrentPageInfo().pageNumber}`;
    const pageInfoWidth = doc.getTextWidth(pageInfo);
    doc.text(pageInfo, pageWidth - margin - pageInfoWidth, footerY + 35);
  }

  doc.restoreGraphicsState();
  return footerHeight;
}

export async function generateRequestPDF(request: any) {
  try {
    const branding = await fetchBranding();
    console.log('Using PDF config:', { branding });

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 25;
    const contentWidth = pageWidth - (2 * margin);

    // Add header and footer
    const headerHeight = addHeader(doc, branding);
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
    addFooter(doc, branding);
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