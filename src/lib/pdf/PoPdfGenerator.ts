import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { format } from "date-fns";

const COLOR_BLACK = { r: 15 / 255, g: 23 / 255, b: 42 / 255 }; // Slate 900
const COLOR_INDIGO = { r: 30 / 255, g: 30 / 255, b: 46 / 255 }; // Dark Slate #1E1E2E
const COLOR_BRAND_BLUE = { r: 79 / 255, g: 70 / 255, b: 229 / 255 }; // Indigo 600 #4F46E5
const COLOR_EMERALD = { r: 16 / 255, g: 185 / 255, b: 129 / 255 }; // Emerald 500
const COLOR_WHITE = { r: 1, g: 1, b: 1 };
const COLOR_LIGHT_BG = { r: 248 / 255, g: 250 / 255, b: 252 / 255 }; // Slate 50
const COLOR_BORDER = { r: 226 / 255, g: 232 / 255, b: 240 / 255 }; // Slate 200
const COLOR_DARK_GRAY = { r: 100 / 255, g: 116 / 255, b: 139 / 255 }; // Slate 500
const COLOR_LIGHT_MUTED = { r: 241 / 255, g: 245 / 255, b: 249 / 255 }; // Slate 100

export interface PoPdfOptions {
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
  publicPortalUrl?: string | null;
}

function parseHexColor(hex?: string | null, defaultColor = COLOR_BRAND_BLUE) {
  if (!hex || !hex.startsWith("#")) return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
  return rgb(r, g, b);
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
            lines.push(splitStr);
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

function safeFormatDate(d: any, formatStr = "dd MMM yyyy"): string {
  if (!d) return "N/A";
  try {
    const dateObj = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
    return isNaN(dateObj.getTime()) ? "N/A" : format(dateObj, formatStr);
  } catch {
    return "N/A";
  }
}

export async function generatePurchaseOrderPdf(poData: any, options: PoPdfOptions = {}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const [fontBold, fontRegular] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
    pdfDoc.embedFont(StandardFonts.Helvetica),
  ]);

  const [headerImg, footerImg, logoImg] = await Promise.all([
    options.headerImage
      ? pdfDoc.embedPng(options.headerImage).catch(async () => {
          return await pdfDoc.embedJpg(options.headerImage!).catch(() => null);
        })
      : null,
    options.footerImage
      ? pdfDoc.embedPng(options.footerImage).catch(async () => {
          return await pdfDoc.embedJpg(options.footerImage!).catch(() => null);
        })
      : null,
    options.logo
      ? pdfDoc.embedPng(options.logo).catch(async () => {
          return await pdfDoc.embedJpg(options.logo!).catch(() => null);
        })
      : null,
  ]);

  const PAGE_HEIGHT = 841.89; // A4 height
  const PAGE_WIDTH = 595.28;  // A4 width
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 515.28

  const black = rgb(COLOR_BLACK.r, COLOR_BLACK.g, COLOR_BLACK.b);
  const indigo = rgb(COLOR_INDIGO.r, COLOR_INDIGO.g, COLOR_INDIGO.b);
  const brandBlue = rgb(COLOR_BRAND_BLUE.r, COLOR_BRAND_BLUE.g, COLOR_BRAND_BLUE.b);
  const headerAccentColor = parseHexColor(options.headerColor, COLOR_BRAND_BLUE);
  const footerAccentColor = parseHexColor(options.footerColor, COLOR_BRAND_BLUE);
  const emerald = rgb(COLOR_EMERALD.r, COLOR_EMERALD.g, COLOR_EMERALD.b);
  const white = rgb(COLOR_WHITE.r, COLOR_WHITE.g, COLOR_WHITE.b);
  const lightBg = rgb(COLOR_LIGHT_BG.r, COLOR_LIGHT_BG.g, COLOR_LIGHT_BG.b);
  const borderGray = rgb(COLOR_BORDER.r, COLOR_BORDER.g, COLOR_BORDER.b);
  const darkGray = rgb(COLOR_DARK_GRAY.r, COLOR_DARK_GRAY.g, COLOR_DARK_GRAY.b);
  const lightMuted = rgb(COLOR_LIGHT_MUTED.r, COLOR_LIGHT_MUTED.g, COLOR_LIGHT_MUTED.b);

  let pages: any[] = [];
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(currentPage);

  const drawPageHeader = (page: any, isFirstPage: boolean) => {
    // 1. Watermark if status is draft or cancelled or custom
    const watermark = poData.status === "draft"
      ? "DRAFT"
      : poData.status === "cancelled"
      ? "CANCELLED"
      : options.watermarkText && options.watermarkText !== "INTERNAL ONLY"
      ? options.watermarkText
      : null;

    if (watermark) {
      const opacityVal = (options.watermarkOpacity ?? 10) / 100;
      page.drawText(watermark.toUpperCase(), {
        x: 120,
        y: PAGE_HEIGHT / 2 - 40,
        size: 55,
        font: fontBold,
        color: rgb(226 / 255, 232 / 255, 240 / 255),
        rotate: degrees(35),
        opacity: Math.min(Math.max(opacityVal, 0.04), 0.25),
      });
    }

    if (isFirstPage) {
      if (headerImg) {
        // Full-width E3 Corporate Letterhead Header Banner
        const bannerHeight = 72;
        page.drawImage(headerImg, {
          x: 0,
          y: PAGE_HEIGHT - bannerHeight,
          width: PAGE_WIDTH,
          height: bannerHeight,
        });

        // Document Identity Bar under letterhead
        const titleY = PAGE_HEIGHT - bannerHeight - 24;

        // Left side: Billing Company / Header Title from Settings
        const companyName = poData.billingCompany || options.headerTitle || "E3 HOLDINGS";
        page.drawText(companyName.toUpperCase(), {
          x: MARGIN,
          y: titleY,
          size: 12,
          font: fontBold,
          color: indigo,
        });
        page.drawText(options.headerSubtitle || "Official Commercial Purchase Order • Procurement Document", {
          x: MARGIN,
          y: titleY - 12,
          size: 7.5,
          font: fontRegular,
          color: darkGray,
        });

        // Right side: Document Title & PO Number
        const title = "PURCHASE ORDER";
        const titleWidth = fontBold.widthOfTextAtSize(title, 16);
        page.drawText(title, {
          x: PAGE_WIDTH - MARGIN - titleWidth,
          y: titleY + 1,
          size: 16,
          font: fontBold,
          color: headerAccentColor,
        });

        const poNum = poData.poNumber || "PO-DRAFT";
        const poNumWidth = fontBold.widthOfTextAtSize(poNum, 11);
        page.drawText(poNum, {
          x: PAGE_WIDTH - MARGIN - poNumWidth,
          y: titleY - 12,
          size: 11,
          font: fontBold,
          color: headerAccentColor,
        });
      } else {
        // Top Brand Accent Strip
        page.drawRectangle({
          x: 0,
          y: PAGE_HEIGHT - 6,
          width: PAGE_WIDTH,
          height: 6,
          color: headerAccentColor,
        });

        // Logo
        if (logoImg) {
          const logoWidth = 70;
          const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
          page.drawImage(logoImg, {
            x: MARGIN,
            y: PAGE_HEIGHT - 55 - (logoHeight > 35 ? logoHeight - 35 : 0),
            width: logoWidth,
            height: logoHeight,
          });
        } else {
          page.drawText(options.headerTitle || "E3 HOLDINGS", {
            x: MARGIN,
            y: PAGE_HEIGHT - 50,
            size: 16,
            font: fontBold,
            color: headerAccentColor,
          });
        }

        // Title & Document Badge
        const title = "PURCHASE ORDER";
        const titleWidth = fontBold.widthOfTextAtSize(title, 20);
        page.drawText(title, {
          x: PAGE_WIDTH - MARGIN - titleWidth,
          y: PAGE_HEIGHT - 45,
          size: 20,
          font: fontBold,
          color: indigo,
        });

        const poNum = poData.poNumber || "PO-DRAFT";
        const poNumWidth = fontBold.widthOfTextAtSize(poNum, 11);
        page.drawText(poNum, {
          x: PAGE_WIDTH - MARGIN - poNumWidth,
          y: PAGE_HEIGHT - 60,
          size: 11,
          font: fontBold,
          color: headerAccentColor,
        });
      }
    } else {
      // Continuation pages header
      if (headerImg) {
        page.drawImage(headerImg, {
          x: 0,
          y: PAGE_HEIGHT - 36,
          width: PAGE_WIDTH,
          height: 36,
        });
        page.drawText(`Purchase Order: ${poData.poNumber || ""}`, {
          x: MARGIN,
          y: PAGE_HEIGHT - 48,
          size: 8,
          font: fontBold,
          color: darkGray,
        });
        page.drawText(`Reference PR: ${poData.request?.requestNumber || ""}`, {
          x: PAGE_WIDTH - MARGIN - 120,
          y: PAGE_HEIGHT - 48,
          size: 8,
          font: fontRegular,
          color: darkGray,
        });
      } else {
        page.drawText(`Purchase Order: ${poData.poNumber || ""}`, {
          x: MARGIN,
          y: PAGE_HEIGHT - 25,
          size: 8,
          font: fontBold,
          color: darkGray,
        });
        page.drawText(`Reference PR: ${poData.request?.requestNumber || ""}`, {
          x: PAGE_WIDTH - MARGIN - 120,
          y: PAGE_HEIGHT - 25,
          size: 8,
          font: fontRegular,
          color: darkGray,
        });
        page.drawLine({
          start: { x: MARGIN, y: PAGE_HEIGHT - 32 },
          end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 32 },
          thickness: 0.5,
          color: borderGray,
        });
      }
    }
  };

  const drawFooter = (page: any, pageIndex: number, totalCount: number) => {
    if (footerImg) {
      // E3 Corporate Letterhead Footer Graphic
      const footerH = 50;
      page.drawImage(footerImg, {
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: footerH,
      });

      const pageNumText = `Page ${pageIndex + 1} of ${totalCount}`;
      const pageNumWidth = fontRegular.widthOfTextAtSize(pageNumText, 7.5);
      page.drawText(pageNumText, {
        x: PAGE_WIDTH - MARGIN - pageNumWidth,
        y: footerH + 4,
        size: 7.5,
        font: fontRegular,
        color: darkGray,
      });
    } else {
      // Bottom border
      page.drawLine({
        start: { x: MARGIN, y: 40 },
        end: { x: PAGE_WIDTH - MARGIN, y: 40 },
        thickness: 0.5,
        color: borderGray,
      });

      const footerNotice = options.footerText || "Official Procurement Document • E3 Institutional Governance Engine • Strictly Confidential";
      page.drawText(footerNotice, {
        x: MARGIN,
        y: 28,
        size: 7,
        font: fontRegular,
        color: footerAccentColor,
      });

      const pageNumText = `Page ${pageIndex + 1} of ${totalCount}`;
      const pageNumWidth = fontRegular.widthOfTextAtSize(pageNumText, 8);
      page.drawText(pageNumText, {
        x: PAGE_WIDTH - MARGIN - pageNumWidth,
        y: 28,
        size: 8,
        font: fontRegular,
        color: darkGray,
      });
    }
  };

  // Draw Page 1 header
  drawPageHeader(currentPage, true);
  let currentY = headerImg ? PAGE_HEIGHT - 128 : PAGE_HEIGHT - 85;

  // ─────────────────────────────────────────────────────────────
  // 1. ORDER SUMMARY METADATA CARD (4 Columns)
  // ─────────────────────────────────────────────────────────────
  const metaCardY = currentY - 54;
  currentPage.drawRectangle({
    x: MARGIN,
    y: metaCardY,
    width: CONTENT_WIDTH,
    height: 54,
    color: lightBg,
    borderColor: borderGray,
    borderWidth: 1,
  });

  const colWidth = CONTENT_WIDTH / 4;
  const metaCols = [
    { label: "DATE OF ISSUE", val: safeFormatDate(poData.issuedAt || poData.createdAt) },
    { label: "EXPECTED DELIVERY", val: safeFormatDate(poData.expectedDeliveryDate) },
    { label: "PAYMENT TERMS", val: (poData.paymentTerms || "Standard").replace(/_/g, " ") },
    { label: "REQUEST REF", val: poData.request?.requestNumber || `REQ-${poData.requestId}` },
  ];

  metaCols.forEach((col, idx) => {
    const colX = MARGIN + idx * colWidth + 12;
    currentPage.drawText(col.label, {
      x: colX,
      y: metaCardY + 34,
      size: 7,
      font: fontBold,
      color: darkGray,
    });
    currentPage.drawText(col.val, {
      x: colX,
      y: metaCardY + 16,
      size: 9,
      font: fontBold,
      color: black,
    });
    if (idx < 3) {
      currentPage.drawLine({
        start: { x: MARGIN + (idx + 1) * colWidth, y: metaCardY + 8 },
        end: { x: MARGIN + (idx + 1) * colWidth, y: metaCardY + 46 },
        thickness: 0.5,
        color: borderGray,
      });
    }
  });

  currentY = metaCardY - 18;

  // ─────────────────────────────────────────────────────────────
  // 2. DUAL ADDRESS BLOCKS: VENDOR & SHIP-TO
  // ─────────────────────────────────────────────────────────────
  const vendor = poData.vendor || {};
  const halfWidth = (CONTENT_WIDTH - 15) / 2;
  const addressBoxHeight = 90;
  const addressBoxY = currentY - addressBoxHeight;

  // VENDOR BOX
  currentPage.drawRectangle({
    x: MARGIN,
    y: addressBoxY,
    width: halfWidth,
    height: addressBoxHeight,
    color: white,
    borderColor: borderGray,
    borderWidth: 1,
  });
  // Vendor Header Bar
  currentPage.drawRectangle({
    x: MARGIN,
    y: addressBoxY + addressBoxHeight - 18,
    width: halfWidth,
    height: 18,
    color: lightMuted,
  });
  currentPage.drawText("VENDOR / SUPPLIER DETAILS", {
    x: MARGIN + 10,
    y: addressBoxY + addressBoxHeight - 13,
    size: 7.5,
    font: fontBold,
    color: indigo,
  });
  currentPage.drawText(vendor.companyName || "Vendor Name Not Set", {
    x: MARGIN + 10,
    y: addressBoxY + 54,
    size: 9.5,
    font: fontBold,
    color: black,
  });
  currentPage.drawText(`Contact: ${vendor.contactPerson || "Procurement Dept"} • ${vendor.contactNumber || ""}`, {
    x: MARGIN + 10,
    y: addressBoxY + 40,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  currentPage.drawText(`Email: ${vendor.email || "N/A"}`, {
    x: MARGIN + 10,
    y: addressBoxY + 28,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  currentPage.drawText(`Address: ${vendor.address || "Doha, Qatar"}`, {
    x: MARGIN + 10,
    y: addressBoxY + 16,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  if (vendor.taxNumber || vendor.registrationNumber) {
    currentPage.drawText(`CR / Tax ID: ${vendor.registrationNumber || vendor.taxNumber || "N/A"}`, {
      x: MARGIN + 10,
      y: addressBoxY + 4,
      size: 7,
      font: fontRegular,
      color: darkGray,
    });
  }

  // SHIP-TO / BILL-TO BOX
  const shipBoxX = MARGIN + halfWidth + 15;
  currentPage.drawRectangle({
    x: shipBoxX,
    y: addressBoxY,
    width: halfWidth,
    height: addressBoxHeight,
    color: white,
    borderColor: borderGray,
    borderWidth: 1,
  });
  // Ship Header Bar
  currentPage.drawRectangle({
    x: shipBoxX,
    y: addressBoxY + addressBoxHeight - 18,
    width: halfWidth,
    height: 18,
    color: lightMuted,
  });
  currentPage.drawText("SHIP TO & BILLING ENTITY", {
    x: shipBoxX + 10,
    y: addressBoxY + addressBoxHeight - 13,
    size: 7.5,
    font: fontBold,
    color: indigo,
  });
  const billingCompany = poData.billingCompany || "E3 Management Solutions & Logistics W.L.L";
  currentPage.drawText(billingCompany, {
    x: shipBoxX + 10,
    y: addressBoxY + 54,
    size: 9,
    font: fontBold,
    color: black,
  });
  const deliveryStr = `Delivery: ${poData.deliveryAddress || "E3 Headquarters, Logistics & Receiving Department, Doha, Qatar"}`;
  const deliveryTrunc = deliveryStr.length > 52 ? deliveryStr.substring(0, 49) + "..." : deliveryStr;
  currentPage.drawText(deliveryTrunc, {
    x: shipBoxX + 10,
    y: addressBoxY + 40,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  const billingStr = `Billing: ${poData.billingAddress || "E3 Management Solutions & Logistics W.L.L, Finance Department, Doha, Qatar"}`;
  const billingTrunc = billingStr.length > 52 ? billingStr.substring(0, 49) + "..." : billingStr;
  currentPage.drawText(billingTrunc, {
    x: shipBoxX + 10,
    y: addressBoxY + 26,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  currentPage.drawText("Authorized Officer: Finance Department", {
    x: shipBoxX + 10,
    y: addressBoxY + 12,
    size: 7.5,
    font: fontBold,
    color: darkGray,
  });

  currentY = addressBoxY - 20;

  // ─────────────────────────────────────────────────────────────
  // 3. ITEMIZATION TABLE
  // ─────────────────────────────────────────────────────────────
  const tableHeaderHeight = 22;
  currentPage.drawRectangle({
    x: MARGIN,
    y: currentY - tableHeaderHeight,
    width: CONTENT_WIDTH,
    height: tableHeaderHeight,
    color: indigo,
  });

  const colItemNum = 30;
  const colDesc = 245;
  const colQty = 55;
  const colUnitPrice = 90;
  const colTotal = 95.28;

  const currency = poData.currency || "QAR";

  currentPage.drawText("#", { x: MARGIN + 8, y: currentY - 15, size: 8, font: fontBold, color: white });
  currentPage.drawText("ITEM DESCRIPTION & SPECIFICATIONS", { x: MARGIN + colItemNum + 5, y: currentY - 15, size: 8, font: fontBold, color: white });
  currentPage.drawText("QTY", { x: MARGIN + colItemNum + colDesc + 10, y: currentY - 15, size: 8, font: fontBold, color: white });
  currentPage.drawText(`UNIT PRICE (${currency})`, { x: MARGIN + colItemNum + colDesc + colQty + 5, y: currentY - 15, size: 8, font: fontBold, color: white });
  currentPage.drawText(`TOTAL (${currency})`, { x: MARGIN + colItemNum + colDesc + colQty + colUnitPrice + 10, y: currentY - 15, size: 8, font: fontBold, color: white });

  currentY -= tableHeaderHeight;

  const items = Array.isArray(poData.itemsSnapshot) ? poData.itemsSnapshot : [];
  
  items.forEach((item: any, idx: number) => {
    const itemName = item.name || `Item ${idx + 1}`;
    const itemDesc = item.description || "";
    const nameLines = wrapText(itemName, colDesc - 10, fontBold, 8.5);
    const descLines = itemDesc ? wrapText(itemDesc, colDesc - 10, fontRegular, 7.5) : [];
    const totalLines = nameLines.length + descLines.length;
    const rowHeight = Math.max(26, totalLines * 12 + 10);

    // Page overflow check
    if (currentY - rowHeight < 160) {
      // Add page
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(currentPage);
      drawPageHeader(currentPage, false);
      currentY = PAGE_HEIGHT - 60;

      // Redraw table header on new page
      currentPage.drawRectangle({
        x: MARGIN,
        y: currentY - tableHeaderHeight,
        width: CONTENT_WIDTH,
        height: tableHeaderHeight,
        color: indigo,
      });
      currentPage.drawText("#", { x: MARGIN + 8, y: currentY - 15, size: 8, font: fontBold, color: white });
      currentPage.drawText("ITEM DESCRIPTION & SPECIFICATIONS (CONT.)", { x: MARGIN + colItemNum + 5, y: currentY - 15, size: 8, font: fontBold, color: white });
      currentPage.drawText("QTY", { x: MARGIN + colItemNum + colDesc + 10, y: currentY - 15, size: 8, font: fontBold, color: white });
      currentPage.drawText(`UNIT PRICE (${currency})`, { x: MARGIN + colItemNum + colDesc + colQty + 5, y: currentY - 15, size: 8, font: fontBold, color: white });
      currentPage.drawText(`TOTAL (${currency})`, { x: MARGIN + colItemNum + colDesc + colQty + colUnitPrice + 10, y: currentY - 15, size: 8, font: fontBold, color: white });
      currentY -= tableHeaderHeight;
    }

    // Alternating Row Background
    if (idx % 2 === 1) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: currentY - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: lightBg,
      });
    }

    // Row bottom border
    currentPage.drawLine({
      start: { x: MARGIN, y: currentY - rowHeight },
      end: { x: PAGE_WIDTH - MARGIN, y: currentY - rowHeight },
      thickness: 0.5,
      color: borderGray,
    });

    // Row cell values
    currentPage.drawText(String(idx + 1), {
      x: MARGIN + 10,
      y: currentY - 16,
      size: 8,
      font: fontRegular,
      color: darkGray,
    });

    let textY = currentY - 15;
    nameLines.forEach((l) => {
      currentPage.drawText(l, { x: MARGIN + colItemNum + 5, y: textY, size: 8.5, font: fontBold, color: black });
      textY -= 11;
    });
    descLines.forEach((l) => {
      currentPage.drawText(l, { x: MARGIN + colItemNum + 5, y: textY, size: 7.5, font: fontRegular, color: darkGray });
      textY -= 10;
    });

    const qty = String(item.quantity || 1);
    currentPage.drawText(qty, {
      x: MARGIN + colItemNum + colDesc + 18,
      y: currentY - 16,
      size: 8.5,
      font: fontRegular,
      color: black,
    });

    const unitPrice = Number(item.unitPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    currentPage.drawText(unitPrice, {
      x: MARGIN + colItemNum + colDesc + colQty + 10,
      y: currentY - 16,
      size: 8.5,
      font: fontRegular,
      color: black,
    });

    const lineTotal = Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    currentPage.drawText(lineTotal, {
      x: MARGIN + colItemNum + colDesc + colQty + colUnitPrice + 15,
      y: currentY - 16,
      size: 8.5,
      font: fontBold,
      color: black,
    });

    currentY -= rowHeight;
  });

  currentY -= 12;

  // ─────────────────────────────────────────────────────────────
  // 4. TOTALS CALCULATION BOX
  // ─────────────────────────────────────────────────────────────
  if (currentY - 130 < 100) {
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(currentPage);
    drawPageHeader(currentPage, false);
    currentY = PAGE_HEIGHT - 60;
  }

  const totalsBoxWidth = 200;
  const totalsBoxX = PAGE_WIDTH - MARGIN - totalsBoxWidth;
  const totalsBoxHeight = 85;
  const totalsBoxY = currentY - totalsBoxHeight;

  currentPage.drawRectangle({
    x: totalsBoxX,
    y: totalsBoxY,
    width: totalsBoxWidth,
    height: totalsBoxHeight,
    color: lightBg,
    borderColor: borderGray,
    borderWidth: 1,
  });

  const subtotal = Number(poData.subtotalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const freight = Number(poData.freightAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = Number(poData.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  currentPage.drawText("Subtotal:", { x: totalsBoxX + 15, y: totalsBoxY + 65, size: 8, font: fontRegular, color: darkGray });
  currentPage.drawText(`${currency} ${subtotal}`, { x: totalsBoxX + totalsBoxWidth - 15 - fontBold.widthOfTextAtSize(`${currency} ${subtotal}`, 8), y: totalsBoxY + 65, size: 8, font: fontBold, color: black });

  currentPage.drawText("Freight / Shipping:", { x: totalsBoxX + 15, y: totalsBoxY + 48, size: 8, font: fontRegular, color: darkGray });
  currentPage.drawText(`${currency} ${freight}`, { x: totalsBoxX + totalsBoxWidth - 15 - fontBold.widthOfTextAtSize(`${currency} ${freight}`, 8), y: totalsBoxY + 48, size: 8, font: fontBold, color: black });

  currentPage.drawLine({
    start: { x: totalsBoxX + 10, y: totalsBoxY + 36 },
    end: { x: totalsBoxX + totalsBoxWidth - 10, y: totalsBoxY + 36 },
    thickness: 0.5,
    color: borderGray,
  });

  currentPage.drawRectangle({
    x: totalsBoxX + 5,
    y: totalsBoxY + 6,
    width: totalsBoxWidth - 10,
    height: 24,
    color: brandBlue,
  });

  currentPage.drawText("TOTAL AMOUNT", { x: totalsBoxX + 15, y: totalsBoxY + 14, size: 8.5, font: fontBold, color: white });
  const grandTotalStr = `${currency} ${total}`;
  currentPage.drawText(grandTotalStr, {
    x: totalsBoxX + totalsBoxWidth - 15 - fontBold.widthOfTextAtSize(grandTotalStr, 9.5),
    y: totalsBoxY + 14,
    size: 9.5,
    font: fontBold,
    color: white,
  });

  // Notes on left side of totals box
  const notesWidth = CONTENT_WIDTH - totalsBoxWidth - 20;
  const notesY = totalsBoxY;
  currentPage.drawRectangle({
    x: MARGIN,
    y: notesY,
    width: notesWidth,
    height: totalsBoxHeight,
    color: white,
    borderColor: borderGray,
    borderWidth: 1,
  });
  currentPage.drawRectangle({
    x: MARGIN,
    y: notesY + totalsBoxHeight - 16,
    width: notesWidth,
    height: 16,
    color: lightMuted,
  });
  currentPage.drawText("SPECIAL INSTRUCTIONS & DELIVERY CONDITIONS", {
    x: MARGIN + 8,
    y: notesY + totalsBoxHeight - 12,
    size: 7,
    font: fontBold,
    color: indigo,
  });

  const specialNotes = poData.specialInstructions || "Please reference the PO Number on all delivery challans, packages, and invoices. Deliveries must be made to the specified address during official working hours.";
  const noteLines = wrapText(specialNotes, notesWidth - 16, fontRegular, 7.5);
  let noteTextY = notesY + totalsBoxHeight - 28;
  noteLines.slice(0, 4).forEach((nl) => {
    currentPage.drawText(nl, { x: MARGIN + 8, y: noteTextY, size: 7.5, font: fontRegular, color: darkGray });
    noteTextY -= 11;
  });

  currentY = totalsBoxY - 20;

  // ─────────────────────────────────────────────────────────────
  // 5. TERMS, SIGNATURES & VERIFICATION SEAL
  // ─────────────────────────────────────────────────────────────
  if (currentY - 95 < 60) {
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(currentPage);
    drawPageHeader(currentPage, false);
    currentY = PAGE_HEIGHT - 60;
  }

  const signBoxHeight = 80;
  const signBoxY = currentY - signBoxHeight;

  // Left side: Standard Legal Terms
  const termsWidth = halfWidth;
  currentPage.drawRectangle({
    x: MARGIN,
    y: signBoxY,
    width: termsWidth,
    height: signBoxHeight,
    color: lightBg,
    borderColor: borderGray,
    borderWidth: 1,
  });
  currentPage.drawText("STANDARD PURCHASE TERMS", {
    x: MARGIN + 10,
    y: signBoxY + signBoxHeight - 14,
    size: 7,
    font: fontBold,
    color: indigo,
  });
  const legalClause = poData.termsAndConditions || "1. Goods subject to final inspection and approval at destination. 2. Invoices must reference this PO number to be processed for payment. 3. This Purchase Order is electronically authenticated under E3 Corporate Governance.";
  const legalLines = wrapText(legalClause, termsWidth - 20, fontRegular, 6.5);
  let lY = signBoxY + signBoxHeight - 26;
  legalLines.slice(0, 4).forEach((ll) => {
    currentPage.drawText(ll, { x: MARGIN + 10, y: lY, size: 6.5, font: fontRegular, color: darkGray });
    lY -= 9;
  });

  // Right side: Authorization & Seal
  const authBoxX = MARGIN + termsWidth + 15;
  currentPage.drawRectangle({
    x: authBoxX,
    y: signBoxY,
    width: halfWidth,
    height: signBoxHeight,
    color: white,
    borderColor: borderGray,
    borderWidth: 1,
  });

  currentPage.drawRectangle({
    x: authBoxX,
    y: signBoxY + signBoxHeight - 16,
    width: halfWidth,
    height: 16,
    color: headerAccentColor,
  });
  currentPage.drawText("AUTHORIZED FINANCE SIGNATURE", {
    x: authBoxX + 10,
    y: signBoxY + signBoxHeight - 12,
    size: 7,
    font: fontBold,
    color: white,
  });

  currentPage.drawText("Digitally Signed & Certified for Issuance", {
    x: authBoxX + 10,
    y: signBoxY + signBoxHeight - 32,
    size: 8,
    font: fontBold,
    color: emerald,
  });
  currentPage.drawText("Issued By: Finance Department", {
    x: authBoxX + 10,
    y: signBoxY + signBoxHeight - 45,
    size: 7.5,
    font: fontBold,
    color: darkGray,
  });
  currentPage.drawText(`Role: Authorized Finance Officer`, {
    x: authBoxX + 10,
    y: signBoxY + signBoxHeight - 56,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });
  currentPage.drawText(`Timestamp: ${safeFormatDate(poData.issuedAt || new Date(), "dd MMM yyyy HH:mm")} AST`, {
    x: authBoxX + 10,
    y: signBoxY + signBoxHeight - 66,
    size: 6.5,
    font: fontRegular,
    color: darkGray,
  });

  if (poData.tokenHash) {
    currentPage.drawText(`Auth Hash: ${poData.tokenHash.substring(0, 24)}...`, {
      x: authBoxX + 10,
      y: signBoxY + 8,
      size: 6.5,
      font: fontRegular,
      color: darkGray,
    });
  }

  // Draw footers on all pages
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    drawFooter(p, idx, totalPages);
  });

  return await pdfDoc.save();
}
