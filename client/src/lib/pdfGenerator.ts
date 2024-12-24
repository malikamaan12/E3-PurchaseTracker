import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PurchaseRequestWithRelations } from '@db/schema';

export function generateRequestPDF(request: PurchaseRequestWithRelations) {
  const doc = new jsPDF();
  
  // Set document properties
  doc.setProperties({
    title: `Purchase Request - ${request.requestNumber}`,
    subject: 'Purchase Request Details',
    creator: 'Procurement Management System',
  });

  // Add company logo/header
  doc.setFontSize(20);
  doc.setTextColor(113, 86, 162); // #7156a2
  doc.text('PROCUREMENT REQUEST', 105, 20, { align: 'center' });
  
  // Request basic info
  doc.setFontSize(12);
  doc.setTextColor(25, 17, 96); // #191160
  doc.text(`Request Number: ${request.requestNumber}`, 15, 35);
  doc.text(`Status: ${request.status.toUpperCase().replace('_', ' ')}`, 15, 42);
  doc.text(`Priority: ${request.priority.toUpperCase()}`, 15, 49);
  doc.text(`Date: ${new Date(request.createdAt).toLocaleDateString()}`, 15, 56);

  // Title and Description
  doc.setFontSize(14);
  doc.text('Request Details', 15, 70);
  doc.setFontSize(12);
  doc.text(`Title: ${request.title}`, 15, 80);
  
  // Description with word wrap
  const description = doc.splitTextToSize(`Description: ${request.description}`, 180);
  doc.text(description, 15, 90);

  // Purpose information
  let yPos = 90 + (description.length * 7);
  doc.text(`Purpose Type: ${request.purposeType.replace('_', ' ').toUpperCase()}`, 15, yPos);
  yPos += 7;
  if (request.subPurpose) {
    doc.text(`Sub Purpose: ${request.subPurpose.name}`, 15, yPos);
    yPos += 7;
  }
  if (request.purpose) {
    doc.text(`Purpose Details: ${request.purpose}`, 15, yPos);
    yPos += 15;
  }

  // Items table
  doc.setFontSize(14);
  doc.text('Items', 15, yPos);
  yPos += 10;

  const items = request.items.map(item => [
    item.name,
    item.quantity.toString(),
    formatCurrency(item.estimatedCost, request.currency),
    formatCurrency(item.quantity * item.estimatedCost, request.currency)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Quantity', 'Unit Cost', 'Total']],
    body: items,
    theme: 'striped',
    headStyles: {
      fillColor: [113, 86, 162],
      textColor: [255, 255, 255],
    },
    foot: [
      ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
      ['', '', 'Freight Amount:', formatCurrency(Number(request.freightAmount), request.currency)],
      ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
    ],
    footStyles: {
      fillColor: [240, 240, 250],
      textColor: [25, 17, 96],
      fontStyle: 'bold',
    },
  });

  // Get the final Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Vendor Information
  doc.setFontSize(14);
  doc.text('Vendor Information', 15, yPos);
  doc.setFontSize(12);
  yPos += 10;
  doc.text(`Company: ${request.companyName}`, 15, yPos);
  yPos += 7;
  doc.text(`Contact Person: ${request.contactPerson}`, 15, yPos);
  yPos += 7;
  doc.text(`Contact Number: ${request.contactNumber}`, 15, yPos);
  yPos += 7;
  doc.text(`Account Details: ${request.accountNumber}`, 15, yPos);

  // Approvals section if available
  if (request.approvals && request.approvals.length > 0) {
    yPos += 20;
    doc.setFontSize(14);
    doc.text('Approval Status', 15, yPos);
    yPos += 10;

    const approvalData = request.approvals.map(approval => [
      approval.department,
      approval.status.toUpperCase(),
      approval.comments || '-',
      new Date(approval.createdAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Department', 'Status', 'Comments', 'Date']],
      body: approvalData,
      theme: 'striped',
      headStyles: {
        fillColor: [113, 86, 162],
        textColor: [255, 255, 255],
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return doc;
}

// Helper functions
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'QAR'
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
