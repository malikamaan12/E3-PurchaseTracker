import { safeParseItems } from "@/lib/utils/safe-parse";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { generateUniqueRequestId } from "@/lib/utils/request-number";

// Design Tokens for E3 Corporate PDF Engine
const COLOR_BLACK = { r: 15 / 255, g: 23 / 255, b: 42 / 255 }; // Slate 900
const COLOR_INDIGO = { r: 30 / 255, g: 30 / 255, b: 46 / 255 }; // Dark Corporate Slate/Indigo #1E1E2E
const COLOR_BRAND_BLUE = { r: 79 / 255, g: 70 / 255, b: 229 / 255 }; // Indigo 600 #4F46E5
const COLOR_WHITE = { r: 1, g: 1, b: 1 };
const COLOR_LIGHT_BG = { r: 248 / 255, g: 250 / 255, b: 252 / 255 }; // Slate 50
const COLOR_BORDER = { r: 226 / 255, g: 232 / 255, b: 240 / 255 }; // Slate 200
const COLOR_DARK_GRAY = { r: 100 / 255, g: 116 / 255, b: 139 / 255 }; // Slate 500

export interface PdfGeneratorOptions {
  logo?: Uint8Array | null;
  headerImage?: Uint8Array | null;
  footerImage?: Uint8Array | null;
  headerTitle?: string | null;
  headerSubtitle?: string | null;
  headerColor?: string | null;
  footerText?: string | null;
  footerColor?: string | null;
  watermarkText?: string | null;
  watermarkOpacity?: number | null;
}

function parseHexColor(hex?: string | null, fallback = COLOR_BRAND_BLUE) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return rgb(fallback.r, fallback.g, fallback.b);
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  } catch {
    return rgb(fallback.r, fallback.g, fallback.b);
  }
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
        i--;
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

  const headerImg = options.headerImage ? await pdfDoc.embedPng(options.headerImage).catch(async () => {
    return await pdfDoc.embedJpg(options.headerImage!).catch(() => null);
  }) : null;

  const footerImg = options.footerImage ? await pdfDoc.embedPng(options.footerImage).catch(async () => {
    return await pdfDoc.embedJpg(options.footerImage!).catch(() => null);
  }) : null;

  const logoImg = options.logo ? await pdfDoc.embedPng(options.logo).catch(async () => {
    return await pdfDoc.embedJpg(options.logo!).catch(() => null);
  }) : null;

  const PAGE_HEIGHT = 841.89;
  const PAGE_WIDTH = 595.28;
  const SAFE_ZONE_TOP = 85;
  const SAFE_ZONE_BOTTOM = 95;
  
  const black = rgb(COLOR_BLACK.r, COLOR_BLACK.g, COLOR_BLACK.b);
  const indigo = rgb(COLOR_INDIGO.r, COLOR_INDIGO.g, COLOR_INDIGO.b);
  const headerAccentColor = parseHexColor(options.headerColor, COLOR_BRAND_BLUE);
  const footerAccentColor = parseHexColor(options.footerColor, COLOR_BRAND_BLUE);
  const white = rgb(COLOR_WHITE.r, COLOR_WHITE.g, COLOR_WHITE.b);
  const lightBg = rgb(COLOR_LIGHT_BG.r, COLOR_LIGHT_BG.g, COLOR_LIGHT_BG.b);
  const borderGray = rgb(COLOR_BORDER.r, COLOR_BORDER.g, COLOR_BORDER.b);
  const darkGray = rgb(COLOR_DARK_GRAY.r, COLOR_DARK_GRAY.g, COLOR_DARK_GRAY.b);

  const drawHeaderAndFooter = (page: any) => {
    // 1. Watermark Background
    const watermarkText = options.watermarkText || "CONFIDENTIAL";
    const opacityVal = Math.min(Math.max((options.watermarkOpacity || 8) / 100, 0.03), 0.25);
    
    page.drawText(watermarkText.toUpperCase(), {
      x: 70,
      y: PAGE_HEIGHT / 2 - 30,
      size: 42,
      font: fontBold,
      color: rgb(203 / 255, 213 / 255, 225 / 255),
      rotate: degrees(35),
      opacity: opacityVal,
    });

    // 2. Header
    if (headerImg) {
      page.drawImage(headerImg, { x: 0, y: PAGE_HEIGHT - 80, width: PAGE_WIDTH, height: 80 });
    } else {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: headerAccentColor });

      if (logoImg) {
        const logoWidth = 65;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        page.drawImage(logoImg, { x: 40, y: PAGE_HEIGHT - 65, width: logoWidth, height: logoHeight });
      }

      if (options.headerTitle) {
        page.drawText(options.headerTitle.toUpperCase(), {
          x: logoImg ? 120 : 40,
          y: PAGE_HEIGHT - 42,
          size: 11,
          font: fontBold,
          color: headerAccentColor
        });
      }

      if (options.headerSubtitle) {
        page.drawText(options.headerSubtitle, {
          x: logoImg ? 120 : 40,
          y: PAGE_HEIGHT - 56,
          size: 8,
          font: fontRegular,
          color: darkGray
        });
      }
    }

    // 3. Footer
    if (footerImg) {
      page.drawImage(footerImg, { x: 0, y: 0, width: PAGE_WIDTH, height: 80 });
    } else {
      page.drawLine({
        start: { x: 40, y: 45 },
        end: { x: PAGE_WIDTH - 40, y: 45 },
        thickness: 0.75,
        color: borderGray,
      });

      const footerLabel = options.footerText || "E3 PurchaseTracker • Enterprise Financial Procurement System";
      page.drawText(footerLabel, { x: 40, y: 28, size: 8, font: fontBold, color: footerAccentColor });
    }

    const timestamp = format(new Date(), "dd MMM yyyy, hh:mm a");
    const timestampY = footerImg ? 85 : 28;
    page.drawText(`Verified Document • Generated: ${timestamp}`, { x: PAGE_WIDTH - 210, y: timestampY, size: 6, font: fontRegular, color: darkGray });
  };

  const drawMeta = (p: any, xVal: number, yVal: number, key: string, val: string) => {
    p.drawText(`${key}:`, { x: xVal, y: yVal, size: 8, font: fontBold, color: headerAccentColor });
    const safeVal = val || "N/A";
    const truncatedVal = safeVal.length > 35 ? safeVal.substring(0, 32) + "..." : safeVal;
    p.drawText(truncatedVal, { x: xVal + 75, y: yVal, size: 8, font: fontRegular, color: black });
  };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeaderAndFooter(page);

  let y = PAGE_HEIGHT - SAFE_ZONE_TOP - 20;

  // Format Request ID: PROJECT - DEPARTMENT - DATE - SEQUENCE
  const formattedReqNumber = (() => {
    if (requestData.requestNumber && !requestData.requestNumber.startsWith("PR-2026")) {
      return requestData.requestNumber;
    }
    const projName = requestData.subPurpose?.name || requestData.purposeType;
    const deptName = requestData.requester?.department;
    const dateVal = requestData.createdAt ? new Date(requestData.createdAt) : new Date();
    const seq = requestData.id || 1;
    return generateUniqueRequestId({
      projectName: projName,
      departmentName: deptName,
      date: dateVal,
      sequence: seq
    });
  })();

  // Document Header Title
  page.drawText("PURCHASE REQUEST", { x: 40, y: y + 5, size: 20, font: fontBold, color: black });

  // Prominent Unique Request ID Badge Box (PROJECT-DEPARTMENT-DATE-SEQUENCE)
  const reqNumText = `ID: ${formattedReqNumber}`;
  const reqNumWidth = fontBold.widthOfTextAtSize(reqNumText, 9) + 20;
  page.drawRectangle({
    x: PAGE_WIDTH - 40 - Math.max(reqNumWidth, 180),
    y: y - 2,
    width: Math.max(reqNumWidth, 180),
    height: 24,
    color: indigo
  });
  page.drawText(reqNumText, {
    x: PAGE_WIDTH - 30 - Math.max(reqNumWidth, 180),
    y: y + 5,
    size: 9,
    font: fontBold,
    color: white
  });

  y -= 25;

  // Color-coded Status Pill
  const statusStr = (requestData.status || "DRAFT").toUpperCase().replace(/_/g, ' ');
  let statusBg = darkGray;
  if (statusStr === "APPROVED") {
    statusBg = rgb(16 / 255, 185 / 255, 129 / 255); // Emerald
  } else if (statusStr === "REJECTED") {
    statusBg = rgb(244 / 255, 63 / 255, 94 / 255); // Rose
  } else {
    statusBg = rgb(245 / 255, 158 / 255, 11 / 255); // Amber
  }

  page.drawRectangle({ x: 40, y: y - 2, width: 100, height: 18, color: statusBg });
  page.drawText(statusStr, { x: 48, y: y + 3, size: 8, font: fontBold, color: white });

  y -= 15;
  page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 1, color: borderGray });
  y -= 20;

  // Metadata Grid Box Background
  page.drawRectangle({
    x: 40,
    y: y - 95,
    width: PAGE_WIDTH - 80,
    height: 110,
    color: lightBg,
    borderColor: borderGray,
    borderWidth: 1
  });

  const gridY = y;
  drawMeta(page, 50, gridY, "Requester", requestData.requester?.username || "N/A");
  drawMeta(page, PAGE_WIDTH / 2 + 10, gridY, "Department", requestData.requester?.department || "N/A");
  
  drawMeta(page, 50, gridY - 18, "Created Date", requestData.createdAt ? format(new Date(requestData.createdAt), "dd MMM yyyy") : "N/A");
  drawMeta(page, PAGE_WIDTH / 2 + 10, gridY - 18, "Priority", requestData.priority?.toUpperCase() || "MEDIUM");
  
  drawMeta(page, 50, gridY - 36, "Vendor", requestData.vendor?.companyName || "N/A");
  drawMeta(page, PAGE_WIDTH / 2 + 10, gridY - 36, "Vendor Contact", requestData.vendor?.contactPerson || "N/A");
  
  drawMeta(page, 50, gridY - 54, "Currency", requestData.currency || "QAR");
  drawMeta(page, PAGE_WIDTH / 2 + 10, gridY - 54, "Purpose Type", requestData.purposeType || "N/A");
  
  drawMeta(page, 50, gridY - 72, "Project / Sub-Purpose", requestData.subPurpose?.name || "N/A");
  y -= 115;

  // Vendor Compliance Notice Stamp (Reads immutable snapshot at submission time)
  const snapshot = requestData.latestComplianceSnapshot?.snapshotData;
  const vendorScore = snapshot?.score ?? requestData.vendor?.complianceScore ?? 100;
  const vendorComplianceStatus = (snapshot?.status || requestData.vendor?.complianceStatus || "compliant").toUpperCase().replace(/_/g, ' ');
  const missingItems = snapshot?.missingMandatoryDocuments || [];
  
  if (vendorScore < 100 || vendorComplianceStatus !== "COMPLIANT") {
    const isCritical = vendorScore < 50 || vendorComplianceStatus === "NON COMPLIANT";
    const stampBg = isCritical ? rgb(254 / 255, 242 / 255, 242 / 255) : rgb(254 / 255, 243 / 255, 199 / 255);
    const stampBorder = isCritical ? rgb(239 / 255, 68 / 255, 68 / 255) : rgb(245 / 255, 158 / 255, 11 / 255);
    const stampText = isCritical ? rgb(185 / 255, 28 / 255, 28 / 255) : rgb(180 / 255, 83 / 255, 9 / 255);

    let noticeText = `VENDOR COMPLIANCE NOTICE: Status at Submission: ${vendorComplianceStatus} (${vendorScore}% Score) — Procurement Proceeded Under Policy`;
    if (missingItems.length > 0) {
      noticeText += ` | Pending Requirements: ${missingItems.slice(0, 3).join(", ")}${missingItems.length > 3 ? ` (+${missingItems.length - 3} more)` : ""}`;
    }

    const wrappedNotice = wrapText(noticeText, PAGE_WIDTH - 100, fontBold, 7.5);
    const boxHeight = Math.max(24, wrappedNotice.length * 11 + 10);

    page.drawRectangle({
      x: 40,
      y: y - boxHeight + 4,
      width: PAGE_WIDTH - 80,
      height: boxHeight,
      color: stampBg,
      borderColor: stampBorder,
      borderWidth: 1,
    });

    let textY = y - 8;
    for (const line of wrappedNotice) {
      page.drawText(line, {
        x: 48,
        y: textY,
        size: 7.5,
        font: fontBold,
        color: stampText,
      });
      textY -= 11;
    }

    y -= (boxHeight + 10);
  }

  if (y < SAFE_ZONE_BOTTOM + 60) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);
    y = PAGE_HEIGHT - SAFE_ZONE_TOP;
  }

  // Requirement Overview
  page.drawRectangle({ x: 40, y: y - 2, width: 4, height: 14, color: headerAccentColor });
  page.drawText("REQUIREMENT OVERVIEW", { x: 50, y, size: 9, font: fontBold, color: headerAccentColor });
  y -= 18;

  const titleLines = wrapText(requestData.title || "Untitled Request", PAGE_WIDTH - 80, fontBold, 12);
  for (const line of titleLines) {
    if (y < SAFE_ZONE_BOTTOM + 15) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }
    page.drawText(line, { x: 40, y, size: 12, font: fontBold, color: black });
    y -= 15;
  }
  
  // Description
  if (requestData.description) {
    y -= 10;
    const descLines = wrapText(requestData.description, PAGE_WIDTH - 80, fontRegular, 8);
    for (const line of descLines) {
      if (y < SAFE_ZONE_BOTTOM + 15) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderAndFooter(page);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }
      page.drawText(line, { x: 40, y, size: 8, font: fontRegular, color: darkGray });
      y -= 11;
    }
  }

  y -= 20;
  if (y < SAFE_ZONE_BOTTOM + 50) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);
    y = PAGE_HEIGHT - SAFE_ZONE_TOP;
  }

  // Items Breakdown Table Header
  page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 20, color: indigo });
  page.drawText("REQUEST ITEM BREAKDOWN", { x: 48, y: y + 2, size: 9, font: fontBold, color: white });
  y -= 25;

  page.drawRectangle({ x: 40, y: y - 3, width: PAGE_WIDTH - 80, height: 16, color: lightBg });
  page.drawText("DESCRIPTION", { x: 48, y, size: 8, font: fontBold, color: headerAccentColor });
  page.drawText("QTY", { x: 350, y, size: 8, font: fontBold, color: headerAccentColor });
  page.drawText("COST", { x: 420, y, size: 8, font: fontBold, color: headerAccentColor });
  page.drawText("TOTAL", { x: 490, y, size: 8, font: fontBold, color: headerAccentColor });
  y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.5, color: borderGray });
  y -= 15;

  const items = safeParseItems(requestData.items);
  let subtotal = 0;
  let rowIndex = 0;

  for (const item of items) {
    if (y < SAFE_ZONE_BOTTOM + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    const itemTotal = (item.quantity || 0) * (item.estimatedCost || 0);
    subtotal += itemTotal;

    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: 40, y: y - 4, width: PAGE_WIDTH - 80, height: 16, color: lightBg });
    }
    rowIndex++;

    const nameLines = wrapText(item.name || "", 290, fontRegular, 8);
    const firstLineName = nameLines.length > 0 ? nameLines[0] : "";
    
    page.drawText(firstLineName, { x: 48, y, size: 8, font: fontRegular, color: black });
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
        page.drawText(nameLines[i], { x: 48, y, size: 8, font: fontRegular, color: black });
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
         page.drawText(line, { x: 48, y, size: 6, font: fontRegular, color: darkGray });
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

  const summaryX = PAGE_WIDTH - 230;
  const hasRevisedCost = requestData.revisedTotalCost && requestData.revisedTotalCost !== grandTotal;
  const boxHeight = hasRevisedCost ? 75 : 60;
  
  page.drawRectangle({ x: summaryX, y: y - (hasRevisedCost ? 70 : 55), width: 190, height: boxHeight, color: lightBg, borderColor: headerAccentColor, borderWidth: 1 });
  
  page.drawText("FINANCIAL SUMMARY", { x: summaryX + 10, y: y - 2, size: 8, font: fontBold, color: headerAccentColor });
  page.drawText(`Subtotal:`, { x: summaryX + 10, y: y - 15, size: 7, font: fontRegular, color: darkGray });
  page.drawText(`${subtotal.toLocaleString()} ${currencyStr}`, { x: summaryX + 100, y: y - 15, size: 7, font: fontRegular, color: black });
  
  page.drawText(`Freight:`, { x: summaryX + 10, y: y - 27, size: 7, font: fontRegular, color: darkGray });
  page.drawText(`${freightVal.toLocaleString()} ${currencyStr}`, { x: summaryX + 100, y: y - 27, size: 7, font: fontRegular, color: black });
  
  page.drawLine({ start: { x: summaryX + 10, y: y - 34 }, end: { x: summaryX + 180, y: y - 34 }, thickness: 0.5, color: borderGray });
  
  page.drawText(hasRevisedCost ? `Orig Total:` : `Grand Total:`, { x: summaryX + 10, y: y - 46, size: 8, font: fontBold, color: headerAccentColor });
  page.drawText(`${grandTotal.toLocaleString()} ${currencyStr}`, { x: summaryX + 100, y: y - 46, size: 9, font: fontBold, color: black });

  if (hasRevisedCost) {
    page.drawLine({ start: { x: summaryX + 10, y: y - 53 }, end: { x: summaryX + 180, y: y - 53 }, thickness: 0.5, color: borderGray });
    page.drawText(`Revised Total:`, { x: summaryX + 10, y: y - 65, size: 8, font: fontBold, color: rgb(0.8, 0.2, 0.2) });
    page.drawText(`${requestData.revisedTotalCost.toLocaleString()} ${currencyStr}`, { x: summaryX + 100, y: y - 65, size: 9, font: fontBold, color: rgb(0.8, 0.2, 0.2) });
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

    page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 18, color: indigo });
    page.drawText("PAYMENT SCHEDULE", { x: 48, y: y + 1, size: 8, font: fontBold, color: white });
    y -= 20;

    page.drawText("INSTALLMENT", { x: 48, y, size: 7, font: fontBold, color: headerAccentColor });
    page.drawText("DUE DATE", { x: 200, y, size: 7, font: fontBold, color: headerAccentColor });
    page.drawText("VALUE", { x: 300, y, size: 7, font: fontBold, color: headerAccentColor });
    page.drawText("AMOUNT", { x: 400, y, size: 7, font: fontBold, color: headerAccentColor });
    page.drawText("STATUS", { x: 490, y, size: 7, font: fontBold, color: headerAccentColor });
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

      page.drawText(inst.installmentName || "Milestone", { x: 48, y, size: 7, font: fontRegular, color: black });
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

    page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 18, color: indigo });
    page.drawText("ATTACHED DOCUMENTS", { x: 48, y: y + 1, size: 8, font: fontBold, color: white });
    y -= 20;

    for (const file of attachments) {
      if (y < SAFE_ZONE_BOTTOM + 15) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderAndFooter(page);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }
      
      const sizeStr = (file.fileSize / 1024).toFixed(1) + " KB";
      page.drawText(`• ${file.fileName} (${sizeStr})`, { x: 48, y, size: 7, font: fontRegular, color: black });
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

  page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 18, color: indigo });
  page.drawText("MANDATORY SIGN-OFFS & APPROVAL TRAIL", { x: 48, y: y + 1, size: 8, font: fontBold, color: white });
  
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
    page.drawLine({ start: { x: blockX, y }, end: { x: blockX + 110, y }, thickness: 1, color: headerAccentColor });
    page.drawText(sig.title, { x: blockX, y: y - 12, size: 7, font: fontBold, color: headerAccentColor });
    
    let statusText = "Awaiting Sign-off";
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
      statusColor = rgb(244 / 255, 63 / 255, 94 / 255);
      if (sig.data.processedAt) {
        dateText = format(new Date(sig.data.processedAt), "dd MMM yyyy HH:mm");
      }
      if (sig.data.comments) {
        commentText = sig.data.comments;
      }
    }

    page.drawText(statusText, { x: blockX, y: y + 5, size: 6, font: fontBold, color: statusColor });
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
