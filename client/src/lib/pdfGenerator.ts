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
  const headerHeight = 30; 
  const margin = 15; 

  // Add company header
  doc.setFontSize(14); 
  doc.setTextColor(26, 54, 93);
  doc.text("EVENTS & ENTERTAINMENT ENTERPRISES", pageWidth/2, 20, { align: 'center' });

  doc.setFontSize(12); 
  doc.text("PURCHASE REQUEST", pageWidth/2, 27, { align: 'center' });

  // Add request number and date
  doc.setFontSize(9); 
  doc.setTextColor(90, 90, 90);
  doc.text(`Request No: ${request.requestNumber}`, margin, 20);
  doc.text(`Date: ${new Date(request.createdAt).toLocaleDateString()}`, pageWidth - margin, 20, { align: 'right' });

  return headerHeight;
}

function addFooter(doc: jsPDF, currentPage: number, totalPages: number): void {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("ALL RIGHTS RESERVED BY E3", margin, pageHeight - 10);
  doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
}

function addSection(doc: jsPDF, title: string, yPos: number): number {
  const margin = 15;
  doc.setFillColor(247, 248, 250);
  doc.rect(margin, yPos, doc.internal.pageSize.width - (2 * margin), 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10); 
  doc.setTextColor(26, 54, 93);
  doc.text(title, margin + 2, yPos + 4.5);

  return yPos + 8;
}

export async function generateRequestPDF(request: any) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const margin = 15; 
    let yPos = addHeader(doc, request);

    // Basic Information Section - Combined with Purpose Info for space efficiency
    yPos = addSection(doc, "Basic & Purpose Information", yPos);

    const basicInfo = [
      [
        { content: 'Title:', styles: { fontStyle: 'bold' } },
        { content: request.title || 'N/A', colSpan: 3 }
      ],
      [
        { content: 'Status:', styles: { fontStyle: 'bold' } },
        { content: request.status?.toUpperCase() || 'N/A' },
        { content: 'Priority:', styles: { fontStyle: 'bold' } },
        { content: request.priority?.toUpperCase() || 'N/A' }
      ],
      [
        { content: 'Purpose Type:', styles: { fontStyle: 'bold' } },
        { content: request.purposeType || 'N/A' },
        { content: 'Sub-purpose:', styles: { fontStyle: 'bold' } },
        { content: request.subPurpose?.name || 'N/A' }
      ],
      [
        { content: 'Description:', styles: { fontStyle: 'bold' } },
        { content: request.description || 'N/A', colSpan: 3 }
      ]
    ];

    autoTable(doc, {
      startY: yPos,
      body: basicInfo,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Vendor Information Section
    yPos = addSection(doc, "Vendor Information", yPos);
    const vendorInfo = [
      [
        { content: 'Vendor Name:', styles: { fontStyle: 'bold' } },
        { content: request.vendor?.name || 'N/A' },
        { content: 'Contact Person:', styles: { fontStyle: 'bold' } },
        { content: request.vendor?.contactPerson || 'N/A' }
      ],
      [
        { content: 'Email:', styles: { fontStyle: 'bold' } },
        { content: request.vendor?.email || 'N/A' },
        { content: 'Phone:', styles: { fontStyle: 'bold' } },
        { content: request.vendor?.phone || 'N/A' }
      ]
    ];

    autoTable(doc, {
      startY: yPos,
      body: vendorInfo,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Items Section
    yPos = addSection(doc, "Items", yPos);
    const items = Array.isArray(request.items) ? request.items : JSON.parse(request.items || '[]');

    // Calculate totals
    const itemsTotal = items.reduce((sum: number, item: any) => 
      sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)), 0
    );
    const freightAmount = Number(request.freightAmount || 0);
    const totalCost = itemsTotal + freightAmount;

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: request.currency || 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']],
      body: items.map((item: any) => [
        item.name || 'N/A',
        item.description || 'N/A',
        item.quantity?.toString() || '0',
        formatCurrency(item.estimatedCost || 0),
        formatCurrency((item.quantity || 0) * (item.estimatedCost || 0))
      ]),
      foot: [
        ['', '', '', 'Items Total:', formatCurrency(itemsTotal)],
        ['', '', '', 'Freight:', formatCurrency(freightAmount)],
        ['', '', '', 'Total Cost:', formatCurrency(totalCost)]
      ],
      theme: 'striped',
      headStyles: {
        fillColor: [247, 248, 250],
        textColor: [26, 54, 93],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 2
      },
      footStyles: {
        fillColor: [247, 248, 250],
        textColor: [26, 54, 93],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2
      },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

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
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2
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