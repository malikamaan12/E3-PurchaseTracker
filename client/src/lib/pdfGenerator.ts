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
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching branding:', error);
    return null;
  }
}

export async function generateRequestPDF(
  request: PurchaseRequestWithRelations,
  templateConfig: Partial<TemplateConfig> = {}
) {
  // Fetch company branding
  const branding = await fetchBranding();

  const config: TemplateConfig = {
    branding: branding ? {
      name: branding.companyName,
      logo: branding.logo,
      logoMimeType: branding.logoMimeType,
      primaryColor: hexToRgb(branding.primaryColor) || defaultBranding.primaryColor,
      secondaryColor: hexToRgb(branding.secondaryColor) || defaultBranding.secondaryColor,
      accentColor: hexToRgb(branding.accentColor) || defaultBranding.accentColor,
      headerStyle: branding.headerStyle || 'modern',
      footerText: branding.footerText || defaultBranding.footerText
    } : defaultBranding,
    layout: 'bento',
    showLogo: !!branding?.logo,
    ...templateConfig
  };

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const maxWidth = pageWidth - (margin * 2);

  // Apply header with company branding
  const headerHeight = applyHeaderStyle(doc, config, pageWidth);

  // Helper function for creating tiles
  const addTile = (title: string, content: string[], y: number, height: number) => {
    createTileBackground(doc, config, margin, y, maxWidth, height);

    // Add title
    doc.setFontSize(10);
    doc.setTextColor(...config.branding.primaryColor);
    doc.text(title, margin + 5, y + 7);

    // Add content
    doc.setTextColor(...config.branding.accentColor);
    doc.setFontSize(8);
    content.forEach((text, index) => {
      doc.text(text, margin + 5, y + 15 + (index * 5));
    });
  };

  let yPos = headerHeight + 5;

  // Request Info Tile
  const requestInfo = [
    `Status: ${request.status.toUpperCase().replace('_', ' ')}`,
    `Priority: ${request.priority.toUpperCase()}`,
    `Created: ${format(new Date(request.createdAt), 'PPp')}`,
  ];
  addTile('Request Information', requestInfo, yPos, 25);

  // Requester Info Tile
  yPos += 30;
  const requesterInfo = [
    `Name: ${request.requester?.username || 'N/A'}`,
    `Department: ${request.requester?.department || 'N/A'}`,
    `Contact: ${request.requester?.contactNumber || 'N/A'}`,
    `Email: ${request.requester?.email || 'N/A'}`,
  ];
  addTile('Requester Details', requesterInfo, yPos, 30);

  // Purpose Tile
  yPos += 35;
  const purposeInfo = [
    `Type: ${request.purposeType.replace('_', ' ').toUpperCase()}`,
    request.subPurpose ? `Sub Purpose: ${request.subPurpose.name}` : '',
    `Details: ${request.purpose || 'N/A'}`,
  ].filter(Boolean);
  addTile('Purpose Information', purposeInfo, yPos, 25);

  // Items Table Tile
  yPos += 30;
  createTileBackground(doc, config, margin, yPos, maxWidth, 65);
  doc.setFontSize(10);
  doc.setTextColor(...config.branding.primaryColor);
  doc.text('Items', margin + 5, yPos + 7);

  const items = request.items.map(item => [
    item.name,
    item.quantity.toString(),
    formatCurrency(item.estimatedCost, request.currency),
    formatCurrency(item.quantity * item.estimatedCost, request.currency)
  ]);

  autoTable(doc, {
    startY: yPos + 10,
    margin: { left: margin + 5, right: margin + 5 },
    head: [['Item', 'Qty', 'Unit Cost', 'Total']],
    body: items,
    foot: [
      ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
      ['', '', 'Freight:', formatCurrency(Number(request.freightAmount), request.currency)],
      ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
    ],
    theme: 'plain',
    headStyles: {
      fillColor: config.branding.primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    footStyles: {
      fillColor: config.branding.secondaryColor,
      textColor: config.branding.accentColor,
      fontStyle: 'bold',
      fontSize: 8,
    },
  });

  // Approvals Tile
  yPos += 70;
  if (request.approvals && request.approvals.length > 0) {
    createTileBackground(doc, config, margin, yPos, maxWidth, 40);
    doc.setFontSize(10);
    doc.setTextColor(...config.branding.primaryColor);
    doc.text('Approval Status', margin + 5, yPos + 7);

    const approvalData = request.approvals.map(approval => [
      approval.department,
      approval.status.toUpperCase(),
      approval.isMandatory ? 'Yes' : 'No',
      approval.comments || '-',
    ]);

    autoTable(doc, {
      startY: yPos + 10,
      margin: { left: margin + 5, right: margin + 5 },
      head: [['Department', 'Status', 'Mandatory', 'Comments']],
      body: approvalData,
      theme: 'plain',
      headStyles: {
        fillColor: config.branding.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
      },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 100 },
      },
    });
  }

  // Attachments Tile
  yPos += 45;
  if (request.attachments && request.attachments.length > 0) {
    const attachmentsList = request.attachments.map(
      file => `• ${file.fileName} (${formatFileSize(file.fileSize)})`
    );
    addTile('Attached Files', attachmentsList, yPos, 25);
  }

  // Apply footer with branding
  applyFooterStyle(doc, config, pageWidth, pageHeight);

  return doc;
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