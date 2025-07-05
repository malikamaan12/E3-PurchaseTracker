import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseRequestWithRelations } from '../types/requests';

/**
 * Generate PDF matching the exact design specification
 */
export async function generateDesignMatchedPdf(
  request: PurchaseRequestWithRelations,
  pdfSettings: any
): Promise<{ pdfBlob: Blob; trackingId: string }> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Get margins from settings
  const marginLeft = pdfSettings?.marginLeft || 15;
  const marginRight = pdfSettings?.marginRight || 15;
  const marginTop = pdfSettings?.marginTop || 20;
  
  let currentY = marginTop;
  
  // Add header with logo and title
  await addHeader(doc, currentY, pageWidth, marginLeft, marginRight, pdfSettings);
  currentY += 60; // Space for header
  
  // Add PR number and date in top right
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`PR #${request.requestNumber || ''}`, pageWidth - marginRight - 30, currentY);
  doc.text(`Date: ${formatDate(request.createdAt)}`, pageWidth - marginRight - 30, currentY + 5);
  
  currentY += 20;
  
  // Add basic requester info table
  currentY = await addBasicInfoSection(doc, request, currentY, marginLeft, marginRight, pageWidth);
  
  // Add BASIC INFORMATION section
  currentY = await addSectionWithTable(doc, 'BASIC INFORMATION', [
    ['Title:', request.title || 'N/A', 'Sub-purpose:', request.subPurpose?.name || 'N/A'],
    ['Description:', request.description || 'N/A', '', ''],
    ['Purpose Type:', request.purposeType || 'N/A', '', ''],
    ['Contact Info:', `Email: ${(request.requester as any)?.email || 'N/A'}`, '', '']
  ], currentY, marginLeft, marginRight, pageWidth);
  
  // Add VENDOR INFORMATION section
  currentY = await addSectionWithTable(doc, 'VENDOR INFORMATION', [
    ['Vendor Name:', request.vendor?.name || 'N/A', 'Contact Person:', request.vendor?.contactPerson || 'N/A'],
    ['Email:', request.vendor?.email || 'N/A', 'Phone:', request.vendor?.phone || 'N/A']
  ], currentY, marginLeft, marginRight, pageWidth);
  
  // Add ITEMS section
  currentY = await addItemsSection(doc, request, currentY, marginLeft, marginRight, pageWidth);
  
  // Add ATTACHED DOCUMENTS section
  currentY = await addAttachmentsSection(doc, request, currentY, marginLeft, marginRight, pageWidth);
  
  // Add APPROVAL INFORMATION section
  currentY = await addApprovalSection(doc, request, currentY, marginLeft, marginRight, pageWidth);
  
  // Add footer
  await addFooter(doc, 1, 1, pdfSettings);
  
  const pdfBlob = doc.output('blob');
  const trackingId = `PDF-${request.id}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  
  return { pdfBlob, trackingId };
}

async function addHeader(doc: jsPDF, startY: number, pageWidth: number, marginLeft: number, marginRight: number, pdfSettings: any) {
  // Add E3 logo and company name
  doc.setFillColor(111, 42, 230); // E3 purple
  doc.roundedRect(marginLeft, startY, 15, 25, 2, 2, 'F');
  
  doc.setFillColor(31, 211, 219); // E3 teal
  doc.roundedRect(marginLeft + 15, startY, 15, 10, 2, 2, 'F');
  
  // Add E3 text
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("E3", marginLeft + 6, startY + 15);
  
  // Add company name
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text("EVENTS &", marginLeft + 35, startY + 8);
  doc.text("ENTERTAINMENT", marginLeft + 35, startY + 15);
  doc.text("ENTERPRISES", marginLeft + 35, startY + 22);
  
  // Add gradient bar on right
  doc.setFillColor(111, 42, 230);
  doc.roundedRect(pageWidth - marginRight - 60, startY, 30, 25, 2, 2, 'F');
  doc.setFillColor(31, 211, 219);
  doc.roundedRect(pageWidth - marginRight - 30, startY, 30, 25, 2, 2, 'F');
  
  // Add PURCHASE REQUEST title
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text("PURCHASE REQUEST", marginLeft, startY + 40);
}

async function addBasicInfoSection(doc: jsPDF, request: PurchaseRequestWithRelations, startY: number, marginLeft: number, marginRight: number, pageWidth: number): Promise<number> {
  // Simple requester info table
  autoTable(doc, {
    startY: startY,
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0] 
    },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 25 }, 
      1: { cellWidth: 'auto' },
      2: { fontStyle: 'bold', cellWidth: 25 }, 
      3: { cellWidth: 'auto' }
    },
    margin: { left: marginLeft, right: marginRight },
    body: [
      ['Requester:', request.requester?.username || 'N/A', 'Department:', request.requester?.department || 'N/A'],
      ['Status:', request.status?.toUpperCase() || 'N/A', 'Priority:', request.priority?.toUpperCase() || 'N/A']
    ]
  });
  
  return (doc as any).lastAutoTable.finalY + 15;
}

async function addSectionWithTable(doc: jsPDF, title: string, tableData: string[][], startY: number, marginLeft: number, marginRight: number, pageWidth: number): Promise<number> {
  // Add section header with black background
  doc.setFillColor(0, 0, 0);
  doc.rect(marginLeft, startY, pageWidth - marginLeft - marginRight, 7, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(title, marginLeft + 2, startY + 5);
  
  // Add table
  autoTable(doc, {
    startY: startY + 10,
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0] 
    },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 25 }, 
      1: { cellWidth: 'auto' },
      2: { fontStyle: 'bold', cellWidth: 25 }, 
      3: { cellWidth: 'auto' }
    },
    margin: { left: marginLeft, right: marginRight },
    body: tableData
  });
  
  return (doc as any).lastAutoTable.finalY + 15;
}

async function addItemsSection(doc: jsPDF, request: PurchaseRequestWithRelations, startY: number, marginLeft: number, marginRight: number, pageWidth: number): Promise<number> {
  // Section header
  doc.setFillColor(0, 0, 0);
  doc.rect(marginLeft, startY, pageWidth - marginLeft - marginRight, 7, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMS', marginLeft + 2, startY + 5);
  
  // Items table
  const itemsData = request.items?.map(item => [
    item.name || 'N/A',
    item.description || 'N/A',
    item.quantity?.toString() || '1',
    `${request.currency || 'QAR'} ${item.estimatedCost || 0}`,
    `${request.currency || 'QAR'} ${(item.estimatedCost || 0) * (item.quantity || 1)}`
  ]) || [];
  
  autoTable(doc, {
    startY: startY + 10,
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0] 
    },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 25 }, 
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15 }, 
      3: { cellWidth: 25 },
      4: { cellWidth: 25 }
    },
    head: [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']],
    body: itemsData,
    margin: { left: marginLeft, right: marginRight }
  });
  
  return (doc as any).lastAutoTable.finalY + 15;
}

async function addAttachmentsSection(doc: jsPDF, request: PurchaseRequestWithRelations, startY: number, marginLeft: number, marginRight: number, pageWidth: number): Promise<number> {
  // Section header
  doc.setFillColor(0, 0, 0);
  doc.rect(marginLeft, startY, pageWidth - marginLeft - marginRight, 7, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTACHED DOCUMENTS', marginLeft + 2, startY + 5);
  
  // Attachments table
  const attachmentsData = request.attachments?.map(attachment => [
    attachment.fileName || 'N/A',
    attachment.fileType || 'N/A',
    formatFileSize(attachment.fileSize || 0)
  ]) || [];
  
  autoTable(doc, {
    startY: startY + 10,
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0] 
    },
    columnStyles: { 
      0: { cellWidth: 'auto' }, 
      1: { cellWidth: 30 },
      2: { cellWidth: 25 }
    },
    head: [['Document Name', 'Type', 'Size']],
    body: attachmentsData,
    margin: { left: marginLeft, right: marginRight }
  });
  
  return (doc as any).lastAutoTable.finalY + 15;
}

async function addApprovalSection(doc: jsPDF, request: PurchaseRequestWithRelations, startY: number, marginLeft: number, marginRight: number, pageWidth: number): Promise<number> {
  // Section header
  doc.setFillColor(0, 0, 0);
  doc.rect(marginLeft, startY, pageWidth - marginLeft - marginRight, 7, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('APPROVAL INFORMATION', marginLeft + 2, startY + 5);
  
  // Approval table
  const approvalData = request.approvals?.map(approval => [
    approval.approver?.username || 'N/A',
    (approval.approver as any)?.department || 'N/A',
    approval.status?.toUpperCase() || 'PENDING',
    formatDate((approval as any).createdAt),
    approval.comments || 'N/A'
  ]) || [];
  
  autoTable(doc, {
    startY: startY + 10,
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0] 
    },
    columnStyles: { 
      0: { cellWidth: 25 }, 
      1: { cellWidth: 25 },
      2: { cellWidth: 20 },
      3: { cellWidth: 25 },
      4: { cellWidth: 'auto' }
    },
    head: [['Approver', 'Department', 'Status', 'Date', 'Comments']],
    body: approvalData,
    margin: { left: marginLeft, right: marginRight }
  });
  
  return (doc as any).lastAutoTable.finalY + 15;
}

async function addFooter(doc: jsPDF, currentPage: number, totalPages: number, pdfSettings: any) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  // Company info
  const companyInfo = `Phone: ${pdfSettings?.companyPhone || ''} | Email: ${pdfSettings?.companyEmail || ''} | Web: ${pdfSettings?.companyWebsite || ''}`;
  doc.text(companyInfo, 15, pageHeight - 15);
  
  // Page number
  doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - 30, pageHeight - 15);
  
  // Address
  doc.text(pdfSettings?.companyAddress || '', 15, pageHeight - 10);
  
  // Footer text
  doc.text(pdfSettings?.footerText || '', pageWidth / 2, pageHeight - 5, { align: 'center' });
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-GB');
  } catch (e) {
    return 'N/A';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}