import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PurchaseRequestWithRelations } from '@db/schema';

export function generateRequestPDF(request: PurchaseRequestWithRelations) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const columnWidth = (pageWidth - (margin * 3)) / 2;

  // Set document properties
  doc.setProperties({
    title: `Purchase Request - ${request.requestNumber}`,
    subject: 'Purchase Request Details',
    creator: 'Procurement Management System',
  });

  // Header with border
  doc.setFillColor(113, 86, 162);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('PROCUREMENT REQUEST', pageWidth / 2, 15, { align: 'center' });

  // Request number and basic info tile
  let yPos = 30;
  doc.setFontSize(10);
  doc.setTextColor(25, 17, 96);
  doc.setDrawColor(113, 86, 162);
  doc.roundedRect(margin, yPos, columnWidth, 25, 2, 2);
  doc.text(`Request: ${request.requestNumber}`, margin + 5, yPos + 8);
  doc.text(`Status: ${request.status.toUpperCase().replace('_', ' ')}`, margin + 5, yPos + 15);
  doc.text(`Priority: ${request.priority.toUpperCase()}`, margin + 5, yPos + 22);

  // Requester info tile
  doc.roundedRect(margin * 2 + columnWidth, yPos, columnWidth, 25, 2, 2);
  doc.text(`Requester: ${request.requester?.username || 'N/A'}`, margin * 2 + columnWidth + 5, yPos + 8);
  doc.text(`Department: ${request.requester?.department || 'N/A'}`, margin * 2 + columnWidth + 5, yPos + 15);
  doc.text(`Contact: ${request.requester?.contactNumber || 'N/A'}`, margin * 2 + columnWidth + 5, yPos + 22);

  // Request details tile
  yPos += 30;
  doc.setFontSize(11);
  doc.setTextColor(113, 86, 162);
  doc.text('Request Details', margin, yPos);
  doc.setTextColor(25, 17, 96);
  doc.setFontSize(9);
  yPos += 7;
  doc.text(`Title: ${request.title}`, margin + 5, yPos);
  yPos += 7;
  const description = doc.splitTextToSize(`Description: ${request.description}`, columnWidth - 10);
  doc.text(description, margin + 5, yPos);
  yPos += description.length * 5;

  // Purpose info tile
  doc.setFontSize(11);
  doc.setTextColor(113, 86, 162);
  doc.text('Purpose Information', margin * 2 + columnWidth, 60);
  doc.setTextColor(25, 17, 96);
  doc.setFontSize(9);
  let purposeY = 67;
  doc.text(`Type: ${request.purposeType.replace('_', ' ').toUpperCase()}`, margin * 2 + columnWidth + 5, purposeY);
  purposeY += 7;
  if (request.subPurpose) {
    doc.text(`Sub Purpose: ${request.subPurpose.name}`, margin * 2 + columnWidth + 5, purposeY);
    purposeY += 7;
  }
  if (request.purpose) {
    const purposeDetails = doc.splitTextToSize(`Details: ${request.purpose}`, columnWidth - 10);
    doc.text(purposeDetails, margin * 2 + columnWidth + 5, purposeY);
  }

  // Items table
  yPos += 10;
  const items = request.items.map(item => [
    item.name,
    item.quantity.toString(),
    formatCurrency(item.estimatedCost, request.currency),
    formatCurrency(item.quantity * item.estimatedCost, request.currency)
  ]);

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin },
    head: [['Item', 'Qty', 'Unit Cost', 'Total']],
    body: items,
    theme: 'striped',
    headStyles: {
      fillColor: [113, 86, 162],
      textColor: [255, 255, 255],
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8
    },
    foot: [
      ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
      ['', '', 'Freight:', formatCurrency(Number(request.freightAmount), request.currency)],
      ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
    ],
    footStyles: {
      fillColor: [240, 240, 250],
      textColor: [25, 17, 96],
      fontStyle: 'bold',
      fontSize: 8
    },
  });

  // Get the final Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Vendor info tile
  doc.setFontSize(11);
  doc.setTextColor(113, 86, 162);
  doc.text('Vendor Information', margin, yPos);
  doc.setTextColor(25, 17, 96);
  doc.setFontSize(9);
  yPos += 7;
  doc.text(`Company: ${request.companyName}`, margin + 5, yPos);
  doc.text(`Contact: ${request.contactPerson}`, margin + columnWidth / 2, yPos);
  yPos += 7;
  doc.text(`Phone: ${request.contactNumber}`, margin + 5, yPos);
  doc.text(`Account: ${request.accountNumber}`, margin + columnWidth / 2, yPos);

  // Approvals table
  if (request.approvals && request.approvals.length > 0) {
    yPos += 12;
    doc.setFontSize(11);
    doc.setTextColor(113, 86, 162);
    doc.text('Approval Status', margin, yPos);
    yPos += 5;

    const approvalData = request.approvals.map(approval => [
      approval.department,
      approval.status.toUpperCase(),
      approval.isMandatory ? 'Yes' : 'No',
      approval.comments || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin },
      head: [['Dept', 'Status', 'Mandatory', 'Comments']],
      body: approvalData,
      theme: 'striped',
      headStyles: {
        fillColor: [113, 86, 162],
        textColor: [255, 255, 255],
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 1
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 110 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // Attachments list
  if (request.attachments && request.attachments.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(113, 86, 162);
    doc.text('Attachments', margin, yPos);
    yPos += 7;
    doc.setTextColor(25, 17, 96);
    doc.setFontSize(8);
    request.attachments.forEach((file, index) => {
      const text = `${index + 1}. ${file.fileName} (${formatFileSize(file.fileSize)})`;
      doc.text(text, margin + 5, yPos);
      yPos += 5;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  return doc;
}

// Helper functions
function formatCurrency(amount: number, currency: string): string {
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