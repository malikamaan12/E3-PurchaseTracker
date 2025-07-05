import { jsPDF } from 'jspdf';

/**
 * Simple browser-compatible PDF generator without any external dependencies
 * This generator creates PDFs using only basic jsPDF functionality
 */

export interface PurchaseRequest {
  id: number;
  requestNumber?: string;
  title?: string;
  description?: string;
  status?: string;
  totalEstimatedCost?: number;
  currency?: string;
  createdAt?: string;
  requester?: {
    username?: string;
    department?: string;
  };
  vendor?: {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    contactNumber?: string;
  };
  items?: Array<{
    name?: string;
    description?: string;
    quantity?: number;
    estimatedCost?: number;
  }>;
  subPurpose?: {
    name?: string;
  };
  attachments?: Array<{
    fileName?: string;
  }>;
}

export async function generateSimpleBrowserPDF(request: PurchaseRequest): Promise<jsPDF> {
  // Create new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 15;
  let currentY = margin;

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth?: number) => {
    if (maxWidth) {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * 6);
    } else {
      doc.text(text, x, y);
      return y + 6;
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: number | undefined, currency = 'QAR') => {
    if (!amount) return '0.00';
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  currentY = addText('PURCHASE REQUEST', margin, currentY);
  currentY += 5;

  // Horizontal line
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // Request Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  currentY = addText('Request Information', margin, currentY);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Request details in two columns
  const leftCol = margin;
  const rightCol = margin + 95;

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Request Number:', leftCol, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(request.requestNumber || 'N/A', leftCol + 35, currentY);

  // Right column
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', rightCol, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text((request.status || 'PENDING').toUpperCase(), rightCol + 20, currentY);
  currentY += 8;

  // Requester info
  doc.setFont('helvetica', 'bold');
  doc.text('Requester:', leftCol, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(request.requester?.username || 'N/A', leftCol + 25, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('Department:', rightCol, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(request.requester?.department || 'N/A', rightCol + 25, currentY);
  currentY += 8;

  // Date and total
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', leftCol, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A', leftCol + 15, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Cost:', rightCol, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(request.totalEstimatedCost, request.currency), rightCol + 25, currentY);
  currentY += 15;

  // Title and Description
  if (request.title) {
    doc.setFont('helvetica', 'bold');
    currentY = addText('Title:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY = addText(request.title, margin, currentY, pageWidth - 2 * margin);
    currentY += 5;
  }

  if (request.description) {
    doc.setFont('helvetica', 'bold');
    currentY = addText('Description:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY = addText(request.description, margin, currentY, pageWidth - 2 * margin);
    currentY += 5;
  }

  // Vendor Information
  if (request.vendor) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Vendor Information', margin, currentY);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (request.vendor.companyName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Company:', leftCol, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.companyName, leftCol + 25, currentY);
      currentY += 6;
    }

    if (request.vendor.contactPerson) {
      doc.setFont('helvetica', 'bold');
      doc.text('Contact Person:', leftCol, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.contactPerson, leftCol + 35, currentY);
      currentY += 6;
    }

    if (request.vendor.email) {
      doc.setFont('helvetica', 'bold');
      doc.text('Email:', leftCol, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.email, leftCol + 15, currentY);
      currentY += 6;
    }

    if (request.vendor.contactNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text('Phone:', leftCol, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(request.vendor.contactNumber, leftCol + 20, currentY);
      currentY += 10;
    }
  }

  // Items
  if (request.items && request.items.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Items', margin, currentY);
    currentY += 5;

    doc.setFontSize(9);
    
    // Simple table header
    doc.setFont('helvetica', 'bold');
    doc.text('#', margin, currentY);
    doc.text('Item Name', margin + 10, currentY);
    doc.text('Description', margin + 60, currentY);
    doc.text('Qty', margin + 120, currentY);
    doc.text('Cost', margin + 140, currentY);
    currentY += 6;

    // Line under header
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2);
    currentY += 2;

    // Item rows
    doc.setFont('helvetica', 'normal');
    request.items.forEach((item, index) => {
      doc.text((index + 1).toString(), margin, currentY);
      doc.text(item.name || 'N/A', margin + 10, currentY);
      
      // Handle long descriptions
      if (item.description && item.description.length > 30) {
        const shortDesc = item.description.substring(0, 30) + '...';
        doc.text(shortDesc, margin + 60, currentY);
      } else {
        doc.text(item.description || 'N/A', margin + 60, currentY);
      }
      
      doc.text((item.quantity || 0).toString(), margin + 120, currentY);
      doc.text(formatCurrency(item.estimatedCost, request.currency), margin + 140, currentY);
      currentY += 6;
    });
    currentY += 5;
  }

  // Purpose
  if (request.subPurpose?.name) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Purpose', margin, currentY);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    currentY = addText(request.subPurpose.name, margin, currentY);
    currentY += 10;
  }

  // Attachments
  if (request.attachments && request.attachments.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Attachments', margin, currentY);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    request.attachments.forEach((attachment, index) => {
      currentY = addText(`${index + 1}. ${attachment.fileName || 'N/A'}`, margin + 5, currentY);
    });
    currentY += 10;
  }

  // Footer
  const footerY = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('Generated on: ' + new Date().toLocaleString(), margin, footerY);
  doc.text('Page 1 of 1', pageWidth - margin - 20, footerY);

  return doc;
}