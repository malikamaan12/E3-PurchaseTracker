import { jsPDF } from 'jspdf';
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

interface VendorDetails {
  companyName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  category: string;
}

async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    const response = await fetch('/api/branding/current');
    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      name: data.company_name,
      primaryColor: hexToRGB(data.primary_color),
      secondaryColor: hexToRGB(data.secondary_color),
      accentColor: hexToRGB(data.accent_color),
      headerStyle: data.header_style,
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
    // Fallback branding
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
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#212121');
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
    doc.addImage(imageData, mimeType.split('/')[1].toUpperCase(), x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
}

function addHeader(doc: jsPDF, config: TemplateConfig, pageWidth: number): number {
  const headerHeight = config.headerHeight;

  // Add header image if available
  if (config.branding.headerImage) {
    const added = addImageToPDF(
      doc,
      config.branding.headerImage,
      config.branding.headerImageMimeType,
      0,
      0,
      pageWidth,
      headerHeight
    );
    if (added) return headerHeight;
  }

  // Fallback header style
  doc.setFillColor(...config.branding.primaryColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Add logo if available
  let logoWidth = 0;
  if (config.branding.logo && config.showLogo) {
    const logoAdded = addImageToPDF(
      doc,
      config.branding.logo,
      config.branding.logoMimeType,
      10,
      5,
      25,
      25
    );
    if (logoAdded) logoWidth = 35;
  }

  // Add company name
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
  const footerHeight = config.footerHeight;
  const footerY = pageHeight - footerHeight;

  // Add footer image if available
  if (config.branding.footerImage) {
    const added = addImageToPDF(
      doc,
      config.branding.footerImage,
      config.branding.footerImageMimeType,
      0,
      footerY,
      pageWidth,
      footerHeight
    );
    if (added) return footerHeight;
  }

  // Fallback footer style
  doc.setFillColor(...config.branding.primaryColor);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  // Add footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(config.branding.footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Add page number
  doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 15, pageHeight - 10, { align: 'right' });

  return footerHeight;
}

function addBentoTile(doc: jsPDF, title: string, content: string[], x: number, y: number, width: number, height: number, config: TemplateConfig) {
  // Background
  doc.setFillColor(...config.branding.secondaryColor);
  doc.roundedRect(x, y, width, height, 2, 2, 'F');

  // Title
  doc.setFillColor(...config.branding.primaryColor);
  doc.roundedRect(x, y, width, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), x + 5, y + 10);

  // Content
  doc.setTextColor(60, 60, 60);
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
    console.log('Starting PDF generation for request:', request);

    const branding = await fetchBranding();
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
    let yPos = headerHeight + 5;

    // Title and Description
    const titleInfo = [
      `Title: ${request.title || 'N/A'}`,
      `Description: ${request.description || 'N/A'}`
    ];
    addBentoTile(doc, 'Request Details', titleInfo, margin, yPos, contentWidth, 45, config);

    // Request Info and Status
    yPos += 50;
    const requestInfo = [
      `Request #: ${request.requestNumber || 'N/A'}`,
      `Status: ${(request.status || 'N/A').toUpperCase()}`,
      `Priority: ${(request.priority || 'N/A').toUpperCase()}`,
      `Created: ${format(new Date(request.createdAt || new Date()), 'PPP')}`
    ];
    addBentoTile(doc, 'Request Info', requestInfo, margin, yPos, columnWidth, 55, config);

    // Vendor Details
    const vendor = request.vendor || {};
    const vendorInfo = [
      `Company: ${vendor.companyName || 'N/A'}`,
      `Contact: ${vendor.contactPerson || 'N/A'}`,
      `Phone: ${vendor.contactNumber || 'N/A'}`,
      `Email: ${vendor.email || 'N/A'}`,
      `Category: ${vendor.category || 'N/A'}`
    ];
    addBentoTile(doc, 'Vendor Details', vendorInfo, margin + columnWidth + margin/2, yPos, columnWidth, 55, config);

    // Purpose Information
    yPos += 60;
    const purposeInfo = [
      `Purpose Type: ${(request.purposeType || 'N/A').toUpperCase()}`,
      `Sub Purpose: ${request.subPurpose?.name || 'N/A'}`,
      `Priority Reason: ${request.priorityReason || 'N/A'}`
    ];
    addBentoTile(doc, 'Purpose Information', purposeInfo, margin, yPos, contentWidth, 45, config);

    // Items Table
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
        ['', '', '', 'Freight Amount:', formatCurrency(Number(request.freightAmount || 0), request.currency)],
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

    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
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
  return calculateItemsTotal(request) + Number(request.freightAmount || 0);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}