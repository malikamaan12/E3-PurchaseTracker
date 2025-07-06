import { jsPDF } from "jspdf";
import 'jspdf-autotable';

// TypeScript interface extension for autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}
import { applyPdfWatermark } from "./pdfAuditUtils";

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
  additionalApprovers?: any[];
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
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return "N/A";
  }
}

// Simple currency formatter
function formatCurrency(amount: number, currency = "QAR") {
  return `${currency} ${amount.toLocaleString()}`;
}

// =========== PDF GENERATOR MAIN FUNCTION =========== //
import { applySecurityWatermark } from "./pdfAuditUtils";

export async function generatePurchaseRequestPDF(
  request: PurchaseRequest,
  options?: {
    showApprovals?: boolean; // whether to include approvals table
    showAttachments?: boolean; // whether to include attachments table
    showSignatures?: boolean; // whether to add signature lines
    headerImage?: string; // custom header logo
    footerImage?: string; // custom footer image
    companyInfo?: {
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
    };
    footerText?: string; // e.g. "Designed by Team E3"
    pageNumbering?: boolean; // default true
    headerColor?: string; // header color
    footerColor?: string; // footer color
    type?: "user" | "approver" | "admin"; // pdf type
    showWatermark?: boolean; // whether to show watermark
    watermarkText?: string; // watermark text content
    watermarkOpacity?: number; // watermark opacity (0-1)
    securityLevel?: "confidential" | "internal" | "restricted" | "public"; // document security
  },
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Defaults with consolidated PDF type logic
  const cfg = {
    // Always show approvals for all user types - consolidated PDF format
    showApprovals: true,
    // Always include attachments if they exist
    showAttachments: true,
    // Only show signatures for admin or approver users
    showSignatures:
      options?.showSignatures ??
      (options?.type === "admin" || options?.type === "approver"),
    headerImage: options?.headerImage || "",
    footerImage: options?.footerImage || "",
    footerText: options?.footerText || "Designed by Team E3",
    pageNumbering: options?.pageNumbering !== false, // default true
    companyInfo: options?.companyInfo || {},
    headerColor: options?.headerColor || "#6F2AE6", // E3 purple
    footerColor: options?.footerColor || "#6F2AE6", // E3 purple
    type: options?.type || "user",
    showWatermark: options?.showWatermark ?? true,
    watermarkText: options?.watermarkText || "E3 CONFIDENTIAL",
    watermarkOpacity: options?.watermarkOpacity || 0.1,
    securityLevel: options?.securityLevel || "internal",
  };

  let cursorY = 10; // tracks vertical position

  // 1) Add the Header - Always includes requester, department, status and priority
  cursorY = await addHeader(doc, request, cursorY, cfg);

  // 2) Basic Information - Displays core request information
  cursorY = addSectionTitle(doc, "BASIC INFORMATION", cursorY);
  cursorY = addBasicInfoTable(doc, request, cursorY);

  // 3) Vendor Information - If available
  if (request.vendor) {
    cursorY = addSectionTitle(doc, "VENDOR INFORMATION", cursorY);
    cursorY = addVendorInfoTable(doc, request, cursorY);
  }

  // 4) Items - Main purchase request items with proper content fitting
  cursorY = addSectionTitle(doc, "ITEMS", cursorY);
  cursorY = addItemsTable(doc, request, cursorY);

  // 5) Attachments - Always include if they exist
  if (request.attachments && request.attachments.length > 0) {
    cursorY = addSectionTitle(doc, "ATTACHED DOCUMENTS", cursorY);
    cursorY = addAttachmentsTable(doc, request, cursorY);
  }

  // 6) Approvals - Always include if they exist (consolidating PDF types)
  if (request.approvals && request.approvals.length > 0) {
    cursorY = addSectionTitle(doc, "APPROVAL STATUS", cursorY);
    cursorY = addApprovalsTable(doc, request, cursorY);
  }

  // 7) Signatures - Only for admin or approver roles
  if (cfg.showSignatures) {
    cursorY = addSectionTitle(doc, "SIGNATURES", cursorY);
    cursorY = addSignatureLines(doc, cursorY);
  }

  // Finally, add footers to each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, i, pageCount, cfg);
  }

  // Apply security watermark if enabled
  if (cfg.securityLevel && cfg.securityLevel !== "public") {
    applySecurityWatermark(doc, cfg.securityLevel);
  }
  // Apply custom watermark if security watermark is not used but watermark is enabled
  else if (cfg.showWatermark && cfg.watermarkText) {
    applyPdfWatermark(doc, cfg.watermarkText, cfg.watermarkOpacity);
  }

  return doc;
}

// =========== HEADER =========== //

async function addHeader(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
  cfg: any,
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = startY;

  // Convert header color from hex to RGB
  const headerColor = hexToRgb(cfg.headerColor);

  // Add company logo ABOVE header (top left corner)
  if (cfg.headerImage) {
    try {
      const img = new Image();
      img.src = cfg.headerImage;
      await imageOnload(img);
      // Logo positioned above header
      const logoWidth = 30;
      const logoHeight = 20;
      doc.addImage(img, "PNG", margin, currentY, logoWidth, logoHeight);
      
      // Move current position down after logo
      currentY += logoHeight + 8;
    } catch (error) {
      console.error("Failed to load header image:", error);
      // Continue without logo
      currentY += 5;
    }
  } else {
    currentY += 5;
  }

  // HEADER SECTION with reduced size and subtitle
  const headerFontSize = 14 * 0.8; // Reduce header size by 20%
  
  // Main header title
  doc.setFontSize(headerFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.text("EVENTS & ENTERTAINMENT ENTERPRISES", margin, currentY);
  currentY += headerFontSize * 0.4;
  
  // Header subtitle
  doc.setFontSize(headerFontSize * 0.7);
  doc.setFont("helvetica", "normal");
  doc.text("PURCHASE REQUEST", margin, currentY);

  // Add request number and date to the right (positioned at header level)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const requestInfoY = currentY - (headerFontSize * 0.4);
  
  doc.text(
    `PR #${request.requestNumber || "---"}`,
    pageWidth - margin,
    requestInfoY,
    { align: "right" },
  );
  doc.text(
    `Date: ${formatDate(request.createdAt)}`,
    pageWidth - margin,
    requestInfoY + 5,
    { align: "right" },
  );

  // Add a clean divider below header
  currentY += 10; // Add space after header
  const dividerY = currentY;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // Add requester info box
  const reqBoxY = dividerY + 3;
  const reqBoxHeight = 20;

  // Clean subtle background for requester info
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(
    margin,
    reqBoxY,
    pageWidth - margin * 2,
    reqBoxHeight,
    1,
    1,
    "F",
  );

  // Draw light border
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.roundedRect(
    margin,
    reqBoxY,
    pageWidth - margin * 2,
    reqBoxHeight,
    1,
    1,
    "S",
  );

  // Add requester details
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  // First row - left column
  doc.setFont("helvetica", "bold");
  doc.text("Requester:", margin + 5, reqBoxY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(request.requester?.username || "N/A", margin + 35, reqBoxY + 7);

  // First row - right column
  doc.setFont("helvetica", "bold");
  const midPoint = pageWidth / 2;
  doc.text("Department:", midPoint, reqBoxY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(request.requester?.department || "N/A", midPoint + 35, reqBoxY + 7);

  // Second row - left column
  doc.setFont("helvetica", "bold");
  doc.text("Status:", margin + 5, reqBoxY + 16);

  // Add status with color
  doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.text("Priority:", midPoint, reqBoxY + 16);
  doc.setFont("helvetica", "normal");
  doc.text(
    request.priority?.toUpperCase() || "N/A",
    midPoint + 35,
    reqBoxY + 16,
  );

  // Reset text color to black
  doc.setTextColor(0, 0, 0);

  return reqBoxY + reqBoxHeight + 5;
}

// Convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [111, 42, 230]; // E3 purple #6F2AE6
  try {
    // Remove the # if present
    const cleanHex = hex.replace(/^#/, "");

    // Validate hex format (3 or 6 characters)
    if (!/^([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
      return defaultColor;
    }

    // Handle both 3-char and 6-char hex
    const r = parseInt(
      cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substr(0, 2),
      16,
    );
    const g = parseInt(
      cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substr(2, 2),
      16,
    );
    const b = parseInt(
      cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substr(4, 2),
      16,
    );

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
      console.error("Error loading image");
      resolve();
    };
  });
}

// =========== FOOTER =========== //

function addFooter(
  doc: jsPDF,
  currentPage: number,
  totalPages: number,
  cfg: any,
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
      doc.addImage(img, "PNG", pageWidth - margin - 25, footerY - 4, 25, 10);
    } catch (error) {
      console.error("Footer image error:", error);
      // Add small E3 brand mark at bottom right as fallback
      const brandSize = 8;
      const brandX = pageWidth - margin - brandSize;
      const brandY = footerY + 2;

      // Purple box for brand
      doc.setFillColor(footerColor[0], footerColor[1], footerColor[2]);
      doc.roundedRect(brandX, brandY, brandSize, brandSize, 1, 1, "F");

      // Add "E3" text in white
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("E3", brandX + brandSize / 2, brandY + brandSize / 2 + 2, {
        align: "center",
      });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
    }
  } else {
    // Add small E3 brand mark at bottom right
    const brandSize = 8;
    const brandX = pageWidth - margin - brandSize;
    const brandY = footerY + 2;

    // Purple box for brand
    doc.setFillColor(footerColor[0], footerColor[1], footerColor[2]);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 1, 1, "F");

    // Add "E3" text in white
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("E3", brandX + brandSize / 2, brandY + brandSize / 2 + 2, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
  }

  // Company contact info (if any) on the left
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let contactText = "";
  if (cfg.companyInfo?.phone) contactText += `Phone: ${cfg.companyInfo.phone} `;
  if (cfg.companyInfo?.email)
    contactText += `| Email: ${cfg.companyInfo.email} `;
  if (cfg.companyInfo?.website)
    contactText += `| Web: ${cfg.companyInfo.website}`;
  if (contactText) {
    doc.text(contactText.trim(), margin, footerY + 5);
  }

  // Another line for address if needed
  if (cfg.companyInfo?.address) {
    doc.text(cfg.companyInfo.address, margin, footerY + 10);
  }

  // Page numbers in the center or right
  if (cfg.pageNumbering) {
    doc.text(
      `Page ${currentPage} of ${totalPages}`,
      pageWidth / 2,
      footerY + 13,
      {
        align: "center",
      },
    );
  }

  // Footer text in a color
  doc.setFontSize(8);
  doc.setTextColor(footerColor[0], footerColor[1], footerColor[2]);
  doc.setFont("helvetica", "italic");
  doc.text(cfg.footerText, pageWidth - margin, footerY + 10, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
}

// =========== SECTION TITLES =========== //

function addSectionTitle(doc: jsPDF, title: string, yPos: number): number {
  // Better approach using ensureContentFits instead of maybeAddNewPage
  const titleSectionHeight = 15; // Section title height with margin
  yPos = ensureContentFits(doc, yPos, titleSectionHeight);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const boxHeight = 8;

  // Dark background for the title
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, yPos, pageWidth - margin * 2, boxHeight, "F");

  // White text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin + 5, yPos + 5);

  // Reset text color
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  return yPos + boxHeight + 5;
}

// If we're too close to the bottom, add a page
function maybeAddNewPage(doc: jsPDF, yPos: number, minSpace: number = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - minSpace) {
    doc.addPage();
    return true;
  }
  return false;
}

/**
 * Checks if the content will fit on the current page, if not adds a new page.
 * This is an enhanced version that is more precise about content height.
 */
/**
 * Ensures content fits on the current page, adds a new page if needed
 * This function prevents empty pages and handles content placement correctly
 *
 * @param doc PDF document
 * @param yPos Current Y position
 * @param contentHeight Approximate height of the content to add
 * @param minRemainingSpace Minimum space required to start content on current page
 * @returns Updated Y position (either on current page or at top of new page)
 */
function ensureContentFits(
  doc: jsPDF,
  yPos: number,
  contentHeight: number,
  minRemainingSpace: number = 10,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const footerSpace = 10;
  const bottomLimit = pageHeight - margin - footerSpace;
  const contentEndY = yPos + contentHeight;
  const remainingSpace = bottomLimit - yPos;

  if (contentEndY > bottomLimit || remainingSpace < minRemainingSpace) {
    if (yPos <= margin + 5) {
      return yPos;
    }

    doc.addPage();
    return margin;
  }
  
  return yPos;
}


// =========== BASIC INFO TABLE =========== //

function addBasicInfoTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
): number {
  // Calculate the table height to make sure it fits on the page
  const tableHeight = 60; // Approximate height based on content
  startY = ensureContentFits(doc, startY, tableHeight);

  // Only include information that's NOT already shown in the header section
  // We've already displayed: Requester name, Department, Status, Priority, PR#, and Date
  // Only include essential details that aren't shown elsewhere
  const body = [
    [
      { content: "Title:", styles: { fontStyle: "bold" } },
      { content: request.title || "N/A", colSpan: 3 },
    ],
    [
      { content: "Description:", styles: { fontStyle: "bold" } },
      { content: request.description || "N/A", colSpan: 3 },
    ],
    [
      { content: "Purpose Type:", styles: { fontStyle: "bold" } },
      request.purposeType || "N/A",
      { content: "Sub-purpose:", styles: { fontStyle: "bold" } },
      request.subPurpose?.name || "N/A",
    ],
  ];

  // Only add contact info if it's not displayed elsewhere and is available
  if (request.requester?.email || request.requester?.contactNumber) {
    body.push([
      { content: "Contact Info:", styles: { fontStyle: "bold" } },
      {
        content: [
          request.requester?.email ? `Email: ${request.requester.email}` : "",
          request.requester?.contactNumber
            ? `Phone: ${request.requester.contactNumber}`
            : "",
        ]
          .filter(Boolean)
          .join(" | "),
        colSpan: 3,
      },
    ]);
  }

  doc.autoTable({
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
    body,
    margin: { top: 15, right: 15, bottom: 15, left: 15 },
    tableWidth: "auto",
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== VENDOR INFO TABLE =========== //

function addVendorInfoTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
): number {
  // Calculate the table height to make sure it fits on the page
  const tableHeight = 30; // Approximate height based on content
  startY = ensureContentFits(doc, startY, tableHeight);

  const vendor = request.vendor || {};

  const body = [
    [
      { content: "Vendor Name:", styles: { fontStyle: "bold" } },
      vendor.name || vendor.companyName || "N/A",
      { content: "Contact Person:", styles: { fontStyle: "bold" } },
      vendor.contactPerson || "N/A",
    ],
    [
      { content: "Email:", styles: { fontStyle: "bold" } },
      vendor.email || "N/A",
      { content: "Phone:", styles: { fontStyle: "bold" } },
      vendor.phone || vendor.contactNumber || "N/A",
    ],
  ];

  doc.autoTable({
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
    body,
    margin: { top: 15, right: 15, bottom: 15, left: 15 },
    tableWidth: "auto",
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== ITEMS TABLE =========== //

function addItemsTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
): number {
  // Parse items safely
  let items = [];
  try {
    if (Array.isArray(request.items)) {
      items = request.items;
    } else if (typeof request.items === "string") {
      items = JSON.parse(request.items || "[]");
    }
  } catch (error) {
    console.error("Error parsing items:", error);
    items = [];
  }

  if (items.length === 0) {
    doc.autoTable({
      startY,
      theme: "plain",
      body: [["No items found"]],
    });
    return (doc as any).lastAutoTable.finalY + 5;
  }

  // Build table data
  const rows = items.map((item: any) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.estimatedCost) || 0;
    return [
      item.name || "N/A",
      item.description || "N/A",
      qty.toString(),
      formatCurrency(cost, request.currency),
      formatCurrency(qty * cost, request.currency),
    ];
  });

  // Calculate approximate table height (rows + header + totals) to check page fit
  // Adjust row height calculation based on text content that might wrap
  const rowHeight = 12; // Base height per row in points
  let tableHeight = 40; // Start with header + margins

  // More accurate height calculation that accounts for content length and wrapping
  rows.forEach((row: any[]) => {
    // Add base height for each row
    let thisRowHeight = rowHeight;

    // If description is longer, increase estimated height for text wrapping
    const description = row[1].toString();
    if (description.length > 30) {
      // Add extra height based on content length for wrapping
      const extraLines = Math.ceil(description.length / 30) - 1;
      thisRowHeight += extraLines * 8; // 8 points per extra line
    }

    tableHeight += thisRowHeight;
  });

  // Use our enhanced page fitting method
  // Use a larger minimum space parameter for tables as they require more layout space
  startY = ensureContentFits(doc, startY, tableHeight, 40);

  // Get page width to calculate table widths
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const availableWidth = pageWidth - margin * 2;

  // Calculate column widths based on available space
  const itemWidth = Math.floor(availableWidth * 0.25); // 25% of available width
  const qtyWidth = Math.floor(availableWidth * 0.08); // 8% of available width
  const costWidth = Math.floor(availableWidth * 0.15); // 15% of available width
  const totalWidth = Math.floor(availableWidth * 0.15); // 15% of available width
  // Description takes the remaining space (about 37%)
  const descWidth =
    availableWidth - itemWidth - qtyWidth - costWidth - totalWidth;

  doc.autoTable({
    startY,
    head: [["Item", "Description", "Qty", "Unit Cost", "Total"]],
    body: rows,
    theme: "striped",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak", // Enable text wrapping
      minCellHeight: 10, // Ensure minimum height for cells
      valign: "middle",
      halign: "left",
    },
    headStyles: {
      fillColor: [240, 240, 245],
      textColor: [0, 0, 0],
      halign: "left",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: itemWidth, overflow: "linebreak" }, // Item name with wrapping
      1: { halign: "left", cellWidth: descWidth, overflow: "linebreak" }, // Description with wrapping
      2: { halign: "left", cellWidth: qtyWidth }, // Quantity column
      3: { halign: "left", cellWidth: costWidth }, // Unit cost
      4: { halign: "left", cellWidth: totalWidth }, // Total cost
    },
    // Set margins
    margin: { top: 15, right: margin, bottom: 15, left: margin },
    // Ensure content fits within cell boundaries
    willDrawCell: (data: any) => {
      // Add cell padding for text wrapping
      if (
        data.column.index === 1 &&
        data.cell.text &&
        data.cell.text.length > 50
      ) {
        data.cell.styles.cellPadding = 4; // Increase padding for long text
      }
    },
    didDrawPage: (data: any) => {
      // Reset table header on each new page
    },
  });

  let yPos = (doc as any).lastAutoTable.finalY;

  // Calculate totals
  const itemsTotal = items.reduce(
    (sum: number, i: any) =>
      sum + (Number(i.quantity) || 0) * (Number(i.estimatedCost) || 0),
    0,
  );
  const freightAmount = Number(request.freightAmount) || 0;
  const totalCost = itemsTotal + freightAmount;

  // Check if we have enough space for the totals table
  const totalsHeight = 30; // Approximate height for the totals section
  yPos = ensureContentFits(doc, yPos, totalsHeight);

  doc.autoTable({
    startY: yPos,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: itemWidth }, // Match the main table columns
      1: { cellWidth: descWidth },
      2: { cellWidth: qtyWidth, halign: "center" },
      3: { cellWidth: costWidth, fontStyle: "bold", halign: "right" },
      4: { cellWidth: totalWidth, halign: "right" },
    },
    body: [
      [
        "",
        "",
        "",
        "Items Total:",
        formatCurrency(itemsTotal, request.currency),
      ],
      ["", "", "", "Freight:", formatCurrency(freightAmount, request.currency)],
      ["", "", "", "Total Cost:", formatCurrency(totalCost, request.currency)],
    ],
    margin: { top: 15, right: margin, bottom: 15, left: margin },
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== ATTACHMENTS TABLE =========== //

function addAttachmentsTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
): number {
  const attachments = request.attachments || [];

  if (attachments.length === 0) {
    doc.autoTable({
      startY,
      theme: "plain",
      body: [["No attachments"]],
    });
    return (doc as any).lastAutoTable.finalY + 5;
  }

  // Calculate approximate table height to check page fit
  const rowHeight = 12; // Base height per row in points
  let tableHeight = 20; // Start with header + margins

  // Generate rows with more accurate height estimation
  const rows = attachments.map((file: any) => {
    // Add extra height for longer filenames that will wrap
    const filename = file.fileName || file.name || "N/A";
    let thisRowHeight = rowHeight;

    if (filename.length > 40) {
      // Add extra height based on filename length for wrapping
      const extraLines = Math.ceil(filename.length / 40) - 1;
      thisRowHeight += extraLines * 8; // 8 points per extra line
    }

    tableHeight += thisRowHeight;

    return [
      filename,
      file.fileType || "N/A",
      file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : "N/A",
    ];
  });

  // Use our enhanced page fitting method with larger min space for tables
  startY = ensureContentFits(doc, startY, tableHeight, 30);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const availableWidth = pageWidth - margin * 2;
  const numColumns = 3;
  const columnWidth = availableWidth / numColumns;

  doc.autoTable({
    startY,
    head: [["Document Name", "Type", "Size"]],
    body: rows,
    theme: "striped",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      halign: "left",
    },
    headStyles: {
      fillColor: [240, 240, 245],
      textColor: [0, 0, 0],
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: columnWidth, overflow: "linebreak", halign: "left" },
      1: { cellWidth: columnWidth, halign: "left" },
      2: { cellWidth: columnWidth, halign: "left" },
    },
    tableWidth: "100%",
    margin: { top: margin, right: margin, bottom: margin, left: margin },
    pageBreak: "avoid",
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

// =========== APPROVALS TABLE =========== //

function addApprovalsTable(
  doc: jsPDF,
  request: PurchaseRequest,
  startY: number,
): number {
  // Create comprehensive approver list including all expected approvers (mandatory + additional)
  const mandatoryDepartments = ['CEO Office', 'Finance', 'Director'];
  const additionalApprovers = Array.isArray(request.additionalApprovers) 
    ? (typeof request.additionalApprovers[0] === 'string' 
        ? request.additionalApprovers 
        : request.additionalApprovers.map((a: any) => a.department || a.name || a).filter(Boolean))
    : [];
  
  const existingApprovals = Array.isArray(request.approvals) ? request.approvals : [];
  const allExpectedApprovers: any[] = [];
  
  // Add mandatory department approvers
  mandatoryDepartments.forEach(dept => {
    const existingApproval = existingApprovals.find(a => a.approver?.department === dept || a.department === dept);
    if (existingApproval) {
      allExpectedApprovers.push(existingApproval);
    } else {
      // Add placeholder for missing mandatory approver
      allExpectedApprovers.push({
        approver: null,
        department: dept,
        status: 'pending',
        processedAt: null,
        comments: null
      });
    }
  });
  
  // Add additional approvers
  additionalApprovers.forEach(deptName => {
    const existingApproval = existingApprovals.find(a => a.approver?.department === deptName || a.department === deptName);
    if (existingApproval) {
      allExpectedApprovers.push(existingApproval);
    } else {
      // Add placeholder for missing additional approver
      allExpectedApprovers.push({
        approver: null,
        department: deptName,
        status: 'pending',
        processedAt: null,
        comments: null
      });
    }
  });

  if (allExpectedApprovers.length === 0) {
    doc.autoTable({
      startY,
      theme: "plain",
      body: [["No approvals found for this request"]],
    });
    return (doc as any).lastAutoTable.finalY + 5;
  }

  // Enhanced approval rows with style customization for status
  const rows = [];

  for (const app of allExpectedApprovers) {
    const status = (app.status || "PENDING").toUpperCase();
    let statusStyle = {};
    let statusIcon = "";

    // Use consistent styling for all statuses - no colorful indicators
    statusStyle = {
      fontSize: 9,
      textColor: [0, 0, 0], // Black text for consistency
    };
    
    // Simple status text without icons
    if (status === "APPROVED") {
      statusIcon = "";
    } else if (status === "REJECTED") {
      statusIcon = "";
    } else if (status === "PENDING") {
      statusIcon = "";
    } else if (status === "CHANGES") {
      statusIcon = "";
    }

    // Format the date in a more readable way
    const processedDate = app.processedAt
      ? formatDate(app.processedAt)
      : "Awaiting";

    // Display approver username if assigned, otherwise show department name for pending approvals
    const approverName = app.approver?.username && app.approver.username !== 'Pending Assignment'
      ? app.approver.username 
      : app.department || '';

    rows.push([
      approverName,
      app.department || "N/A",
      { content: statusIcon + status, styles: statusStyle },
      { content: app.comments || "No comments", styles: { fontSize: 8 } },
      processedDate,
    ]);
  }

  // Calculate a more accurate table height for comments that might wrap
  const rowHeight = 14; // Base height per row in points
  let tableHeight = 30; // Start with header + margins

  // Add height for each row, accounting for comments that might wrap
  rows.forEach((row) => {
    let thisRowHeight = rowHeight;

    // If comment content is longer, increase estimated height for text wrapping
    const comment =
      typeof row[3] === "object"
        ? (row[3].content || "").toString()
        : (row[3] || "").toString();

    if (comment.length > 30) {
      // Add extra height based on content length for wrapping
      const extraLines = Math.ceil(comment.length / 30) - 1;
      thisRowHeight += extraLines * 6; // 6 points per extra line for comments
    }

    tableHeight += thisRowHeight;
  });

  // Use our enhanced page fitting method with larger min space for tables
  startY = ensureContentFits(doc, startY, tableHeight, 40);

  // Calculate approval statistics for summary visualization
  const approvedCount = allExpectedApprovers.filter(
    (a: any) => a.status?.toLowerCase() === "approved",
  ).length;
  const rejectedCount = allExpectedApprovers.filter(
    (a: any) => a.status?.toLowerCase() === "rejected",
  ).length;
  const pendingCount = allExpectedApprovers.filter(
    (a: any) => a.status?.toLowerCase() === "pending" || !a.status,
  ).length;
  const changesCount = allExpectedApprovers.filter(
    (a: any) => a.status?.toLowerCase() === "changes",
  ).length;

  const apPageWidth = doc.internal.pageSize.getWidth();
  const apMargin = 15;
  const availableWidth = apPageWidth - apMargin * 2;
  const numColumns = 5;
  const columnWidth = availableWidth / numColumns;

  // Add the main approvals table with enhanced styling
  doc.autoTable({
    startY,
    head: [["Approver", "Department", "Status", "Comments", "Processed Date"]],
    body: rows,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      halign: "left",
    },
    headStyles: {
      fillColor: [240, 240, 245],
      textColor: [50, 50, 50],
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: columnWidth },
      1: { halign: "left", cellWidth: columnWidth },
      2: { halign: "left", cellWidth: columnWidth },
      3: { halign: "left", cellWidth: columnWidth, overflow: "linebreak" }, // Ensure comments wrap properly
      4: { halign: "left", cellWidth: columnWidth },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: {
      top: apMargin,
      right: apMargin,
      bottom: apMargin,
      left: apMargin,
    },
  });

  // Return the end position after the approvals table
  return (doc as any).lastAutoTable.finalY + 8;
}

// =========== SIGNATURE LINES =========== //

function addSignatureLines(doc: jsPDF, startY: number): number {
  // Calculate approximate height needed for signature lines
  const signatureHeight = 30; // Height needed for signature lines

  // Use our enhanced page fitting method
  startY = ensureContentFits(doc, startY, signatureHeight);

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
