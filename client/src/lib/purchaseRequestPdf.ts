import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// =========== Utility Types & Functions =========== //

// A minimal typed shape of your request
interface PurchaseRequest {
  requestNumber?: string;
  title?: string;
  status?: string;
  priority?: string;
  description?: string;
  purposeType?: string;
  subPurpose?: {
    name?: string;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
  currency?: string;
  freightAmount?: number;
  items?: any[];
  attachments?: any[];
  approvals?: any[];
  requester?: {
    username?: string;
    department?: string;
    email?: string;
    contactNumber?: string;
  };
  vendor?: {
    name?: string;
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    contactNumber?: string;
  };
}

// Converts a `Date` or date-string to `MM/DD/YYYY` (or your desired format)
function formatDate(date: string | Date | undefined): string {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString(); 
  } catch {
    return 'N/A';
  }
}

// Simple currency formatter
function formatCurrency(amount: number, currency = 'QAR') {
  return `${currency} ${amount.toLocaleString()}`;
}

// =========== PDF GENERATOR MAIN FUNCTION =========== //
export async function generatePurchaseRequestPDF(
  request: PurchaseRequest,
  options?: {
    showApprovals?: boolean;    // whether to include approvals table
    showAttachments?: boolean;  // whether to include attachments table
    showSignatures?: boolean;   // whether to add signature lines
    headerImage?: string;       // custom header logo
    footerImage?: string;       // custom footer image
    companyInfo?: {
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
    };
    footerText?: string;        // e.g. "Designed by Team E3"
    pageNumbering?: boolean;    // default true
    headerColor?: string;       // header color
    footerColor?: string;       // footer color
    type?: 'user' | 'approver' | 'admin'; // pdf type
  }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // Defaults
  const cfg = {
    showApprovals: options?.showApprovals ?? true,
    showAttachments: options?.showAttachments ?? true,
    showSignatures: options?.showSignatures ?? false,
    headerImage: options?.headerImage || '',
    footerImage: options?.footerImage || '',
    footerText: options?.footerText || 'Designed by Team E3',
    pageNumbering: options?.pageNumbering !== false, // default true
    companyInfo: options?.companyInfo || {},
    headerColor: options?.headerColor || '#6F2AE6', // E3 purple
    footerColor: options?.footerColor || '#6F2AE6', // E3 purple
    type: options?.type || 'user'
  };

  let cursorY = 10; // tracks vertical position

  // 1) Add the Header
  cursorY = await addHeader(doc, request, cursorY, cfg);

  // 2) Basic Information
  cursorY = addSectionTitle(doc, "BASIC INFORMATION", cursorY);
  cursorY = addBasicInfoTable(doc, request, cursorY);

  // 3) Vendor Information
  cursorY = addSectionTitle(doc, "VENDOR INFORMATION", cursorY);
  cursorY = addVendorInfoTable(doc, request, cursorY);

  // 4) Items
  cursorY = addSectionTitle(doc, "ITEMS", cursorY);
  cursorY = addItemsTable(doc, request, cursorY);

  // 5) Attachments (optional)
  if (cfg.showAttachments && request.attachments && request.attachments.length > 0) {
    cursorY = addSectionTitle(doc, "ATTACHED DOCUMENTS", cursorY);
    cursorY = addAttachmentsTable(doc, request, cursorY);
  }

  // 6) Approvals (optional)
  if (cfg.showApprovals && request.approvals && request.approvals.length > 0) {
    cursorY = addSectionTitle(doc, "APPROVAL STATUS", cursorY);
    cursorY = addApprovalsTable(doc, request, cursorY);
  }

  // 7) Signatures (optional)
  if (cfg.showSignatures || cfg.type === 'admin' || cfg.type === 'approver') {
    cursorY = addSectionTitle(doc, "SIGNATURES", cursorY);
    cursorY = addSignatureLines(doc, cursorY);
  }

  // Finally, add footers to each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, i, pageCount, cfg);
  }

  return doc;
}

// =========== HEADER =========== //

async function addHeader(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
  cfg: any
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const headerHeight = 25;

  // Convert header color from hex to RGB
  const headerColor = hexToRgb(cfg.headerColor);

  // If a custom header image is provided:
  if (cfg.headerImage) {
    try {
      const img = new Image();
      img.src = cfg.headerImage;
      await imageOnload(img);
      // Insert the image on the left
      const imgWidth = 40;
      const imgHeight = 15;
      doc.addImage(img, 'PNG', margin, startY, imgWidth, imgHeight);
    } catch (error) {
      console.error("Failed to load header image:", error);
      
      // Render a decent looking E3 banner if image fails
      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
      doc.rect(margin, startY, 40, 15, 'F');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("E3", margin + 20, startY + 9, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
  } else {
    // Render a decent looking E3 banner if no image provided
    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.rect(margin, startY, 40, 15, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("E3", margin + 20, startY + 9, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  // Add the "PURCHASE REQUEST" text
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text("PURCHASE REQUEST", pageWidth / 2, startY + 10, { align: 'center' });

  // Add request number and date to the right
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`PR #${request.requestNumber || '---'}`, pageWidth - margin, startY + 7, { align: 'right' });
  doc.text(`Date: ${formatDate(request.createdAt)}`, pageWidth - margin, startY + 12, { align: 'right' });

  // Add a clean divider below header
  const dividerY = startY + headerHeight;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // Add requester info box
  const reqBoxY = dividerY + 3;
  const reqBoxHeight = 20;
  
  // Clean subtle background for requester info
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, reqBoxY, pageWidth - (margin * 2), reqBoxHeight, 1, 1, 'F');
  
  // Draw light border
  doc.setDrawColor(230, 230, 230); 
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, reqBoxY, pageWidth - (margin * 2), reqBoxHeight, 1, 1, 'S');
  
  // Add requester details
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  
  // First row - left column
  doc.setFont('helvetica', 'bold');
  doc.text("Requester:", margin + 5, reqBoxY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(request.requester?.username || "N/A", margin + 35, reqBoxY + 7);
  
  // First row - right column
  doc.setFont('helvetica', 'bold');
  const midPoint = pageWidth / 2;
  doc.text("Department:", midPoint, reqBoxY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(request.requester?.department || "N/A", midPoint + 35, reqBoxY + 7);
  
  // Second row - left column
  doc.setFont('helvetica', 'bold');
  doc.text("Status:", margin + 5, reqBoxY + 16);
  
  // Add status with color
  doc.setFont('helvetica', 'normal');
  const status = request.status?.toUpperCase() || "PENDING";
  
  // Set status color based on status value
  if (status === "APPROVED") {
    doc.setTextColor(0, 128, 0); // Green
  } else if (status === "REJECTED") {
    doc.setTextColor(192, 0, 0); // Red
  } else if (status === "PENDING") {
    doc.setTextColor(0, 102, 204); // Blue
  } else {
    doc.setTextColor(80, 80, 80); // Default gray
  }
  
  doc.text(status, margin + 35, reqBoxY + 16);
  
  // Second row - right column
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.text("Priority:", midPoint, reqBoxY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(request.priority?.toUpperCase() || "N/A", midPoint + 35, reqBoxY + 16);
  
  // Reset text color to black
  doc.setTextColor(0, 0, 0);
  
  return reqBoxY + reqBoxHeight + 5;
}

// Convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [111, 42, 230]; // E3 purple #6F2AE6
  try {
    // Remove the # if present
    const cleanHex = hex.replace(/^#/, '');
    
    // Validate hex format (3 or 6 characters)
    if (!/^([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
      return defaultColor;
    }
    
    // Handle both 3-char and 6-char hex
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substr(4, 2), 16);
    
    // Handle NaN values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return defaultColor;
    }
    
    return [r, g, b];
  } catch (error) {
    console.error(`Error parsing hex color ${hex}:`, error);
    return defaultColor;
  }
}

// Helper to load images asynchronously
function imageOnload(img: HTMLImageElement) {
  return new Promise<void>((resolve) => {
    img.onload = () => resolve();
    setTimeout(() => resolve(), 1000); // Add timeout as fallback
    img.onerror = () => {
      console.error('Error loading image');
      resolve();
    };
  });
}

// =========== FOOTER =========== //

function addFooter(
  doc: jsPDF,
  currentPage: number,
  totalPages: number,
  cfg: any
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const footerY = pageHeight - 15;

  // Convert footer color from hex to RGB
  const footerColor = hexToRgb(cfg.footerColor);

  // Thin horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  // If there's a footer image, place it on the right
  if (cfg.footerImage) {
    try {
      const img = new Image();
      img.src = cfg.footerImage;
      doc.addImage(img, 'PNG', pageWidth - margin - 25, footerY - 4, 25, 10);
    } catch (error) {
      console.error("Footer image error:", error);
      // Add small E3 brand mark at bottom right as fallback
      const brandSize = 8;
      const brandX = pageWidth - margin - brandSize;
      const brandY = footerY + 2;
      
      // Purple box for brand
      doc.setFillColor(footerColor[0], footerColor[1], footerColor[2]);
      doc.roundedRect(brandX, brandY, brandSize, brandSize, 1, 1, 'F');
      
      // Add "E3" text in white
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text("E3", brandX + brandSize/2, brandY + brandSize/2 + 2, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    }
  } else {
    // Add small E3 brand mark at bottom right
    const brandSize = 8;
    const brandX = pageWidth - margin - brandSize;
    const brandY = footerY + 2;
    
    // Purple box for brand
    doc.setFillColor(footerColor[0], footerColor[1], footerColor[2]);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 1, 1, 'F');
    
    // Add "E3" text in white
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("E3", brandX + brandSize/2, brandY + brandSize/2 + 2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  }

  // Company contact info (if any) on the left
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let contactText = "";
  if (cfg.companyInfo?.phone) contactText += `Phone: ${cfg.companyInfo.phone} `;
  if (cfg.companyInfo?.email) contactText += `| Email: ${cfg.companyInfo.email} `;
  if (cfg.companyInfo?.website) contactText += `| Web: ${cfg.companyInfo.website}`;
  if (contactText) {
    doc.text(contactText.trim(), margin, footerY + 5);
  }

  // Another line for address if needed
  if (cfg.companyInfo?.address) {
    doc.text(cfg.companyInfo.address, margin, footerY + 10);
  }

  // Page numbers in the center or right
  if (cfg.pageNumbering) {
    doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, footerY + 5, {
      align: 'center'
    });
  }

  // Footer text in a color
  doc.setFontSize(8);
  doc.setTextColor(footerColor[0], footerColor[1], footerColor[2]);
  doc.setFont('helvetica', 'italic');
  doc.text(cfg.footerText, pageWidth - margin, footerY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
}

// =========== SECTION TITLES =========== //

function addSectionTitle(doc: jsPDF, title: string, yPos: number): number {
  // If close to bottom, create a new page
  maybeAddNewPage(doc, yPos);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const boxHeight = 8;

  // Dark background for the title
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, yPos, pageWidth - margin * 2, boxHeight, 'F');

  // White text
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin + 5, yPos + 5);

  // Reset text color
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  return yPos + boxHeight + 5;
}

// If we're too close to the bottom, add a page
function maybeAddNewPage(doc: jsPDF, yPos: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 30) {
    doc.addPage();
    return true;
  }
  return false;
}

// =========== BASIC INFO TABLE =========== //

function addBasicInfoTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number
): number {
  maybeAddNewPage(doc, startY);

  // Enhanced body with requester details
  const body = [
    [
      { content: 'Title:', styles: { fontStyle: 'bold' } },
      request.title || 'N/A',
      { content: 'Status:', styles: { fontStyle: 'bold' } },
      request.status?.toUpperCase() || 'N/A'
    ],
    [
      { content: 'Priority:', styles: { fontStyle: 'bold' } },
      request.priority?.toUpperCase() || 'N/A',
      { content: 'Date Created:', styles: { fontStyle: 'bold' } },
      formatDate(request.createdAt)
    ],
    [
      { content: 'Requester:', styles: { fontStyle: 'bold' } },
      request.requester?.username || 'N/A',
      { content: 'Department:', styles: { fontStyle: 'bold' } },
      request.requester?.department || 'N/A'
    ],
    [
      { content: 'Description:', styles: { fontStyle: 'bold' } },
      { content: request.description || 'N/A', colSpan: 3 }
    ],
    [
      { content: 'Purpose Type:', styles: { fontStyle: 'bold' } },
      request.purposeType || 'N/A',
      { content: 'Sub-purpose:', styles: { fontStyle: 'bold' } },
      request.subPurpose?.name || 'N/A'
    ]
  ];

  // Add contact information if available
  if (request.requester?.email || request.requester?.contactNumber) {
    body.push([
      { content: 'Contact Info:', styles: { fontStyle: 'bold' } },
      { content: [
        request.requester?.email ? `Email: ${request.requester.email}` : '',
        request.requester?.contactNumber ? `Phone: ${request.requester.contactNumber}` : ''
      ].filter(Boolean).join(' | '), colSpan: 3 }
    ]);
  }

  (autoTable as any)(doc, {
    startY,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
    body
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== VENDOR INFO TABLE =========== //

function addVendorInfoTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number
): number {
  maybeAddNewPage(doc, startY);
  const vendor = request.vendor || {};

  const body = [
    [
      { content: 'Vendor Name:', styles: { fontStyle: 'bold' } },
      vendor.name || vendor.companyName || 'N/A',
      { content: 'Contact Person:', styles: { fontStyle: 'bold' } },
      vendor.contactPerson || 'N/A'
    ],
    [
      { content: 'Email:', styles: { fontStyle: 'bold' } },
      vendor.email || 'N/A',
      { content: 'Phone:', styles: { fontStyle: 'bold' } },
      vendor.phone || vendor.contactNumber || 'N/A'
    ]
  ];

  (autoTable as any)(doc, {
    startY,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    body
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== ITEMS TABLE =========== //

function addItemsTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number
): number {
  maybeAddNewPage(doc, startY);

  // Parse items safely
  let items = [];
  try {
    if (Array.isArray(request.items)) {
      items = request.items;
    } else if (typeof request.items === 'string') {
      items = JSON.parse(request.items || '[]');
    }
  } catch (error) {
    console.error('Error parsing items:', error);
    items = [];
  }

  if (items.length === 0) {
    (autoTable as any)(doc, {
      startY,
      theme: 'plain',
      body: [['No items found']]
    });
    return (doc as any).lastAutoTable.finalY + 5;
  }

  // Build table data
  const rows = items.map((item: any) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.estimatedCost) || 0;
    return [
      item.name || 'N/A',
      item.description || 'N/A',
      qty.toString(),
      formatCurrency(cost, request.currency),
      formatCurrency(qty * cost, request.currency)
    ];
  });

  (autoTable as any)(doc, {
    startY,
    head: [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']],
    body: rows,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [240, 240, 245], textColor: [0, 0, 0] },
    columnStyles: {
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 25 }
    }
  });

  let yPos = (doc as any).lastAutoTable.finalY;
  
  // Totals
  const itemsTotal = items.reduce(
    (sum: number, i: any) => sum + (Number(i.quantity) || 0) * (Number(i.estimatedCost) || 0), 0
  );
  const freightAmount = Number(request.freightAmount) || 0;
  const totalCost = itemsTotal + freightAmount;

  (autoTable as any)(doc, {
    startY: yPos,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      3: { fontStyle: 'bold', halign: 'right' },
      4: { halign: 'right' }
    },
    body: [
      ['', '', '', 'Items Total:', formatCurrency(itemsTotal, request.currency)],
      ['', '', '', 'Freight:', formatCurrency(freightAmount, request.currency)],
      ['', '', '', 'Total Cost:', formatCurrency(totalCost, request.currency)]
    ]
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== ATTACHMENTS TABLE =========== //

function addAttachmentsTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number
): number {
  maybeAddNewPage(doc, startY);
  const attachments = request.attachments || [];

  if (attachments.length === 0) {
    (autoTable as any)(doc, {
      startY,
      theme: 'plain',
      body: [['No attachments']]
    });
    return (doc as any).lastAutoTable.finalY + 5;
  }

  const rows = attachments.map((file: any) => [
    file.fileName || file.name || 'N/A',
    file.fileType || 'N/A',
    file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'
  ]);

  (autoTable as any)(doc, {
    startY,
    head: [['Document Name', 'Type', 'Size']],
    body: rows,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [240, 240, 245], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 20, halign: 'right' }
    }
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== APPROVALS TABLE =========== //

function addApprovalsTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number
): number {
  maybeAddNewPage(doc, startY);
  const approvals = Array.isArray(request.approvals) ? request.approvals : [];

  if (approvals.length === 0) {
    (autoTable as any)(doc, {
      startY,
      theme: 'plain',
      body: [['No approvals found for this request']]
    });
    return (doc as any).lastAutoTable.finalY + 5;
  }

  // Enhanced approval rows with style customization for status
  const rows = [];
  
  for (const app of approvals) {
    const status = (app.status || 'PENDING').toUpperCase();
    let statusStyle = {};
    let statusIcon = '';
    
    // Apply color styling based on approval status with icons
    if (status === 'APPROVED') {
      statusStyle = { fillColor: [230, 255, 230], textColor: [0, 128, 0], fontStyle: 'bold' };
      statusIcon = '✓ ';
    } else if (status === 'REJECTED') {
      statusStyle = { fillColor: [255, 230, 230], textColor: [192, 0, 0], fontStyle: 'bold' };
      statusIcon = '✗ ';
    } else if (status === 'PENDING') {
      statusStyle = { fillColor: [240, 248, 255], textColor: [0, 102, 204] };
      statusIcon = '⋯ ';
    } else if (status === 'CHANGES') {
      statusStyle = { fillColor: [255, 248, 225], textColor: [186, 104, 0] };
      statusIcon = '! ';
    }
    
    // Format the date in a more readable way
    const processedDate = app.processedAt ? formatDate(app.processedAt) : 'Awaiting';
    
    rows.push([
      app.approver?.username || 'N/A',
      app.department || 'N/A',
      { content: statusIcon + status, styles: statusStyle },
      { content: app.comments || 'No comments', styles: { fontSize: 8 } },
      processedDate
    ]);
  }

  // Calculate approval statistics for summary visualization
  const approvedCount = approvals.filter(a => a.status?.toLowerCase() === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status?.toLowerCase() === 'rejected').length;
  const pendingCount = approvals.filter(a => a.status?.toLowerCase() === 'pending' || !a.status).length;
  const changesCount = approvals.filter(a => a.status?.toLowerCase() === 'changes').length;
  
  // Add the main approvals table with enhanced styling
  (autoTable as any)(doc, {
    startY,
    head: [['Approver', 'Department', 'Status', 'Comments', 'Processed Date']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { 
      fillColor: [240, 240, 245], 
      textColor: [50, 50, 50], 
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 30 },
      3: { cellWidth: 'auto' },
      4: { halign: 'right', cellWidth: 30 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });
  
  // Add a visual approval flow summary with progress indicators
  const endY = (doc as any).lastAutoTable.finalY + 8;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  
  // Add the approval flow summary section title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Approval Progress Summary', margin, endY);
  
  // Draw approval flow visualization
  const boxSize = 8;
  const textY = endY + 5;
  const boxY = textY + 3;
  const textPadding = 4;
  
  // Calculate total width for progress bar
  const progressBarWidth = pageWidth - (margin * 2);
  const progressBarHeight = 5;
  const progressBarY = boxY + boxSize + 8;
  
  // First draw background progress bar
  doc.setFillColor(235, 235, 235);
  doc.roundedRect(margin, progressBarY, progressBarWidth, progressBarHeight, 2, 2, 'F');
  
  // Calculate progress percentage based on approvals
  const totalApprovers = approvals.length;
  let progressPercentage = approvedCount / totalApprovers;
  
  // Draw the colored progress indicator
  if (progressPercentage > 0) {
    // Green progress for approved
    doc.setFillColor(46, 174, 52);
    doc.roundedRect(
      margin, 
      progressBarY, 
      progressBarWidth * progressPercentage, 
      progressBarHeight, 
      2, 2, 'F'
    );
  }
  
  if (rejectedCount > 0) {
    // Red indicator for rejected above the progress bar
    const rejectX = margin + (progressBarWidth * (approvedCount / totalApprovers));
    doc.setFillColor(220, 53, 69);
    doc.circle(rejectX, progressBarY + (progressBarHeight / 2), 3, 'F');
  }
  
  // Summary boxes with counts and labels
  doc.setFontSize(9);
  
  // Approved summary
  doc.setFillColor(46, 174, 52); // Green
  doc.rect(margin, boxY, boxSize, boxSize, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(46, 174, 52);
  doc.text(`${approvedCount}`, margin + boxSize + textPadding, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Approved', margin + boxSize + textPadding + 8, boxY + 6);
  
  // Pending summary
  const pendingX = margin + 70;
  doc.setFillColor(0, 123, 255); // Blue
  doc.rect(pendingX, boxY, boxSize, boxSize, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 123, 255);
  doc.text(`${pendingCount}`, pendingX + boxSize + textPadding, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Pending', pendingX + boxSize + textPadding + 8, boxY + 6);
  
  // Rejected summary
  const rejectedX = margin + 140;
  doc.setFillColor(220, 53, 69); // Red
  doc.rect(rejectedX, boxY, boxSize, boxSize, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 53, 69);
  doc.text(`${rejectedCount}`, rejectedX + boxSize + textPadding, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Rejected', rejectedX + boxSize + textPadding + 8, boxY + 6);
  
  // Changes requested summary (if applicable)
  if (changesCount > 0) {
    const changesX = margin + 210;
    doc.setFillColor(255, 193, 7); // Amber
    doc.rect(changesX, boxY, boxSize, boxSize, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 193, 7);
    doc.text(`${changesCount}`, changesX + boxSize + textPadding, boxY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Changes Requested', changesX + boxSize + textPadding + 8, boxY + 6);
  }
  
  // Add overall approval status
  const statusTextY = progressBarY + progressBarHeight + 10;
  let overallStatus = 'In Progress';
  let statusColor = [0, 123, 255]; // Blue for in progress
  
  if (rejectedCount > 0) {
    overallStatus = 'Rejected';
    statusColor = [220, 53, 69]; // Red
  } else if (pendingCount === 0 && approvedCount === totalApprovers) {
    overallStatus = 'Fully Approved';
    statusColor = [46, 174, 52]; // Green
  } else if (changesCount > 0) {
    overallStatus = 'Changes Requested';
    statusColor = [255, 193, 7]; // Amber
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(`Overall Status: ${overallStatus}`, margin, statusTextY);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  return statusTextY + 5;
}

// =========== SIGNATURE LINES =========== //

function addSignatureLines(doc: jsPDF, startY: number): number {
  maybeAddNewPage(doc, startY);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const lineWidth = (pageWidth - margin * 2 - 20) / 2;
  const lineY = startY + 15;

  // Requester
  doc.line(margin, lineY, margin + lineWidth, lineY);
  doc.text("Requester Signature", margin, lineY + 5);

  // Approver
  doc.line(margin + lineWidth + 20, lineY, pageWidth - margin, lineY);
  doc.text("Approver Signature", margin + lineWidth + 20, lineY + 5);

  return lineY + 15;
}