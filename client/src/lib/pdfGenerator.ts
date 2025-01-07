import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [113, 86, 158];
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

function addHeader(doc: jsPDF): number {
  const pageWidth = doc.internal.pageSize.width;
  const headerHeight = 70;
  const margin = 25;

  // Add a simple gradient header
  const steps = 25;
  const stepHeight = headerHeight / steps;
  const rgbColor = hexToRgb('#71569E');

  for (let i = 0; i < steps; i++) {
    const opacity = Math.max(0.1, 0.7 - (i * 0.025));
    doc.saveGraphicsState();
    doc.setFillColor(...rgbColor);
    doc.setGState(new doc.GState({ opacity }));
    doc.rect(0, i * stepHeight, pageWidth, stepHeight, 'F');
    doc.restoreGraphicsState();
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Purchase Request", margin, 40);

  return headerHeight;
}

function addFooter(doc: jsPDF): number {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const footerHeight = 45;
  const footerY = pageHeight - footerHeight;
  const margin = 25;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, footerY + 25);

  const pageInfo = `Page ${doc.getCurrentPageInfo().pageNumber}`;
  const pageInfoWidth = doc.getTextWidth(pageInfo);
  doc.text(pageInfo, pageWidth - margin - pageInfoWidth, footerY + 25);

  return footerHeight;
}

export async function generateRequestPDF(request: any) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 25;
    const contentWidth = pageWidth - (2 * margin);

    // Add header and footer
    const headerHeight = addHeader(doc);
    let yPos = headerHeight + 15;

    // Request Purpose & Priority Section
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 35, 2, 2, 'F');

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("Request Purpose & Priority", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Purpose Type: ${request.purposeType || 'N/A'}`, margin + 10, yPos + 25);
    doc.text(`Sub-purpose: ${request.subPurpose?.name || 'N/A'}`, margin + contentWidth/2, yPos + 25);

    yPos += 45;

    // Basic Information Section
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 40, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text("Basic Information", margin + 10, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.text(`Request Title: ${request.title || 'N/A'}`, margin + 10, yPos + 25);

    const descriptionLines = doc.splitTextToSize(
      `Description: ${request.description || 'N/A'}`,
      contentWidth - 20
    );
    descriptionLines.slice(0, 2).forEach((line: string, index: number) => {
      doc.text(line, margin + 10, yPos + 25 + ((index + 1) * 10));
    });

    yPos += 50;

    // Items Section
    doc.setFont('helvetica', 'bold');
    doc.text("Items", margin, yPos + 10);

    const items = (request.items || []).map((item: any) => [
      item.name || 'N/A',
      item.quantity?.toString() || '0',
      formatCurrency(item.estimatedCost || 0, request.currency),
      formatCurrency((item.quantity || 0) * (item.estimatedCost || 0), request.currency)
    ]);

    const freightAmount = request.freightAmount || 0;
    const itemsTotal = calculateTotalCost(request);
    const totalCost = itemsTotal + freightAmount;

    autoTable(doc, {
      startY: yPos + 20,
      head: [['Item', 'Quantity', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Items Total:', formatCurrency(itemsTotal, request.currency)],
        ['', '', 'Freight Amount:', formatCurrency(freightAmount, request.currency)],
        ['', '', 'Total Cost:', formatCurrency(totalCost, request.currency)]
      ],
      headStyles: {
        fillColor: [248, 249, 250],
        textColor: [60, 60, 60],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      footStyles: {
        fillColor: [248, 249, 250],
        textColor: [60, 60, 60],
        fontSize: 11,
        fontStyle: 'bold',
        cellPadding: 6
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 5,
        textColor: [60, 60, 60]
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      },
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        cellWidth: 'auto',
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
        font: 'helvetica',
        halign: 'left'
      }
    });

    // Add footer
    addFooter(doc);
    console.log('PDF generation completed successfully');

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