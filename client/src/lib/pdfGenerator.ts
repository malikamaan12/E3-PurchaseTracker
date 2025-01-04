import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PurchaseRequestWithRelations } from '@db/schema';
import { format } from 'date-fns';
import {
  type TemplateConfig,
  defaultBranding,
  createTileBackground,
  hexToRgb,
} from './pdfTemplates';

// Enhanced error logging
const logError = (error: any, context: string) => {
  console.error(`PDF Generator Error [${context}]:`, {
    message: error.message,
    stack: error.stack,
    data: error
  });
};

// Function to add image to PDF with error handling
function addImageToPDF(doc: jsPDF, imageData: string, mimeType: string, x: number, y: number, width: number, height: number) {
  try {
    if (imageData) {
      doc.addImage(
        `data:${mimeType};base64,${imageData}`,
        mimeType.split('/')[1].toUpperCase(),
        x,
        y,
        width,
        height,
        undefined,
        'FAST'
      );
      return true;
    }
    return false;
  } catch (error) {
    logError(error, 'addImageToPDF');
    return false;
  }
}

// Fetch company branding before generating PDF
async function fetchBranding() {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      console.warn('Failed to fetch branding, using default branding');
      return defaultBranding;
    }
    const branding = await response.json();
    console.log('Fetched branding:', branding);
    return {
      name: branding.companyName || defaultBranding.name,
      primaryColor: hexToRgb(branding.primaryColor) || defaultBranding.primaryColor,
      secondaryColor: hexToRgb(branding.secondaryColor) || defaultBranding.secondaryColor,
      accentColor: hexToRgb(branding.accentColor) || defaultBranding.accentColor,
      headerStyle: branding.headerStyle || 'modern',
      logo: branding.logo,
      logoMimeType: branding.logoMimeType,
      headerImage: branding.headerImage,
      headerImageMimeType: branding.headerImageMimeType,
      footerImage: branding.footerImage,
      footerImageMimeType: branding.footerImageMimeType,
      footerText: branding.footerText || "Confidential - For Internal Use Only"
    };
  } catch (error) {
    logError(error, 'fetchBranding');
    return defaultBranding;
  }
}

// Function to add header with enhanced styling
function addHeader(doc: jsPDF, config: TemplateConfig, pageWidth: number) {
  const headerHeight = 35;

  // Try to add header image first
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
  const brandingColor = config.branding.primaryColor;

  // Modern header with gradient effect
  doc.setFillColor(brandingColor[0], brandingColor[1], brandingColor[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Add subtle pattern
  for (let i = 0; i < pageWidth; i += 15) {
    doc.setFillColor(255, 255, 255, 0.1);
    doc.rect(i, 0, 10, headerHeight, 'F');
  }

  // Add logo if available
  if (config.branding.logo) {
    addImageToPDF(
      doc,
      config.branding.logo,
      config.branding.logoMimeType || 'image/png',
      10,
      5,
      25,
      25
    );
  }

  // Company name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.name, config.branding.logo ? 40 : 15, headerHeight / 2);

  // Add date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const date = format(new Date(), 'PPP');
  doc.text(date, pageWidth - 15, headerHeight / 2, { align: 'right' });

  return headerHeight;
}

// Function to add footer with enhanced styling
function addFooter(doc: jsPDF, config: TemplateConfig, pageWidth: number, pageHeight: number) {
  const footerHeight = 25;
  const footerY = pageHeight - footerHeight;

  // Try to add footer image first
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
  const brandingColor = config.branding.primaryColor;

  // Modern footer with gradient effect
  doc.setFillColor(brandingColor[0], brandingColor[1], brandingColor[2]);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  // Add subtle pattern
  for (let i = 0; i < pageWidth; i += 15) {
    doc.setFillColor(255, 255, 255, 0.1);
    doc.rect(i, footerY, 10, footerHeight, 'F');
  }

  // Footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(config.branding.footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Page number
  const pageNumber = `Page ${doc.getCurrentPageInfo().pageNumber}`;
  doc.text(pageNumber, pageWidth - 15, pageHeight - 10, { align: 'right' });

  return footerHeight;
}

export async function generateRequestPDF(
  request: PurchaseRequestWithRelations,
  templateConfig: Partial<TemplateConfig> = {}
) {
  try {
    console.log('Starting PDF generation for request:', {
      id: request.id,
      status: request.status,
      items: request.items?.length || 0
    });

    // Validate request data
    if (!request || !request.items) {
      throw new Error('Invalid request data - missing required fields');
    }

    // Fetch company branding
    const branding = await fetchBranding();

    const config: TemplateConfig = {
      branding,
      layout: 'bento',
      headerHeight: templateConfig.headerHeight || 35,
      footerHeight: templateConfig.footerHeight || 25,
      showLogo: !!branding.logo
    };

    console.log('Using PDF config:', config);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);

    // Add header
    const headerHeight = addHeader(doc, config, pageWidth);
    let yPos = headerHeight + 10;

    // Helper function for creating tiles with enhanced styling
    const addTile = (title: string, content: string[], y: number, height: number) => {
      try {
        // Add tile background with subtle gradient
        doc.setFillColor(config.branding.secondaryColor[0], config.branding.secondaryColor[1], config.branding.secondaryColor[2]);
        doc.rect(margin, y, maxWidth, height, 'F');

        // Add decorative accent
        doc.setFillColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.rect(margin, y, 5, height, 'F');

        // Add title with enhanced styling
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.text(title.toUpperCase(), margin + 8, y + 10);

        // Add content with improved formatting
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(config.branding.accentColor[0], config.branding.accentColor[1], config.branding.accentColor[2]);
        doc.setFontSize(10);
        content.forEach((text, index) => {
          if (text) {
            doc.text(text, margin + 8, y + 22 + (index * 6));
          }
        });
      } catch (error) {
        logError(error, `addTile-${title}`);
        throw error;
      }
    };

    // Request Info Tile
    const requestInfo = [
      `Request Number: ${request.requestNumber}`,
      `Status: ${request.status.toUpperCase().replace('_', ' ')}`,
      `Priority: ${request.priority.toUpperCase()}`,
      `Created: ${format(new Date(request.createdAt || new Date()), 'PPp')}`,
    ];
    addTile('Request Information', requestInfo, yPos, 35);

    // Requester Info Tile
    yPos += 40;
    const requesterInfo = [
      `Name: ${request.requester?.username || 'N/A'}`,
      `Department: ${request.requester?.department || 'N/A'}`,
      `Contact: ${request.requester?.contactNumber || 'N/A'}`,
      `Email: ${request.requester?.email || 'N/A'}`,
    ];
    addTile('Requester Details', requesterInfo, yPos, 40);

    // Purpose Tile
    yPos += 45;
    const purposeInfo = [
      `Type: ${request.purposeType.replace('_', ' ').toUpperCase()}`,
      request.subPurpose ? `Sub Purpose: ${request.subPurpose.name}` : '',
      `Details: ${request.description || 'N/A'}`,
    ].filter(Boolean);
    addTile('Purpose Information', purposeInfo, yPos, 35);

    // Items Table
    yPos += 40;
    const tableStyles = {
      headStyles: {
        fillColor: [config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [
          Math.floor(config.branding.secondaryColor[0] * 0.98),
          Math.floor(config.branding.secondaryColor[1] * 0.98),
          Math.floor(config.branding.secondaryColor[2] * 0.98)
        ],
      },
      margin: { left: margin + 8, right: margin + 8 }
    };

    // Format items data
    const items = request.items.map(item => [
      item?.name || 'N/A',
      item?.quantity?.toString() || '0',
      formatCurrency(item?.estimatedCost || 0, request.currency),
      formatCurrency((item?.quantity || 0) * (item?.estimatedCost || 0), request.currency)
    ]);

    // Add items table
    autoTable(doc, {
      startY: yPos + 15,
      head: [['Item', 'Qty', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
        ['', '', 'Freight:', formatCurrency(Number(request.freightAmount || 0), request.currency)],
        ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
      ],
      ...tableStyles,
      footStyles: {
        ...tableStyles.headStyles,
        fillColor: [
          Math.floor(config.branding.primaryColor[0] * 0.9),
          Math.floor(config.branding.primaryColor[1] * 0.9),
          Math.floor(config.branding.primaryColor[2] * 0.9)
        ],
      }
    });

    // Approvals Table
    if (request.approvals && request.approvals.length > 0) {
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Add approvals table
      autoTable(doc, {
        startY: yPos,
        head: [['Department', 'Approver', 'Status', 'Comments']],
        body: request.approvals.map(approval => [
          approval.department || 'N/A',
          approval.approver?.username || 'N/A',
          approval.status.toUpperCase(),
          approval.comments || '-'
        ]),
        ...tableStyles,
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 'auto' }
        }
      });
    }

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, config, pageWidth, pageHeight);
    }

    console.log('PDF generation completed successfully');
    return doc;
  } catch (error) {
    logError(error, 'generateRequestPDF');
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    logError(error, 'formatCurrency');
    return `${currency} ${amount}`;
  }
}

function calculateItemsTotal(request: PurchaseRequestWithRelations): number {
  try {
    return (request.items || []).reduce(
      (sum, item) => sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)),
      0
    );
  } catch (error) {
    logError(error, 'calculateItemsTotal');
    return 0;
  }
}

function calculateTotalCost(request: PurchaseRequestWithRelations): number {
  try {
    return calculateItemsTotal(request) + Number(request.freightAmount || 0);
  } catch (error) {
    logError(error, 'calculateTotalCost');
    return 0;
  }
}

function formatFileSize(bytes: number): string {
  try {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  } catch (error) {
    logError(error, 'formatFileSize');
    return '0 Bytes';
  }
}