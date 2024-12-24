import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PurchaseRequestWithRelations } from '@db/schema';
import { format } from 'date-fns';

export function generateRequestPDF(request: PurchaseRequestWithRelations) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const maxWidth = pageWidth - (margin * 2);

  // Helper functions
  const addTile = (title: string, content: string[], y: number, height: number, backgroundColor = [245, 245, 250]) => {
    // Add tile background
    doc.setFillColor(...backgroundColor);
    doc.roundedRect(margin, y, maxWidth, height, 2, 2, 'F');

    // Add title
    doc.setFontSize(10);
    doc.setTextColor(113, 86, 162);
    doc.text(title, margin + 5, y + 7);

    // Add content
    doc.setTextColor(25, 17, 96);
    doc.setFontSize(8);
    content.forEach((text, index) => {
      doc.text(text, margin + 5, y + 15 + (index * 5));
    });
  };

  // Document setup
  doc.setProperties({
    title: `Purchase Request - ${request.requestNumber}`,
    subject: 'Purchase Request Details',
    creator: 'Procurement Management System',
  });

  // Header
  doc.setFillColor(113, 86, 162);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('PROCUREMENT REQUEST', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text(request.requestNumber, pageWidth / 2, 22, { align: 'center' });

  let yPos = 30;

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
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, yPos, maxWidth, 65, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setTextColor(113, 86, 162);
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
      fillColor: [113, 86, 162],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    footStyles: {
      fillColor: [240, 240, 250],
      textColor: [25, 17, 96],
      fontStyle: 'bold',
      fontSize: 8,
    },
  });

  // Approvals Tile
  yPos += 70;
  if (request.approvals && request.approvals.length > 0) {
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, yPos, maxWidth, 40, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(113, 86, 162);
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
        fillColor: [113, 86, 162],
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

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on ${format(new Date(), 'PPp')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

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