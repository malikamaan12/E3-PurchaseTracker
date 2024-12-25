import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PurchaseRequestWithRelations } from '@db/schema';
import { format } from 'date-fns';
import {
  type TemplateConfig,
  defaultBranding,
  applyHeaderStyle,
  applyFooterStyle,
  createTileBackground,
  hexToRgb,
  type Color
} from './pdfTemplates';

// Enhanced error logging
const logError = (error: any, context: string) => {
  console.error(`PDF Generator Error [${context}]:`, {
    message: error.message,
    stack: error.stack,
    data: error
  });
};

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
    return branding;
  } catch (error) {
    logError(error, 'fetchBranding');
    return defaultBranding;
  }
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
      branding: branding ? {
        name: branding.companyName || defaultBranding.name,
        logo: branding.logo,
        logoMimeType: branding.logoMimeType || 'image/png',
        primaryColor: hexToRgb(branding.primaryColor) || defaultBranding.primaryColor,
        secondaryColor: hexToRgb(branding.secondaryColor) || defaultBranding.secondaryColor,
        accentColor: hexToRgb(branding.accentColor) || defaultBranding.accentColor,
        headerStyle: branding.headerStyle || 'modern',
        footerText: 'Confidential - For Internal Use Only'
      } : defaultBranding,
      layout: 'bento',
      showLogo: !!branding?.logo,
      headerHeight: templateConfig.headerHeight || 35,
      footerHeight: templateConfig.footerHeight || 25,
    };

    console.log('Using PDF config:', config);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);

    // Apply header with company branding
    const headerHeight = applyHeaderStyle(doc, config, pageWidth);
    console.log('Header applied at height:', headerHeight);

    // Helper function for creating tiles with enhanced styling
    const addTile = (title: string, content: string[], y: number, height: number) => {
      try {
        createTileBackground(doc, config, margin, y, maxWidth, height);

        // Add title with enhanced styling
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.text(title.toUpperCase(), margin + 8, y + 10);

        // Add subtle divider
        doc.setDrawColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.setLineWidth(0.2);
        doc.line(margin + 8, y + 13, margin + maxWidth - 16, y + 13);

        // Add content with improved formatting
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(config.branding.accentColor[0], config.branding.accentColor[1], config.branding.accentColor[2]);
        doc.setFontSize(10);
        content.forEach((text, index) => {
          if (text) { // Only render non-empty text
            doc.text(text, margin + 8, y + 22 + (index * 6));
          }
        });
      } catch (error) {
        logError(error, `addTile-${title}`);
        throw error;
      }
    };

    let yPos = headerHeight + 10;

    // Request Info Tile
    const requestInfo = [
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
      `Details: ${request.purpose || 'N/A'}`,
    ].filter(Boolean);
    addTile('Purpose Information', purposeInfo, yPos, 35);

    // Items Table Tile
    yPos += 40;
    try {
      createTileBackground(doc, config, margin, yPos, maxWidth, 75);

      // Add title for items section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
      doc.text('ITEMS & COSTS', margin + 8, yPos + 10);

      const items = request.items.map(item => {
        if (!item) {
          console.warn('Found undefined item in request:', request.id);
          return ['N/A', '0', '0', '0'];
        }
        return [
          item.name || 'N/A',
          item.quantity?.toString() || '0',
          formatCurrency(item.estimatedCost || 0, request.currency),
          formatCurrency((item.quantity || 0) * (item.estimatedCost || 0), request.currency)
        ];
      });

      console.log('Processing items for table:', items);

      // Enhanced table styling
      autoTable(doc, {
        startY: yPos + 15,
        margin: { left: margin + 8, right: margin + 8 },
        head: [['Item', 'Qty', 'Unit Cost', 'Total']],
        body: items,
        foot: [
          ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
          ['', '', 'Freight:', formatCurrency(Number(request.freightAmount || 0), request.currency)],
          ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
        ],
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]] as Color,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [
            Math.floor(config.branding.secondaryColor[0] * 0.95),
            Math.floor(config.branding.secondaryColor[1] * 0.95),
            Math.floor(config.branding.secondaryColor[2] * 0.95)
          ] as Color,
          textColor: config.branding.accentColor as Color,
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [
            Math.floor(config.branding.secondaryColor[0] * 0.98),
            Math.floor(config.branding.secondaryColor[1] * 0.98),
            Math.floor(config.branding.secondaryColor[2] * 0.98)
          ] as Color,
        },
      });
    } catch (error) {
      logError(error, 'itemsTable');
      throw error;
    }

    // Approvals Tile
    yPos += 80;
    if (request.approvals && request.approvals.length > 0) {
      try {
        createTileBackground(doc, config, margin, yPos, maxWidth, 50);

        // Add title for approvals section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.text('APPROVAL STATUS', margin + 8, yPos + 10);

        const approvalData = request.approvals.map(approval => [
          approval.department || 'N/A',
          approval.status?.toUpperCase() || 'PENDING',
          approval.isMandatory ? 'Yes' : 'No',
          approval.comments || '-',
        ]);

        // Enhanced approvals table
        autoTable(doc, {
          startY: yPos + 15,
          margin: { left: margin + 8, right: margin + 8 },
          head: [['Department', 'Status', 'Mandatory', 'Comments']],
          body: approvalData,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]] as Color,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [
              Math.floor(config.branding.secondaryColor[0] * 0.98),
              Math.floor(config.branding.secondaryColor[1] * 0.98),
              Math.floor(config.branding.secondaryColor[2] * 0.98)
            ] as Color,
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 30 },
            2: { cellWidth: 25 },
            3: { cellWidth: 'auto' },
          },
        });
      } catch (error) {
        logError(error, 'approvalsTable');
        throw error;
      }
    }

    // Attachments Tile
    yPos += 55;
    if (request.attachments && request.attachments.length > 0) {
      const attachmentsList = request.attachments.map(
        file => `• ${file.fileName || 'Unnamed'} (${formatFileSize(file.fileSize || 0)})`
      );
      addTile('Attached Files', attachmentsList, yPos, 35);
    }

    // Apply footer with branding
    applyFooterStyle(doc, config, pageWidth, pageHeight);

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