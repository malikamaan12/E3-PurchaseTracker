import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [26, 54, 93]; // #1a365d
  try {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : defaultColor;
  } catch (error) {
    console.error('Error converting hex to RGB:', error);
    return defaultColor;
  }
}

function addHeader(doc: jsPDF, request: any): number {
  const pageWidth = doc.internal.pageSize.width;
  const headerHeight = 45;
  const margin = 20;

  // Add company header
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 93); // Dark blue
  doc.text("EVENTS & ENTERTAINMENT ENTERPRISES", margin, 25, { align: 'left' });

  doc.setFontSize(14);
  doc.text("PURCHASE REQUEST", margin, 35, { align: 'left' });

  // Add request number and date
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Request No: ${request.requestNumber}`, pageWidth - margin, 25, { align: 'right' });
  doc.text(`Date: ${new Date(request.createdAt).toLocaleDateString()}`, pageWidth - margin, 35, { align: 'right' });

  return headerHeight;
}

function addFooter(doc: jsPDF, currentPage: number, totalPages: number): void {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);

  // Add footer text
  doc.text("ALL RIGHTS RESERVED BY E3", margin, pageHeight - 20);

  // Add page numbers
  doc.text(
    `Page ${currentPage} of ${totalPages}`,
    pageWidth - margin,
    pageHeight - 20,
    { align: 'right' }
  );
}

function addSection(doc: jsPDF, title: string, yPos: number): number {
  const margin = 20;
  doc.setFillColor(247, 248, 250);
  doc.rect(margin, yPos, doc.internal.pageSize.width - (2 * margin), 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 54, 93);
  doc.text(title, margin + 2, yPos + 6);

  return yPos + 12;
}

export async function generateRequestPDF(request: any) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const margin = 20;
    let yPos = addHeader(doc, request);

    // Basic Information Section
    yPos = addSection(doc, "Basic Information", yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    const basicInfo = [
      ['Title:', request.title || 'N/A'],
      ['Description:', request.description || 'N/A'],
      ['Status:', request.status?.toUpperCase() || 'N/A'],
      ['Priority:', request.priority?.toUpperCase() || 'N/A']
    ];

    autoTable(doc, {
      startY: yPos,
      body: basicInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 30, font: 'bold' } },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Purpose & Sub-purpose Section
    yPos = addSection(doc, "Purpose Information", yPos);
    const purposeInfo = [
      ['Purpose Type:', request.purposeType || 'N/A'],
      ['Sub-purpose:', request.subPurpose?.name || 'N/A']
    ];

    autoTable(doc, {
      startY: yPos,
      body: purposeInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 30, font: 'bold' } },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Vendor Information Section
    yPos = addSection(doc, "Vendor Information", yPos);
    const vendorInfo = [
      ['Vendor Name:', request.vendor?.name || 'N/A'],
      ['Contact Person:', request.vendor?.contactPerson || 'N/A'],
      ['Email:', request.vendor?.email || 'N/A'],
      ['Phone:', request.vendor?.phone || 'N/A']
    ];

    autoTable(doc, {
      startY: yPos,
      body: vendorInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 30, font: 'bold' } },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Items Section
    yPos = addSection(doc, "Items", yPos);
    const items = Array.isArray(request.items) ? request.items : JSON.parse(request.items || '[]');

    // Calculate totals
    const itemsTotal = items.reduce((sum: number, item: any) => 
      sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)), 0
    );
    const freightAmount = Number(request.freightAmount || 0);
    const totalCost = itemsTotal + freightAmount;

    // Format currency
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: request.currency || 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Description', 'Quantity', 'Unit Cost', 'Total']],
      body: items.map((item: any) => [
        item.name || 'N/A',
        item.description || 'N/A',
        item.quantity?.toString() || '0',
        formatCurrency(item.estimatedCost || 0),
        formatCurrency((item.quantity || 0) * (item.estimatedCost || 0))
      ]),
      foot: [
        ['', '', '', 'Items Total:', formatCurrency(itemsTotal)],
        ['', '', '', 'Freight Amount:', formatCurrency(freightAmount)],
        ['', '', '', 'Total Cost:', formatCurrency(totalCost)]
      ],
      theme: 'striped',
      headStyles: {
        fillColor: [247, 248, 250],
        textColor: [26, 54, 93],
        fontSize: 10,
        fontStyle: 'bold'
      },
      footStyles: {
        fillColor: [247, 248, 250],
        textColor: [26, 54, 93],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Attached Documents Section if available
    if (request.attachments?.length > 0) {
      yPos = addSection(doc, "Attached Documents", yPos);
      const attachments = request.attachments.map((file: any) => [
        file.name || 'N/A',
        file.type || 'N/A',
        file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Document Name', 'Type', 'Size']],
        body: attachments,
        theme: 'striped',
        headStyles: {
          fillColor: [247, 248, 250],
          textColor: [26, 54, 93],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 9
        },
        margin: { left: margin, right: margin }
      });
    }

    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, i, pageCount);
    }

    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

function calculateTotalCost(request: any): number {
  return (request.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)),
    0
  );
}

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