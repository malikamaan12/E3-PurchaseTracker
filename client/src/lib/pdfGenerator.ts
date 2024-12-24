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

  // Add header with border
  doc.setFillColor(113, 86, 162); // #7156a2
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('PROCUREMENT REQUEST', 105, 25, { align: 'center' });

  // Request number and status badge
  doc.setFontSize(12);
  doc.setTextColor(25, 17, 96);
  doc.setDrawColor(113, 86, 162);
  doc.roundedRect(15, 50, 180, 25, 3, 3);
  doc.text(`Request Number: ${request.requestNumber}`, 20, 60);
  doc.text(`Status: ${request.status.toUpperCase().replace('_', ' ')}`, 20, 70);

  // Requester Information
  let yPos = 90;
  doc.setFontSize(16);
  doc.setTextColor(113, 86, 162);
  doc.text('Requester Information', 15, yPos);

  doc.setFontSize(11);
  doc.setTextColor(25, 17, 96);
  yPos += 10;
  doc.text(`Name: ${request.requester?.username || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Department: ${request.requester?.department || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Email: ${request.requester?.email || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Contact: ${request.requester?.contactNumber || 'N/A'}`, 20, yPos);

  // Priority and Date information
  yPos += 15;
  doc.setFontSize(11);
  doc.setTextColor(25, 17, 96);
  doc.text(`Priority: ${request.priority.toUpperCase()}`, 20, yPos);
  yPos += 7;
  doc.text(`Created Date: ${new Date(request.createdAt).toLocaleDateString()}`, 20, yPos);

  // Request Details Section
  yPos += 15;
  doc.setFontSize(16);
  doc.setTextColor(113, 86, 162);
  doc.text('Request Details', 15, yPos);

  yPos += 10;
  doc.setFontSize(12);
  doc.setTextColor(25, 17, 96);
  doc.text(`Title: ${request.title}`, 20, yPos);

  // Description with word wrap
  yPos += 10;
  const description = doc.splitTextToSize(`Description: ${request.description}`, 170);
  doc.setFontSize(11);
  doc.text(description, 20, yPos);

  // Purpose information
  yPos += (description.length * 7) + 10;
  doc.setFontSize(16);
  doc.setTextColor(113, 86, 162);
  doc.text('Purpose Information', 15, yPos);

  yPos += 10;
  doc.setFontSize(11);
  doc.setTextColor(25, 17, 96);
  doc.text(`Purpose Type: ${request.purposeType.replace('_', ' ').toUpperCase()}`, 20, yPos);
  yPos += 7;
  if (request.subPurpose) {
    doc.text(`Sub Purpose: ${request.subPurpose.name}`, 20, yPos);
    yPos += 7;
  }
  if (request.purpose) {
    const purposeDetails = doc.splitTextToSize(`Purpose Details: ${request.purpose}`, 170);
    doc.text(purposeDetails, 20, yPos);
    yPos += (purposeDetails.length * 7);
  }

  // Items table
  yPos += 10;
  doc.setFontSize(16);
  doc.setTextColor(113, 86, 162);
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
      fontSize: 11
    },
    bodyStyles: {
      fontSize: 10
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
      fontSize: 11
    },
  });

  // Get the final Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Vendor Information
  doc.setFontSize(16);
  doc.setTextColor(113, 86, 162);
  doc.text('Vendor Information', 15, yPos);

  doc.setFontSize(11);
  doc.setTextColor(25, 17, 96);
  yPos += 10;
  doc.text(`Company: ${request.companyName}`, 20, yPos);
  yPos += 7;
  doc.text(`Contact Person: ${request.contactPerson}`, 20, yPos);
  yPos += 7;
  doc.text(`Contact Number: ${request.contactNumber}`, 20, yPos);
  yPos += 7;
  doc.text(`Account Details: ${request.accountNumber}`, 20, yPos);

  // Add a new page for approvals and attachments
  doc.addPage();
  yPos = 20;

  // Approvals section
  if (request.approvals && request.approvals.length > 0) {
    doc.setFontSize(16);
    doc.setTextColor(113, 86, 162);
    doc.text('Approval Status', 15, yPos);
    yPos += 10;

    const approvalData = request.approvals.map(approval => [
      approval.department,
      approval.status.toUpperCase(),
      approval.isMandatory ? 'Yes' : 'No',
      approval.comments || '-',
      new Date(approval.createdAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Department', 'Status', 'Mandatory', 'Comments', 'Date']],
      body: approvalData,
      theme: 'striped',
      headStyles: {
        fillColor: [113, 86, 162],
        textColor: [255, 255, 255],
        fontSize: 11
      },
      styles: {
        cellWidth: 'wrap',
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 65 },
        4: { cellWidth: 35 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;
  }

  // Attachments section
  if (request.attachments && request.attachments.length > 0) {
    doc.setFontSize(16);
    doc.setTextColor(113, 86, 162);
    doc.text('Attachments', 15, yPos);
    yPos += 10;

    const attachmentData = request.attachments.map(file => [
      file.fileName,
      file.fileType,
      formatFileSize(file.fileSize),
      new Date(file.uploadedAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['File Name', 'Type', 'Size', 'Upload Date']],
      body: attachmentData,
      theme: 'striped',
      headStyles: {
        fillColor: [113, 86, 162],
        textColor: [255, 255, 255],
        fontSize: 11
      },
      styles: {
        cellWidth: 'wrap',
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 }
      }
    });
  }

  // Footer with page numbers
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}