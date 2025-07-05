import { jsPDF } from 'jspdf';
import { PurchaseRequestWithRelations } from '../types/requests';
import { applyPdfWatermark, applySecurityWatermark, generatePdfTrackingId, logPdfAuditEvent } from './pdfAuditUtils';

/**
 * Simple PDF Generator without autoTable dependency
 * Uses basic jsPDF text positioning to create tables
 */

type RGBColor = [number, number, number];

function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [0, 0, 0];
  }
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return [r/255, g/255, b/255];
}

function addSimpleTable(
  doc: jsPDF,
  data: string[][],
  startY: number,
  options: {
    fontSize?: number;
    textColor?: RGBColor;
    headerColor?: RGBColor;
    marginLeft?: number;
    marginRight?: number;
    columnWidths?: number[];
  } = {}
): number {
  const {
    fontSize = 10,
    textColor = [0, 0, 0],
    headerColor = [0.4, 0.4, 0.4],
    marginLeft = 20,
    marginRight = 20,
    columnWidths = []
  } = options;

  if (!data || data.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.width;
  const availableWidth = pageWidth - marginLeft - marginRight;
  
  // Calculate column widths
  const numColumns = data[0].length;
  const defaultColumnWidth = availableWidth / numColumns;
  const colWidths = columnWidths.length === numColumns 
    ? columnWidths 
    : new Array(numColumns).fill(defaultColumnWidth);

  doc.setFontSize(fontSize);
  let currentY = startY;
  const rowHeight = fontSize * 1.5;

  data.forEach((row, rowIndex) => {
    // Check if we need a new page
    if (currentY + rowHeight > doc.internal.pageSize.height - 30) {
      doc.addPage();
      currentY = 30;
    }

    // Set colors for header row
    if (rowIndex === 0) {
      doc.setTextColor(headerColor[0] * 255, headerColor[1] * 255, headerColor[2] * 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(textColor[0] * 255, textColor[1] * 255, textColor[2] * 255);
      doc.setFont('helvetica', 'normal');
    }

    let currentX = marginLeft;
    row.forEach((cell, colIndex) => {
      const cellText = cell || '';
      const maxWidth = colWidths[colIndex] - 5; // 5pt padding
      
      // Simple text wrapping
      const lines = doc.splitTextToSize(cellText, maxWidth);
      
      if (Array.isArray(lines)) {
        lines.forEach((line: string, lineIndex: number) => {
          doc.text(line, currentX + 2, currentY + (lineIndex * fontSize * 1.2));
        });
      } else {
        doc.text(lines, currentX + 2, currentY);
      }
      
      currentX += colWidths[colIndex];
    });

    currentY += rowHeight;
  });

  return currentY + 10;
}

export async function generateSimplePDF(
  request: PurchaseRequestWithRelations,
  type: 'purchase' | 'full' = 'purchase'
): Promise<{ success: boolean; blob?: Blob; error?: string; trackingId: string }> {
  const trackingId = generatePdfTrackingId(request.id, type);
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let currentY = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(111, 42, 230); // E3 purple
    doc.text('EVENTS & ENTERTAINMENT ENTERPRISES', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    doc.setFontSize(16);
    doc.text('PURCHASE REQUEST', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    // Request Information
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Request Information', 20, currentY);
    currentY += 10;

    const requestData = [
      ['Field', 'Value'],
      ['Request Number', request.requestNumber || 'N/A'],
      ['Title', request.title || 'N/A'],
      ['Status', request.status || 'N/A'],
      ['Priority', request.priority || 'N/A'],
      ['Currency', request.currency || 'N/A'],
      ['Total Cost', `${request.totalEstimatedCost || 0}`],
      ['Freight Amount', `${request.freightAmount || 0}`],
      ['Created Date', request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A']
    ];

    currentY = addSimpleTable(doc, requestData, currentY, {
      fontSize: 10,
      textColor: [0, 0, 0],
      headerColor: [0.4, 0.4, 0.4],
      marginLeft: 20,
      marginRight: 20,
      columnWidths: [80, 110]
    });

    // Description
    if (request.description) {
      currentY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Description', 20, currentY);
      currentY += 8;
      
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(request.description, pageWidth - 40);
      doc.text(descLines, 20, currentY);
      currentY += (Array.isArray(descLines) ? descLines.length : 1) * 6 + 10;
    }

    // Items
    if (request.items && request.items.length > 0) {
      currentY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Items', 20, currentY);
      currentY += 10;

      const itemsData: string[][] = [
        ['Item', 'Quantity', 'Description', 'Cost'],
        ...request.items.map((item: any) => [
          item.name || 'N/A',
          item.quantity?.toString() || '0',
          item.description || 'N/A',
          item.estimatedCost?.toString() || '0'
        ])
      ];

      currentY = addSimpleTable(doc, itemsData, currentY, {
        fontSize: 9,
        textColor: [0, 0, 0],
        headerColor: [0.4, 0.4, 0.4],
        marginLeft: 20,
        marginRight: 20,
        columnWidths: [40, 25, 80, 25]
      });
    }

    // Requester Information
    if (request.requester) {
      currentY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Requester Information', 20, currentY);
      currentY += 10;

      const requesterData = [
        ['Field', 'Value'],
        ['Name', request.requester.username || 'N/A'],
        ['Department', request.requester.department || 'N/A'],
        ['Email', request.requester.email || 'N/A'],
        ['Contact Number', request.requester.contactNumber || 'N/A']
      ];

      currentY = addSimpleTable(doc, requesterData, currentY, {
        fontSize: 10,
        textColor: [0, 0, 0],
        headerColor: [0.4, 0.4, 0.4],
        marginLeft: 20,
        marginRight: 20,
        columnWidths: [80, 110]
      });
    }

    // Vendor Information
    if (request.vendor) {
      currentY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Vendor Information', 20, currentY);
      currentY += 10;

      const vendorData = [
        ['Field', 'Value'],
        ['Company Name', request.vendor.companyName || 'N/A'],
        ['Contact Person', request.vendor.contactPerson || 'N/A'],
        ['Email', request.vendor.email || 'N/A'],
        ['Contact Number', request.vendor.contactNumber || 'N/A'],
        ['Address', request.vendor.address || 'N/A']
      ];

      currentY = addSimpleTable(doc, vendorData, currentY, {
        fontSize: 10,
        textColor: [0, 0, 0],
        headerColor: [0.4, 0.4, 0.4],
        marginLeft: 20,
        marginRight: 20,
        columnWidths: [80, 110]
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} | Tracking ID: ${trackingId}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Convert to blob
    const pdfBlob = doc.output('blob');
    
    // Log success
    try {
      await logPdfAuditEvent({
        requestId: request.id,
        action: 'pdf_generated',
        success: true,
        fileName: `purchase-request-${request.id}.pdf`,
        fileSize: pdfBlob.size,
        trackingId
      });
    } catch (auditError) {
      console.warn('Failed to log PDF audit event:', auditError);
    }

    return { success: true, blob: pdfBlob, trackingId };
    
  } catch (error) {
    console.error('PDF Generation Error:', error);
    
    // Log failure
    try {
      await logPdfAuditEvent({
        requestId: request.id,
        action: 'pdf_generated',
        success: false,
        fileName: `failed-pdf-export.pdf`,
        fileSize: 0,
        trackingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (auditError) {
      console.warn('Failed to log PDF audit event:', auditError);
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      trackingId 
    };
  }
}