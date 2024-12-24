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
  hexToRgb
} from './pdfTemplates';

// Fetch company branding before generating PDF
async function fetchBranding() {
  try {
    const response = await fetch('/api/branding');
    if (!response.ok) {
      console.warn('Failed to fetch branding, using default branding');
      return null;
    }
    const branding = await response.json();
    console.log('Fetched branding:', branding); // Debug log
    return branding;
  } catch (error) {
    console.error('Error fetching branding:', error);
    return null;
  }
}

export async function generateRequestPDF(
  request: PurchaseRequestWithRelations,
  templateConfig: Partial<TemplateConfig> = {}
) {
  try {
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
      headerHeight: templateConfig.headerHeight || 35, // Increased header height
      footerHeight: templateConfig.footerHeight || 25, // Increased footer height
    };

    console.log('Using PDF config:', config);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15; // Increased margin
    const maxWidth = pageWidth - (margin * 2);

    // Apply header with company branding
    const headerHeight = applyHeaderStyle(doc, config, pageWidth);

    // Helper function for creating tiles with enhanced styling
    const addTile = (title: string, content: string[], y: number, height: number) => {
      createTileBackground(doc, config, margin, y, maxWidth, height);

      // Add title with enhanced styling
      doc.setFontSize(12); // Increased font size
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...config.branding.primaryColor);
      doc.text(title.toUpperCase(), margin + 8, y + 10); // Increased padding

      // Add subtle divider
      doc.setDrawColor(...config.branding.primaryColor);
      doc.setLineWidth(0.2);
      doc.line(margin + 8, y + 13, margin + maxWidth - 16, y + 13);

      // Add content with improved formatting
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...config.branding.accentColor);
      doc.setFontSize(10);
      content.forEach((text, index) => {
        doc.text(text, margin + 8, y + 22 + (index * 6)); // Increased line spacing
      });
    };

    let yPos = headerHeight + 10; // Increased spacing after header

    // Request Info Tile
    const requestInfo = [
      `Status: ${request.status.toUpperCase().replace('_', ' ')}`,
      `Priority: ${request.priority.toUpperCase()}`,
      `Created: ${format(new Date(request.createdAt), 'PPp')}`,
    ];
    addTile('Request Information', requestInfo, yPos, 35);

    // Requester Info Tile
    yPos += 40; // Increased spacing between tiles
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
    createTileBackground(doc, config, margin, yPos, maxWidth, 75); // Increased height

    // Add title for items section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...config.branding.primaryColor);
    doc.text('ITEMS & COSTS', margin + 8, yPos + 10);

    const items = request.items.map(item => [
      item.name,
      item.quantity.toString(),
      formatCurrency(item.estimatedCost, request.currency),
      formatCurrency(item.quantity * item.estimatedCost, request.currency)
    ]);

    // Enhanced table styling
    autoTable(doc, {
      startY: yPos + 15,
      margin: { left: margin + 8, right: margin + 8 },
      head: [['Item', 'Qty', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
        ['', '', 'Freight:', formatCurrency(Number(request.freightAmount), request.currency)],
        ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [...config.branding.secondaryColor.map(c => c * 0.95)], // Slightly darker
        textColor: config.branding.accentColor,
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [...config.branding.secondaryColor.map(c => c * 0.98)], // Very light shade
      },
    });

    // Approvals Tile
    yPos += 80;
    if (request.approvals && request.approvals.length > 0) {
      createTileBackground(doc, config, margin, yPos, maxWidth, 50);

      // Add title for approvals section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...config.branding.primaryColor);
      doc.text('APPROVAL STATUS', margin + 8, yPos + 10);

      const approvalData = request.approvals.map(approval => [
        approval.department,
        approval.status.toUpperCase(),
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
          fillColor: config.branding.primaryColor,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [...config.branding.secondaryColor.map(c => c * 0.98)],
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 'auto' },
        },
      });
    }

    // Attachments Tile
    yPos += 55;
    if (request.attachments && request.attachments.length > 0) {
      const attachmentsList = request.attachments.map(
        file => `• ${file.fileName} (${formatFileSize(file.fileSize)})`
      );
      addTile('Attached Files', attachmentsList, yPos, 35);
    }

    // Apply footer with branding
    applyFooterStyle(doc, config, pageWidth, pageHeight);

    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper functions
function formatCurrency(amount: number, currency: string = 'QAR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'QAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function calculateItemsTotal(request: PurchaseRequestWithRelations): number {
  return request.items.reduce(
    (sum, item) => sum + (Number(item.quantity) * Number(item.estimatedCost)),
    0
  );
}

function calculateTotalCost(request: PurchaseRequestWithRelations): number {
  return calculateItemsTotal(request) + Number(request.freightAmount);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}