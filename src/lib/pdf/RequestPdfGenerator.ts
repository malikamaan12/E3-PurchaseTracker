import { safeParseItems } from "@/lib/utils/safe-parse";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";

// Design Tokens for E3 Minimal Engine
const COLOR_BLACK = { r: 0, g: 0, b: 0 }; 
const COLOR_INDIGO = { r: 46 / 255, g: 42 / 255, b: 94 / 255 }; 
const COLOR_WHITE = { r: 1, g: 1, b: 1 };
const COLOR_GRAY = { r: 0.9, g: 0.9, b: 0.9 };
const COLOR_DARK_GRAY = { r: 0.4, g: 0.4, b: 0.4 };

export interface PdfGeneratorOptions {
  logo?: Uint8Array | null;
  headerImage?: Uint8Array | null;
  footerImage?: Uint8Array | null;
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
        i--; // Re-process this word
      } else {
        let splitStr = "";
        let remaining = word;
        for (let j = 0; j < remaining.length; j++) {
          const testCharLine = splitStr + remaining[j];
          if (font.widthOfTextAtSize(testCharLine, fontSize) > maxWidth) {
             if (splitStr) lines.push(splitStr);
             splitStr = remaining[j];
          } else {
             splitStr = testCharLine;
          }
        }
        currentLine = splitStr;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function generatePurchaseRequestPdf(requestData: any, options: PdfGeneratorOptions = {}) {
  const pdfDoc = await PDFDocument.create();
  const [fontBold, fontRegular] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
    pdfDoc.embedFont(StandardFonts.Helvetica),
  ]);

  const headerImg = options.headerImage ? await pdfDoc.embedPng(options.headerImage).catch(() => null) : null;
  const footerImg = options.footerImage ? await pdfDoc.embedPng(options.footerImage).catch(() => null) : null;
  const logoImg = options.logo ? await pdfDoc.embedPng(options.logo).catch(() => null) : null;

  const PAGE_HEIGHT = 841.89;
  const PAGE_WIDTH = 595.28;
  const SAFE_ZONE_TOP = 80;
  const SAFE_ZONE_BOTTOM = 100;
  
  const black = rgb(COLOR_BLACK.r, COLOR_BLACK.g, COLOR_BLACK.b);
  const indigo = rgb(COLOR_INDIGO.r, COLOR_INDIGO.g, COLOR_INDIGO.b);
  const white = rgb(COLOR_WHITE.r, COLOR_WHITE.g, COLOR_WHITE.b);
  const borderGray = rgb(COLOR_GRAY.r, COLOR_GRAY.g, COLOR_GRAY.b);
  const darkGray = rgb(COLOR_DARK_GRAY.r, COLOR_DARK_GRAY.g, COLOR_DARK_GRAY.b);

  const drawHeaderAndFooter = (page: any) => {
    // Header
    if (headerImg) {
      page.drawImage(headerImg, { x: 0, y: PAGE_HEIGHT - 80, width: PAGE_WIDTH, height: 80 });
    } else if (logoImg) {
      const logoWidth = 60;
      const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
      page.drawImage(logoImg, { x: 40, y: PAGE_HEIGHT - 65, width: logoWidth, height: logoHeight });
    }

    // Footer
    if (footerImg) {
      page.drawImage(footerImg, { x: 0, y: 0, width: PAGE_WIDTH, height: 80 });
    } else {
      page.drawLine({
        start: { x: 40, y: 40 },
        end: { x: PAGE_WIDTH - 40, y: 40 },
        thickness: 0.5,
        color: borderGray,
      });
      page.drawText("PurchaseTracker Enterprise Platform", { x: 40, y: 25, size: 8, font: fontBold, color: indigo });
    }

    const timestamp = format(new Date(), "dd MMM yyyy, hh:mm a");
    if (footerImg) {
      // Draw above the footer image to avoid overlapping text inside the image
      page.drawText(`Generated on: ${timestamp}`, { x: PAGE_WIDTH - 150, y: 85, size: 6, font: fontRegular, color: darkGray });
    } else {
      page.drawText(`Generated on: ${timestamp}`, { x: PAGE_WIDTH - 150, y: 25, size: 6, font: fontRegular, color: darkGray });
    }
  };

  const drawMeta = (p: any, xVal: number, yVal: number, key: string, val: string) => {
    p.drawText(`${key}:`, { x: xVal, y: yVal, size: 8, font: fontBold, color: indigo });
    
    // Truncate text if it's too long to prevent overlapping the next column
    const safeVal = val || "N/A";
    const truncatedVal = safeVal.length > 40 ? safeVal.substring(0, 37) + "..." : safeVal;
    
    p.drawText(truncatedVal, { x: xVal + 75, y: yVal, size: 8, font: fontRegular, color: black });
  };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeaderAndFooter(page);

  let y = PAGE_HEIGHT - SAFE_ZONE_TOP - 20;

  // Title & Core Tracking
  page.drawText("PURCHASE REQUEST", { x: 40, y, size: 24, font: fontBold, color: black });
  page.drawText(`PR REF: ${requestData.requestNumber}`, { x: PAGE_WIDTH - 150, y, size: 12, font: fontBold, color: indigo });
  
  y -= 25;
  page.drawText(`STATUS: `, { x: 40, y, size: 9, font: fontBold, color: indigo });
  page.drawText(`${(requestData.status || "DRAFT").toUpperCase().replace(/_/g, ' ')}`, { x: 85, y, size: 9, font: fontBold, color: black });

  y -= 15;
  page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 1, color: borderGray });
  y -= 20;

  // Metadata Grid
  drawMeta(page, 40, y, "Requester", requestData.requester?.username || "N/A");
  drawMeta(page, PAGE_WIDTH / 2, y, "Department", requestData.requester?.department || "N/A");
  y -= 15;
  drawMeta(page, 40, y, "Created Date", requestData.createdAt ? format(new Date(requestData.createdAt), "dd MMM yyyy") : "N/A");
  drawMeta(page, PAGE_WIDTH / 2, y, "Priority", requestData.priority?.toUpperCase() || "MEDIUM");
  y -= 15;
  drawMeta(page, 40, y, "Vendor", requestData.vendor?.companyName || "N/A");
  drawMeta(page, PAGE_WIDTH / 2, y, "Vendor Contact", requestData.vendor?.contactPerson || "N/A");
  y -= 15;
  drawMeta(page, 40, y, "Currency", requestData.currency || "QAR");
  drawMeta(page, PAGE_WIDTH / 2, y, "Purpose Type", requestData.purposeType || "N/A");
  y -= 15;
  drawMeta(page, 40, y, "Sub-Purpose", requestData.subPurpose?.name || "N/A");
  drawMeta(page, PAGE_WIDTH / 2, y, "Payment Mode", requestData.paymentStructure?.replace(/_/g, ' ') || "POST PROJECT");
  y -= 15;
  drawMeta(page, 40, y, "Priority Reason", (requestData.priorityReason || "None provided").substring(0, 40));
  drawMeta(page, PAGE_WIDTH / 2, y, "System Lock", requestData.isLocked ? "YES (Approved/Processing)" : "NO");

  y -= 30;
  if (y < SAFE_ZONE_BOTTOM + 60) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);
    y = PAGE_HEIGHT - SAFE_ZONE_TOP;
  }
  page.drawText("REQUIREMENT OVERVIEW", { x: 40, y, size: 9, font: fontBold, color: indigo });
  y -= 15;
  const titleLines = wrapText(requestData.title || "Untitled", PAGE_WIDTH - 80, fontBold, 12);
  for (const line of titleLines) {
    if (y < SAFE_ZONE_BOTTOM + 15) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }
    page.drawText(line, { x: 40, y, size: 12, font: fontBold, color: black });
    y -= 15;
  }
  y += 15; // Revert extra jump
  
  // Description
  if (requestData.description) {
    y -= 15;
    const descLines = wrapText(requestData.description, PAGE_WIDTH - 80, fontRegular, 8);
    for (const line of descLines) {
      if (y < SAFE_ZONE_BOTTOM + 15) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderAndFooter(page);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }
      page.drawText(line, { x: 40, y, size: 8, font: fontRegular, color: darkGray });
      y -= 10;
    }
  }

  y -= 25;
  if (y < SAFE_ZONE_BOTTOM + 50) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);
    y = PAGE_HEIGHT - SAFE_ZONE_TOP;
  }

  // Items Breakdown Table
  page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 20, color: indigo });
  page.drawText("REQUEST ITEM BREAKDOWN", { x: 45, y: y + 2, size: 9, font: fontBold, color: white });
  y -= 25;

  page.drawLine({ start: { x: 40, y: y + 15 }, end: { x: PAGE_WIDTH - 40, y: y + 15 }, thickness: 1, color: indigo });
  page.drawText("DESCRIPTION", { x: 45, y, size: 8, font: fontBold, color: indigo });
  page.drawText("QTY", { x: 350, y, size: 8, font: fontBold, color: indigo });
  page.drawText("COST", { x: 420, y, size: 8, font: fontBold, color: indigo });
  page.drawText("TOTAL", { x: 490, y, size: 8, font: fontBold, color: indigo });
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.5, color: borderGray });
  y -= 15;

  const items = safeParseItems(requestData.items);
  let subtotal = 0;
  for (const item of items) {
    if (y < SAFE_ZONE_BOTTOM + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    const itemTotal = (item.quantity || 0) * (item.estimatedCost || 0);
    subtotal += itemTotal;

    const nameLines = wrapText(item.name || "", 290, fontRegular, 8); // x is 45, QTY is 350
    const firstLineName = nameLines.length > 0 ? nameLines[0] : "";
    
    page.drawText(firstLineName, { x: 45, y, size: 8, font: fontRegular, color: black });
    page.drawText((item.quantity || 0).toString(), { x: 350, y, size: 8, font: fontRegular, color: black });
    page.drawText((item.estimatedCost || 0).toLocaleString(), { x: 420, y, size: 8, font: fontRegular, color: black });
    page.drawText(itemTotal.toLocaleString(), { x: 490, y, size: 8, font: fontBold, color: black });
    
    for (let i = 1; i < nameLines.length; i++) {
        y -= 10;
        if (y < SAFE_ZONE_BOTTOM + 10) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            drawHeaderAndFooter(page);
            y = PAGE_HEIGHT - SAFE_ZONE_TOP;
        }
        page.drawText(nameLines[i], { x: 45, y, size: 8, font: fontRegular, color: black });
    }

    if (item.description) {
      y -= 10;
      const itemDescLines = wrapText(`Note: ${item.description}`, PAGE_WIDTH - 80, fontRegular, 6);
      for (const line of itemDescLines) {
         if (y < SAFE_ZONE_BOTTOM + 10) {
             page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
             drawHeaderAndFooter(page);
             y = PAGE_HEIGHT - SAFE_ZONE_TOP;
         }
         page.drawText(line, { x: 45, y, size: 6, font: fontRegular, color: darkGray });
         y -= 10;
      }
    }

    y -= 15;
    page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.5, color: borderGray });
    y -= 10;
  }

  y -= 15;
  if (y < SAFE_ZONE_BOTTOM + 80) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);
    y = PAGE_HEIGHT - SAFE_ZONE_TOP;
  }

  // Financial summary box
  const currencyStr = requestData.currency || "QAR";
  const freightVal = Number(requestData.freightAmount) || 0;
  const grandTotal = subtotal + freightVal;

  const summaryX = PAGE_WIDTH - 220;
  const hasRevisedCost = requestData.revisedTotalCost && requestData.revisedTotalCost !== grandTotal;
  const boxHeight = hasRevisedCost ? 75 : 60;
  
  page.drawRectangle({ x: summaryX, y: y - (hasRevisedCost ? 70 : 55), width: 180, height: boxHeight, color: white, borderColor: indigo, borderWidth: 1 });
  
  page.drawText("FINANCIAL SUMMARY", { x: summaryX + 10, y: y - 2, size: 8, font: fontBold, color: indigo });
  page.drawText(`Subtotal:`, { x: summaryX + 10, y: y - 15, size: 7, font: fontRegular, color: darkGray });
  page.drawText(`${subtotal.toLocaleString()} ${currencyStr}`, { x: summaryX + 90, y: y - 15, size: 7, font: fontRegular, color: black });
  
  page.drawText(`Freight:`, { x: summaryX + 10, y: y - 27, size: 7, font: fontRegular, color: darkGray });
  page.drawText(`${freightVal.toLocaleString()} ${currencyStr}`, { x: summaryX + 90, y: y - 27, size: 7, font: fontRegular, color: black });
  
  page.drawLine({ start: { x: summaryX + 10, y: y - 34 }, end: { x: summaryX + 170, y: y - 34 }, thickness: 0.5, color: borderGray });
  
  page.drawText(hasRevisedCost ? `Orig Total:` : `Grand Total:`, { x: summaryX + 10, y: y - 46, size: 8, font: fontBold, color: indigo });
  page.drawText(`${grandTotal.toLocaleString()} ${currencyStr}`, { x: summaryX + 90, y: y - 46, size: 9, font: fontBold, color: black });

  if (hasRevisedCost) {
    page.drawLine({ start: { x: summaryX + 10, y: y - 53 }, end: { x: summaryX + 170, y: y - 53 }, thickness: 0.5, color: borderGray });
    page.drawText(`Revised Total:`, { x: summaryX + 10, y: y - 65, size: 8, font: fontBold, color: rgb(0.8, 0.2, 0.2) });
    page.drawText(`${requestData.revisedTotalCost.toLocaleString()} ${currencyStr}`, { x: summaryX + 90, y: y - 65, size: 9, font: fontBold, color: rgb(0.8, 0.2, 0.2) });
    y -= 15;
  }

  y -= 70;

  // Payment Installments Schedule
  const installments = requestData.installments || [];
  if (installments.length > 0) {
    if (y < SAFE_ZONE_BOTTOM + 70) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 15, color: indigo });
    page.drawText("PAYMENT SCHEDULE", { x: 45, y: y + 1, size: 8, font: fontBold, color: white });
    y -= 20;

    // Table Header
    page.drawText("INSTALLMENT", { x: 45, y, size: 7, font: fontBold, color: indigo });
    page.drawText("DUE DATE", { x: 200, y, size: 7, font: fontBold, color: indigo });
    page.drawText("VALUE", { x: 300, y, size: 7, font: fontBold, color: indigo });
    page.drawText("AMOUNT", { x: 400, y, size: 7, font: fontBold, color: indigo });
    page.drawText("STATUS", { x: 490, y, size: 7, font: fontBold, color: indigo });
    y -= 5;
    page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.5, color: borderGray });
    y -= 12;

    for (const inst of installments) {
      if (y < SAFE_ZONE_BOTTOM + 20) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderAndFooter(page);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }

      const formattedDueDate = inst.dueDate ? format(new Date(inst.dueDate), "dd MMM yyyy") : "N/A";
      const valueStr = inst.valueType === "PERCENTAGE" ? `${inst.amountValue}%` : "Fixed";
      const calculatedAmtStr = `${(inst.calculatedAmount || 0).toLocaleString()} ${inst.currency || "QAR"}`;

      page.drawText(inst.installmentName || "Milestone", { x: 45, y, size: 7, font: fontRegular, color: black });
      page.drawText(formattedDueDate, { x: 200, y, size: 7, font: fontRegular, color: black });
      page.drawText(valueStr, { x: 300, y, size: 7, font: fontRegular, color: black });
      page.drawText(calculatedAmtStr, { x: 400, y, size: 7, font: fontRegular, color: black });
      page.drawText((inst.status || "PENDING").toUpperCase(), { x: 490, y, size: 7, font: fontBold, color: inst.status === "paid" ? black : darkGray });

      y -= 12;
      page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.3, color: borderGray });
      y -= 8;
    }
    y -= 15;
  }

  // Attachments List
  const attachments = requestData.attachments || [];
  if (attachments.length > 0) {
    if (y < SAFE_ZONE_BOTTOM + 50) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 15, color: indigo });
    page.drawText("ATTACHED DOCUMENTS", { x: 45, y: y + 1, size: 8, font: fontBold, color: white });
    y -= 20;

    for (const file of attachments) {
      if (y < SAFE_ZONE_BOTTOM + 15) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderAndFooter(page);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }
      
      const sizeStr = (file.fileSize / 1024).toFixed(1) + " KB";
      page.drawText(`• ${file.fileName} (${sizeStr})`, { x: 45, y, size: 7, font: fontRegular, color: black });
      y -= 12;
    }
    y -= 10;
  }

  // Signatures
  if (y < SAFE_ZONE_BOTTOM + 120) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);
    y = PAGE_HEIGHT - SAFE_ZONE_TOP;
  }

  page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 15, color: indigo });
  page.drawText("MANDATORY SIGN-OFFS", { x: 45, y: y + 1, size: 8, font: fontBold, color: white });
  
  y -= 55;

  const allApprovals = requestData.approvals || [];
  const sigs = [
    { title: "Department Manager", data: allApprovals.find((a: any) => !['Finance', 'CEO Office', 'Management'].includes(a.department)) },
    { title: "Finance Head", data: allApprovals.find((a: any) => a.department === "Finance") },
    { title: "Management", data: allApprovals.find((a: any) => a.department === "Management") },
    { title: "CEO", data: allApprovals.find((a: any) => a.department === "CEO Office") }
  ];

  let blockX = 50;
  for (const sig of sigs) {
    page.drawLine({ start: { x: blockX, y }, end: { x: blockX + 110, y }, thickness: 1, color: black });
    page.drawText(sig.title, { x: blockX, y: y - 12, size: 7, font: fontBold, color: indigo });
    
    let statusText = "Awaiting Approval";
    let statusColor = darkGray;
    let commentText = "";
    let dateText = "";

    if (sig.data?.status === 'approved') {
      statusText = `Approved: ${sig.data.approver?.username || 'SYSTEM'}`;
      statusColor = black;
      if (sig.data.processedAt) {
        dateText = format(new Date(sig.data.processedAt), "dd MMM yyyy HH:mm");
      }
      if (sig.data.comments) {
        commentText = sig.data.comments;
      }
    } else if (sig.data?.status === 'rejected') {
      statusText = "REJECTED";
      if (sig.data.processedAt) {
        dateText = format(new Date(sig.data.processedAt), "dd MMM yyyy HH:mm");
      }
      if (sig.data.comments) {
        commentText = sig.data.comments;
      }
    }

    page.drawText(statusText, { x: blockX, y: y + 5, size: 6, font: fontRegular, color: statusColor });
    if (dateText) {
      page.drawText(dateText, { x: blockX, y: y - 22, size: 5, font: fontRegular, color: darkGray });
    }
    if (commentText) {
      const truncatedComment = commentText.length > 25 ? `${commentText.substring(0, 22)}...` : commentText;
      page.drawText(`"${truncatedComment}"`, { x: blockX, y: y - 32, size: 5, font: fontRegular, color: darkGray });
    }
    blockX += 125;
  }

  return await pdfDoc.save({ useObjectStreams: false });
}
