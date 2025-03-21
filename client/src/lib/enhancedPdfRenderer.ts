/**
 * Enhanced PDF Renderer
 * 
 * This file provides improved PDF rendering with consistent handling of:
 * - Header titles
 * - Watermarks
 * - Content/section visibility
 * - Footer content
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfTemplateSettings, TemplateConfig, hexToRgb } from './pdfTemplateSettings';
import { PurchaseRequestWithRelations } from '@/types/requests';

interface RenderOptions {
  includeAttachments?: boolean;
  includeSignatures?: boolean;
  securityLevel?: 'public' | 'internal' | 'confidential';
}

/**
 * Generate a PDF from a purchase request
 */
export async function generateEnhancedPdf(
  request: PurchaseRequestWithRelations,
  settings: PdfTemplateSettings,
  options: RenderOptions = {}
): Promise<ArrayBuffer> {
  try {
    // Parse template config if it's a string
    const templateConfig = typeof settings.templateConfig === 'string'
      ? JSON.parse(settings.templateConfig)
      : settings.templateConfig;
    
    // Determine orientation
    const orientation = templateConfig?.layout === 'landscape' ? 'landscape' : 'portrait';
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });
    
    // Setup document properties
    const margins = {
      top: settings.marginTop || 20,
      bottom: settings.marginBottom || 20,
      left: settings.marginLeft || 25,
      right: settings.marginRight || 25,
    };
    
    // Set base font size
    const fontSize = settings.fontSize || 11;
    doc.setFontSize(fontSize);
    
    // Track current y position
    let yPos = margins.top;
    
    // Add header if enabled
    if (templateConfig?.showHeader !== false) {
      yPos = await addHeader(doc, request, settings, templateConfig, margins);
    }
    
    // Add watermark if enabled
    if (templateConfig?.showWatermark) {
      addWatermark(doc, templateConfig);
    }
    
    // Add request details
    yPos = addRequestDetails(doc, request, yPos, margins);
    
    // Add items table
    yPos = addItemsTable(doc, request, yPos, margins);
    
    // Add totals if enabled
    if (templateConfig?.showTotalsTable !== false) {
      yPos = addTotalsSection(doc, request, yPos, margins);
    }
    
    // Add approvals section if enabled
    if (templateConfig?.showApprovalFlow !== false) {
      yPos = addApprovalsSection(doc, request, yPos, margins, templateConfig);
    }
    
    // Add signature lines if enabled
    if (templateConfig?.showSignatureLines !== false && options.includeSignatures !== false) {
      yPos = addSignatureSection(doc, request, yPos, margins);
    }
    
    // Add attachments if enabled
    if (templateConfig?.showAttachments !== false && options.includeAttachments !== false) {
      yPos = addAttachmentsSection(doc, request, yPos, margins);
    }
    
    // Add footer if enabled
    if (templateConfig?.showFooter !== false) {
      addFooter(doc, settings, templateConfig, margins);
    }
    
    // If page numbering is enabled, add page numbers
    if (settings.pageNumbering) {
      addPageNumbers(doc);
    }
    
    // Return PDF as a Uint8Array
    return doc.output('arraybuffer');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Add header to the PDF
 */
async function addHeader(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  settings: PdfTemplateSettings,
  templateConfig: TemplateConfig,
  margins: { top: number; bottom: number; left: number; right: number }
): Promise<number> {
  // Get header height or use default
  const headerHeight = settings.headerHeight || 40;
  
  // Get the header color
  const headerColor = settings.headerColor ? hexToRgb(settings.headerColor) : [111/255, 42/255, 230/255];
  
  // Create header background
  doc.setFillColor(headerColor[0] * 255, headerColor[1] * 255, headerColor[2] * 255);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), headerHeight, 'F');
  
  // Add company logo if enabled
  if (templateConfig.showLogo) {
    // Logo would be added here if available
    // This is a placeholder for logo implementation
  }
  
  // Add header text
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  
  // Center the header title
  const titleWidth = doc.getStringUnitWidth(settings.headerTitle) * 16 / doc.internal.scaleFactor;
  const titleX = (doc.internal.pageSize.getWidth() - titleWidth) / 2;
  doc.text(settings.headerTitle, titleX, 15);
  
  // Add subtitle if available
  if (settings.headerSubtitle) {
    doc.setFontSize(12);
    const subtitleWidth = doc.getStringUnitWidth(settings.headerSubtitle) * 12 / doc.internal.scaleFactor;
    const subtitleX = (doc.internal.pageSize.getWidth() - subtitleWidth) / 2;
    doc.text(settings.headerSubtitle, subtitleX, 25);
  }
  
  // Reset text color and font
  doc.setTextColor(0, 0, 0); // Black text
  doc.setFontSize(settings.fontSize || 11);
  doc.setFont('helvetica', 'normal');
  
  return headerHeight + 10; // Return next Y position
}

/**
 * Add watermark to the PDF
 */
function addWatermark(doc: jsPDF, templateConfig: TemplateConfig): void {
  if (!templateConfig.watermarkText) return;
  
  // Configure watermark
  const opacity = templateConfig.watermarkOpacity || 0.08;
  const text = templateConfig.watermarkText;
  
  // Save current state
  doc.saveGraphicsState();
  
  // Set watermark properties
  doc.setTextColor(0, 0, 0);
  doc.setGState(new doc.GState({ opacity }));
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  
  // Center the watermark and rotate
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.translate(pageWidth / 2, pageHeight / 2);
  doc.rotate(-45);
  
  const textWidth = doc.getStringUnitWidth(text) * 60 / doc.internal.scaleFactor;
  doc.text(text, -textWidth / 2, 0);
  
  // Restore state
  doc.restoreGraphicsState();
  
  // Reset text properties
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
}

/**
 * Add request details section
 */
function addRequestDetails(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  yPos: number,
  margins: { top: number; bottom: number; left: number; right: number }
): number {
  // Set section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Request Details', margins.left, yPos);
  yPos += 8;
  
  // Reset font
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Define details to display
  const details = [
    { label: 'Request Number', value: request.requestNumber || '-' },
    { label: 'Created By', value: request.requester?.username || '-' },
    { label: 'Department', value: request.requester?.department || '-' },
    { label: 'Status', value: request.status },
    { label: 'Priority', value: request.priority },
    { label: 'Purpose', value: request.subPurpose?.name || request.purposeType || '-' },
    { label: 'Vendor', value: request.vendor?.companyName || request.vendor?.name || '-' },
    { label: 'Created Date', value: formatDate(request.createdAt) },
  ];
  
  // Create two columns
  const colWidth = (doc.internal.pageSize.getWidth() - margins.left - margins.right) / 2;
  
  // Arrange in two columns
  details.forEach((detail, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const xPos = margins.left + (col * colWidth);
    const rowYPos = yPos + (row * 6);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${detail.label}:`, xPos, rowYPos);
    doc.setFont('helvetica', 'normal');
    doc.text(detail.value, xPos + 30, rowYPos);
  });
  
  // Calculate next Y position
  yPos += Math.ceil(details.length / 2) * 6 + 10;
  
  // Add description
  doc.setFont('helvetica', 'bold');
  doc.text('Description:', margins.left, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  
  // Handle multiline description
  const description = request.description || 'No description provided';
  const splitDescription = doc.splitTextToSize(
    description, 
    doc.internal.pageSize.getWidth() - margins.left - margins.right
  );
  
  doc.text(splitDescription, margins.left, yPos);
  yPos += (splitDescription.length * 6) + 10;
  
  return yPos;
}

/**
 * Add items table to the PDF
 */
function addItemsTable(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  yPos: number,
  margins: { top: number; bottom: number; left: number; right: number }
): number {
  // Set section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Requested Items', margins.left, yPos);
  yPos += 8;
  
  // Prepare table data
  const tableHeaders = [['#', 'Item', 'Description', 'Quantity', 'Unit Cost', 'Total']];
  
  const tableData = request.items?.map((item, index) => [
    (index + 1).toString(),
    item.name,
    item.description || '-',
    item.quantity.toString(),
    formatCurrency(item.estimatedCost),
    formatCurrency(item.estimatedCost * item.quantity)
  ]) || [];
  
  // Add the table
  autoTable(doc, {
    startY: yPos,
    head: tableHeaders,
    body: tableData,
    margin: { left: margins.left, right: margins.right },
    headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    columnStyles: {
      0: { cellWidth: 10 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' }
    }
  });
  
  // Get final Y position after table
  // @ts-ignore - lastAutoTable is not in the type definitions but exists
  return doc.lastAutoTable.finalY + 10;
}

/**
 * Add totals section to the PDF
 */
function addTotalsSection(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  yPos: number,
  margins: { top: number; bottom: number; left: number; right: number }
): number {
  // Calculate totals
  const subtotal = request.items?.reduce((sum, item) => sum + (item.estimatedCost * item.quantity), 0) || 0;
  const freight = request.freightAmount || 0;
  const total = subtotal + freight;
  
  // Define totals data
  const totalsData = [
    ['Subtotal', formatCurrency(subtotal)],
    ['Freight', formatCurrency(freight)],
    ['Total', formatCurrency(total)]
  ];
  
  // Add the totals table
  autoTable(doc, {
    startY: yPos,
    body: totalsData,
    margin: { left: doc.internal.pageSize.getWidth() - margins.right - 100, right: margins.right },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 50, halign: 'right' }
    }
  });
  
  // Get final Y position after table
  // @ts-ignore - lastAutoTable is not in the type definitions but exists
  return doc.lastAutoTable.finalY + 10;
}

/**
 * Add approvals section to the PDF
 */
function addApprovalsSection(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  yPos: number,
  margins: { top: number; bottom: number; left: number; right: number },
  templateConfig: TemplateConfig
): number {
  // Set section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Approval Status', margins.left, yPos);
  yPos += 8;
  
  // Prepare table data
  const tableHeaders = [['Department', 'Status', 'Approver', 'Comments', 'Date']];
  
  const tableData = request.approvals?.map(approval => [
    approval.department,
    approval.status,
    approval.approver?.username || '-',
    approval.comments || '-',
    approval.processedAt ? formatDate(approval.processedAt) : '-'
  ]) || [];
  
  // Add the table
  autoTable(doc, {
    startY: yPos,
    head: tableHeaders,
    body: tableData,
    margin: { left: margins.left, right: margins.right },
    headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
    columnStyles: {
      1: { 
        cellWidth: 20,
        fontStyle: 'bold',
        halign: 'center',
        fillColor: (row, data) => {
          const status = data.raw[1];
          if (status === 'approved') return [160, 223, 160];
          if (status === 'rejected') return [255, 180, 180];
          if (status === 'pending') return [255, 235, 156];
          return [240, 240, 240];
        }
      }
    }
  });
  
  // Get final Y position after table
  // @ts-ignore - lastAutoTable is not in the type definitions but exists
  return doc.lastAutoTable.finalY + 10;
}

/**
 * Add signature section to the PDF
 */
function addSignatureSection(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  yPos: number,
  margins: { top: number; bottom: number; left: number; right: number }
): number {
  // Set section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Signatures', margins.left, yPos);
  yPos += 10;
  
  // Reset font
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Get approvers who need to sign
  const approvers = request.approvals
    ?.filter(approval => approval.status === 'approved' || approval.status === 'pending')
    .map(approval => approval.department) || [];
  
  // Add signature lines
  const lineWidth = 70;
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - margins.left - margins.right;
  const signatureDivs = Math.min(3, approvers.length); // Maximum 3 signatures per row
  const spacing = (availableWidth - (lineWidth * signatureDivs)) / (signatureDivs + 1);
  
  // Create multiple rows if needed
  const rows = Math.ceil(approvers.length / 3);
  
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < Math.min(3, approvers.length - (row * 3)); i++) {
      const index = (row * 3) + i;
      const xPos = margins.left + spacing + (i * (lineWidth + spacing));
      const title = approvers[index] || `Approver ${index + 1}`;
      
      // Add signature line
      doc.setDrawColor(0);
      doc.line(xPos, yPos + 10, xPos + lineWidth, yPos + 10);
      
      // Add title below line
      doc.text(title, xPos, yPos + 15);
    }
    
    yPos += 25; // Move to next row
  }
  
  return yPos + 10;
}

/**
 * Add attachments section to the PDF
 */
function addAttachmentsSection(
  doc: jsPDF,
  request: PurchaseRequestWithRelations,
  yPos: number,
  margins: { top: number; bottom: number; left: number; right: number }
): number {
  if (!request.attachments || request.attachments.length === 0) {
    return yPos;
  }
  
  // Set section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Attachments', margins.left, yPos);
  yPos += 8;
  
  // Reset font
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // List attachments
  request.attachments.forEach((attachment, index) => {
    doc.text(`${index + 1}. ${attachment.fileName}`, margins.left, yPos);
    yPos += 6;
  });
  
  return yPos + 10;
}

/**
 * Add footer to the PDF
 */
function addFooter(
  doc: jsPDF,
  settings: PdfTemplateSettings,
  templateConfig: TemplateConfig,
  margins: { top: number; bottom: number; left: number; right: number }
): void {
  if (!settings.footerText) return;
  
  // Get footer height or use default
  const footerHeight = settings.footerHeight || 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Get the footer color
  const footerColor = settings.footerColor ? hexToRgb(settings.footerColor) : [111/255, 42/255, 230/255];
  
  // Create footer background
  doc.setFillColor(footerColor[0] * 255, footerColor[1] * 255, footerColor[2] * 255);
  doc.rect(0, pageHeight - footerHeight, doc.internal.pageSize.getWidth(), footerHeight, 'F');
  
  // Add footer text
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Center the footer text
  const textWidth = doc.getStringUnitWidth(settings.footerText) * 10 / doc.internal.scaleFactor;
  const textX = (doc.internal.pageSize.getWidth() - textWidth) / 2;
  doc.text(settings.footerText, textX, pageHeight - (footerHeight / 2));
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

/**
 * Add page numbers to the PDF
 */
function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageText = `Page ${i} of ${pageCount}`;
    
    // Add page number to bottom right
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    
    const textWidth = doc.getStringUnitWidth(pageText) * 9 / doc.internal.scaleFactor;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.text(pageText, pageWidth - 25, pageHeight - 10);
  }
}

/**
 * Format a date to a readable string
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString || '';
  }
}

/**
 * Format a number to a currency string
 */
function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  } catch (e) {
    return `$${amount.toFixed(2)}`;
  }
}