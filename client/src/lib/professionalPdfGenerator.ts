/**
 * Professional PDF Generator
 * Uses pre-made header/footer images with content in between
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { logPdfAuditEvent, generatePdfTrackingId } from './pdfAuditUtils';

// Helper: fetch an image URL and return base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Helper: parse hex color to RGB
function parseColor(colorHex: string): [number, number, number] {
  if (!colorHex || !colorHex.startsWith('#')) return [0, 0, 0];
  const hex = colorHex.substring(1);
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16)
  ];
}

// Layout constants (A4 in mm)
// Header & footer images are 1001×151 px → aspect ratio 6.629:1
// At 210 mm wide → height = 210/6.629 ≈ 31.7 mm
const PAGE_W = 210;
const PAGE_H = 297;
const HEADER_H = 32;   // matches 1001×151 px aspect ratio at A4 width
const FOOTER_H = 32;   // same image dimensions
const MARGIN = 14;
const CONTENT_TOP = HEADER_H + 6;         // content starts below header
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 6; // content ends above footer
const CONTENT_W = PAGE_W - MARGIN * 2;

// E3 brand colours
const PURPLE: [number, number, number] = [111, 42, 230];   // #6F2AE6
const TEAL:   [number, number, number] = [21,  211, 216];  // #15CDD8
const LIGHT_PURPLE_BG: [number, number, number] = [245, 240, 255]; // soft lavender

export async function generateProfessionalPdf(request: any, settings: any = {}): Promise<void> {
  await generateProfessionalPdfBlob(request, settings, true);
}

export async function generateProfessionalPdfBlob(
  request: any,
  settings: any = {},
  autoDownload = false
): Promise<Blob> {
  console.log('Generating PDF for request:', request.id);

  // Fetch header and footer images
  const [headerBase64, footerBase64] = await Promise.all([
    fetchImageAsBase64('/assets/pdf-header.png'),
    fetchImageAsBase64('/assets/pdf-footer.png'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;

  const textColor: [number, number, number] = [40, 40, 40];
  const baseFontSize = 9;

  let currentY = CONTENT_TOP;

  // ── Add header + footer images to a page ────────────────────────────────────
  const addPageImages = (pageNum: number) => {
    doc.setPage(pageNum);

    // Header image — full page width, top of page
    if (headerBase64) {
      doc.addImage(headerBase64, 'PNG', 0, 0, PAGE_W, HEADER_H);
    } else {
      // Fallback colour bar
      doc.setFillColor(111, 42, 230);
      doc.rect(0, 0, PAGE_W, HEADER_H, 'F');
    }

    // Footer image — full page width, bottom of page
    if (footerBase64) {
      doc.addImage(footerBase64, 'PNG', 0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H);
    } else {
      doc.setFillColor(111, 42, 230);
      doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, 'F');
    }

    // Page number (inside footer area)
    const totalPages = doc.internal.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const pageLabel = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageLabel, PAGE_W - MARGIN - doc.getTextWidth(pageLabel), PAGE_H - 6);
    doc.setTextColor(...textColor);
  };

  // ── Add a new page and immediately stamp header/footer ─────────────────────
  const addNewPage = () => {
    doc.addPage();
    currentY = CONTENT_TOP;
    // Images applied at end for all pages together
  };

  // ── Check if content fits; if not, start a new page ────────────────────────
  const ensureSpace = (height: number) => {
    if (currentY + height > CONTENT_BOTTOM) {
      addNewPage();
      return true;
    }
    return false;
  };

  // ── Section header bar (purple left block + teal right accent) ─────────────
  const drawSectionHeader = (title: string) => {
    ensureSpace(14);
    // Main purple bar
    doc.setFillColor(...PURPLE);
    doc.rect(MARGIN, currentY, CONTENT_W - 6, 6.5, 'F');
    // Teal accent cap on the right
    doc.setFillColor(...TEAL);
    doc.rect(MARGIN + CONTENT_W - 6, currentY, 6, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, MARGIN + 3, currentY + 4.5);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    currentY += 10;
  };

  // ── Label + value row helper ──────────────────────────────────────────────
  const drawRow = (label: string, value: string, x = MARGIN + 2, labelW = 28) => {
    ensureSpace(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(baseFontSize);
    doc.setTextColor(...textColor);
    doc.text(label, x, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(value || 'N/A', x + labelW, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. TITLE ROW  (PR number + date — inside content area, below header)
  // ══════════════════════════════════════════════════════════════════════════
  const prNumber = `PR #${request.id}`;
  const dateText = `Date: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`;

  // Purple title + PR number / date on the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PURPLE);
  doc.text('PURCHASE REQUEST', MARGIN, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(prNumber, PAGE_W - MARGIN - doc.getTextWidth(prNumber), currentY);
  currentY += 5;
  doc.setTextColor(100, 100, 100);
  doc.text(dateText, PAGE_W - MARGIN - doc.getTextWidth(dateText), currentY);
  currentY += 3;

  // Teal divider line
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
  currentY += 5;

  // ══════════════════════════════════════════════════════════════════════════
  // 2. REQUESTER INFO BOX
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...LIGHT_PURPLE_BG);
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, currentY, CONTENT_W, 17, 'FD'); // filled + border

  const leftX = MARGIN + 3;
  const rightX = MARGIN + CONTENT_W / 2 + 3;

  doc.setFontSize(baseFontSize);

  const labelClr: [number, number, number] = [111, 42, 230]; // purple labels
  const valueClr: [number, number, number] = [40, 40, 40];

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelClr);
  doc.text('Requester:', leftX, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...valueClr);
  doc.text(request.requester?.username || 'N/A', leftX + 22, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelClr);
  doc.text('Status:', leftX, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...valueClr);
  doc.text((request.status || 'PENDING').toUpperCase(), leftX + 22, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelClr);
  doc.text('Department:', rightX, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...valueClr);
  doc.text(request.requester?.department || 'N/A', rightX + 26, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelClr);
  doc.text('Priority:', rightX, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...valueClr);
  doc.text((request.priority || 'MEDIUM').toUpperCase(), rightX + 26, currentY + 12);

  doc.setTextColor(...textColor);
  currentY += 22;

  // ══════════════════════════════════════════════════════════════════════════
  // 3. BASIC INFORMATION
  // ══════════════════════════════════════════════════════════════════════════
  if (settings.showBasicInfo !== false) {
    drawSectionHeader('BASIC INFORMATION');

    doc.setFontSize(baseFontSize);
    doc.setTextColor(...textColor);

    // Title
    doc.setFont('helvetica', 'normal');
    doc.text('Title:', leftX, currentY);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(request.title || 'N/A', CONTENT_W - 20);
    doc.text(titleLines, leftX + 15, currentY);
    currentY += Math.max(5, titleLines.length * 4.5);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.text('Description:', leftX, currentY);
    const descLines = doc.splitTextToSize(request.description || 'No description', CONTENT_W - 28);
    doc.text(descLines, leftX + 28, currentY);
    currentY += Math.max(5, descLines.length * 4.5);

    // Purpose / Sub-purpose
    doc.setFont('helvetica', 'normal');
    doc.text('Purpose Type:', leftX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.purposeType || 'N/A', leftX + 28, currentY);

    doc.setFont('helvetica', 'normal');
    doc.text('Sub-purpose:', rightX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.subPurpose?.name || 'N/A', rightX + 26, currentY);
    currentY += 5;

    // Contact info
    if (request.requester?.email) {
      doc.setFont('helvetica', 'normal');
      doc.text('Contact:', leftX, currentY);
      doc.text(`Email: ${request.requester.email}`, leftX + 18, currentY);
      currentY += 5;
    }

    currentY += 4;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. VENDOR INFORMATION
  // ══════════════════════════════════════════════════════════════════════════
  if (settings.showVendorInfo !== false && request.vendor &&
      (request.vendor.companyName || request.vendor.name)) {
    drawSectionHeader('VENDOR INFORMATION');

    const vendorName = request.vendor.companyName || request.vendor.name;
    doc.setFontSize(baseFontSize);

    doc.setFont('helvetica', 'normal');
    doc.text('Vendor Name:', leftX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(vendorName, leftX + 26, currentY);

    doc.setFont('helvetica', 'normal');
    doc.text('Contact Person:', rightX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(request.vendor.contactPerson || 'N/A', rightX + 30, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.text('Email:', leftX, currentY);
    doc.text(request.vendor.email || 'N/A', leftX + 14, currentY);

    doc.text('Phone:', rightX, currentY);
    doc.text(request.vendor.contactNumber || 'N/A', rightX + 14, currentY);
    currentY += 10;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. ITEMS TABLE
  // ══════════════════════════════════════════════════════════════════════════
  if (settings.showItems !== false && request.items && request.items.length > 0) {
    ensureSpace(20 + request.items.length * 8);
    drawSectionHeader('ITEMS');

    const tableHead = [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']];
    const tableBody = request.items.map((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unit = Number(item.estimatedCost) || 0;
      return [
        item.name || 'N/A',
        item.description || '',
        qty.toString(),
        `${request.currency || 'QAR'} ${unit.toFixed(2)}`,
        `${request.currency || 'QAR'} ${(qty * unit).toFixed(2)}`
      ];
    });

    // @ts-ignore
    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: currentY,
      margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP, bottom: FOOTER_H + 5 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40], lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 62 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' }
      },
      alternateRowStyles: { fillColor: [245, 240, 255] }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 4;

    // Totals
    const itemsTotal = request.items.reduce((sum: number, item: any) =>
      sum + (Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0), 0);
    const freight = Number(request.freightAmount) || 0;
    const grandTotal = request.totalEstimatedCost || (itemsTotal + freight);
    const summaryX = PAGE_W - MARGIN - 65;

    ensureSpace(18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text('Items Total:', summaryX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${request.currency || 'QAR'} ${itemsTotal.toFixed(2)}`, summaryX + 30, currentY);
    currentY += 4;

    if (freight > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Freight:', summaryX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${request.currency || 'QAR'} ${freight.toFixed(2)}`, summaryX + 30, currentY);
      currentY += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Total Cost:', summaryX, currentY);
    doc.text(`${request.currency || 'QAR'} ${Number(grandTotal).toFixed(2)}`, summaryX + 30, currentY);
    currentY += 10;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. ATTACHMENTS
  // ══════════════════════════════════════════════════════════════════════════
  if (settings.showAttachments !== false && request.attachments && request.attachments.length > 0) {
    ensureSpace(15 + request.attachments.length * 6);
    drawSectionHeader('ATTACHED DOCUMENTS');

    // @ts-ignore
    autoTable(doc, {
      head: [['Document Name', 'Type', 'Size']],
      body: request.attachments.map((a: any) => [
        a.fileName || 'N/A',
        a.fileType?.split('/')[1] || 'Unknown',
        a.fileSize ? `${(a.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'
      ]),
      startY: currentY,
      margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP, bottom: FOOTER_H + 5 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40] },
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. APPROVAL STATUS
  // ══════════════════════════════════════════════════════════════════════════
  if (settings.showSignatures !== false) {
    const approvals = request.approvals || [];
    const requiredDepts = ['CEO Office', 'Finance', 'Director'];
    const additionalApprovers = Array.isArray(request.additionalApprovers)
      ? request.additionalApprovers
      : (typeof request.additionalApprovers === 'string'
          ? (() => { try { return JSON.parse(request.additionalApprovers); } catch { return []; } })()
          : []);

    const allApprovers: any[] = [];
    requiredDepts.forEach(dept => {
      const existing = approvals.find((a: any) => a.approver?.department === dept);
      allApprovers.push(existing || { approver: { department: dept, username: '' }, status: 'pending', processedAt: null, comments: '' });
    });
    additionalApprovers.forEach((dept: string) => {
      const existing = approvals.find((a: any) => a.approver?.department === dept);
      allApprovers.push(existing || { approver: { department: dept, username: '' }, status: 'pending', processedAt: null, comments: '' });
    });

    ensureSpace(20 + allApprovers.length * 7);
    drawSectionHeader('APPROVAL STATUS');

    // Overall status line
    const approvedCount = approvals.filter((a: any) => a.status?.toLowerCase() === 'approved').length;
    const rejectedCount = approvals.filter((a: any) => a.status?.toLowerCase() === 'rejected').length;
    const pendingCount = approvals.filter((a: any) => !a.status || a.status?.toLowerCase() === 'pending').length;
    const changesCount = approvals.filter((a: any) => a.status?.toLowerCase() === 'changes_requested').length;

    let overallStatus = 'In Progress';
    let statusRGB: [number, number, number] = [0, 102, 204];
    if (rejectedCount > 0) { overallStatus = 'Rejected'; statusRGB = [220, 53, 69]; }
    else if (pendingCount === 0 && approvedCount > 0) { overallStatus = 'Fully Approved'; statusRGB = [46, 174, 52]; }
    else if (changesCount > 0) { overallStatus = 'Changes Requested'; statusRGB = [255, 150, 0]; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...statusRGB);
    doc.text(`Overall Status: ${overallStatus}`, MARGIN + 2, currentY);
    doc.setTextColor(...textColor);
    currentY += 6;

    // Approvals table
    // @ts-ignore
    autoTable(doc, {
      head: [['Department', 'Approver', 'Status', 'Date', 'Comments']],
      body: allApprovers.map((a: any) => [
        a.approver?.department || '',
        a.approver?.username && a.approver.username !== '' ? a.approver.username : (a.approver?.department || ''),
        (a.status || 'PENDING').toUpperCase(),
        a.processedAt ? new Date(a.processedAt).toLocaleDateString('en-GB') : '-',
        a.comments ? (a.comments.length > 40 ? a.comments.substring(0, 40) + '…' : a.comments) : '-'
      ]),
      startY: currentY,
      margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP, bottom: FOOTER_H + 5 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40], lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 51 }
      },
      alternateRowStyles: { fillColor: [245, 240, 255] }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Stamp header + footer images on EVERY page
  // ══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    addPageImages(i);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Output
  // ══════════════════════════════════════════════════════════════════════════
  const pdfBlob = doc.output('blob');
  const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;

  const trackingId = generatePdfTrackingId(request.id);
  await logPdfAuditEvent(Number(request.id), 'pdf_downloaded', {
    trackingId, exportType: 'single_pdf', fileName,
    fileSize: pdfBlob.size, timestamp: new Date().toISOString(),
    pageCount: totalPages, roleType: 'admin', type: 'admin'
  }, 'admin');

  if (autoDownload) {
    saveAs(pdfBlob, fileName);
    console.log('PDF generated successfully');
  }

  return pdfBlob;
}
