import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings, systemSettings, paymentInstallments } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { format } from "date-fns";
import axios from "axios";

export const dynamic = 'force-dynamic';

/**
 * Pre-fetch utility to convert R2 assets to PDF-compatible buffers.
 * This prevents Vercel timeouts and blank images in serverless environments.
 */
async function fetchImageBuffer(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
    return new Uint8Array(response.data);
  } catch (error) {
    console.error(`[PDF Engine] Failed to pre-fetch branding asset: ${url}`, error);
    return null;
  }
}

// Helper to fetch request with all relations needed for the high-density contract
async function getFullRequestData(requestId: number) {
  return await db.query.purchaseRequests.findFirst({
    where: (pr, { eq }) => eq(pr.id, requestId),
    with: {
      requester: true,
      vendor: true,
      subPurpose: true,
      attachments: true,
      installments: true, // Updated: Using the new Strategic Installments relation
      approvals: {
        with: {
          approver: {
            columns: {
              username: true
            }
          }
        }
      }
    }
  });
}

/**
 * GET /api/requests/[id]/pdf
 * Modernized E3 Enterprise PDF Engine with Hierarchical Branding & Payment Schedule.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // 1. Permissions (Admin, Requester, or involved Approver)
    const canView = user.role === "admin" || 
                    requestData.requesterId === user.id || 
                    requestData.approvals.some((a: any) => a.approverId === user.id);

    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // 2. Fetch Branding & System Config
    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;
    const systemSettingsRecords = await db.select().from(systemSettings).catch(() => []);

    const getSetting = (key: string, defaultValue: any) => {
      const records = systemSettingsRecords as any[];
      return records.find(r => r.key === key)?.value || defaultValue;
    };

    const primaryHex = settings?.headerColor || getSetting("brand_primary_color", "#6F2AE6");
    const secondaryHex = settings?.footerColor || getSetting("brand_secondary_color", "#15CDD8");
    
    // Vibrant Design Tokens
    const { PDFDocument, rgb, StandardFonts, degrees } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.replace('#','').slice(0, 2), 16) / 255;
      const g = parseInt(hex.replace('#','').slice(2, 4), 16) / 255;
      const b = parseInt(hex.replace('#','').slice(4, 6), 16) / 255;
      return { r, g, b };
    };

    const p = hexToRgb(primaryHex);
    const s = hexToRgb(secondaryHex);
    const brandPurple = rgb(p.r, p.g, p.b);
    const brandTeal = rgb(s.r, s.g, s.b);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // 3. Asset Pre-fetching (The Vercel Lifesaver)
    const [headerImgBuffer, footerImgBuffer, logoImgBuffer] = await Promise.all([
      fetchImageBuffer(settings?.headerImage || null),
      fetchImageBuffer(settings?.footerImage || null),
      fetchImageBuffer(settings?.logo || null)
    ]);

    const headerImg = headerImgBuffer ? await pdfDoc.embedPng(headerImgBuffer) : null;
    const footerImg = footerImgBuffer ? await pdfDoc.embedPng(footerImgBuffer) : null;
    const logoImg = logoImgBuffer ? await pdfDoc.embedPng(logoImgBuffer) : null;

    // --- Layout Constants ("The Content Sandwich") ---
    const SAFE_ZONE_TOP = 110;
    const SAFE_ZONE_BOTTOM = 90;
    const PAGE_HEIGHT = 841.89;
    const PAGE_WIDTH = 595.28;

    /**
     * Specialized Drawing helper for Repeating Branding on every page.
     */
    const drawBranding = (page: any, data: any) => {
      const { width, height } = page.getSize();
      
      // I. Absolute Watermark Pattern
      const watermarkText = "INTERNAL ONLY • NOT FOR EXTERNAL DISTRIBUTION";
      const wSize = 18;
      page.drawText(watermarkText, {
        x: 100, y: 300, size: wSize, font: fontBold,
        color: rgb(0.96, 0.96, 0.98), rotate: degrees(45),
        opacity: 0.5,
      });

      // II. Custom Header (R2 PNG support)
      if (headerImg) {
        page.drawImage(headerImg, {
          x: 0, y: height - 80, width, height: 80,
        });
      } else {
        // Fallback Vector Header
        page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: brandPurple });
        page.drawText("E3 ENTERPRISE", { x: 50, y: height - 50, size: 28, font: fontBold, color: brandPurple });
      }
      
      // III. Logo Placement
      if (logoImg) {
        const logoWidth = 60;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        page.drawImage(logoImg, { x: 50, y: height - 60, width: logoWidth, height: logoHeight });
      }

      // IV. Custom Footer (R2 PNG support)
      if (footerImg) {
        page.drawImage(footerImg, {
          x: 0, y: 0, width, height: SAFE_ZONE_BOTTOM - 10,
        });
      } else {
        // Fallback Vector Footer
        page.drawRectangle({ x: 0, y: 0, width, height: 3, color: brandTeal });
        page.drawText("PurchaseTracker Enterprise Platform | Strategic Asset Management", {
          x: 50, y: 15, size: 7, font: fontBold, color: rgb(0.7, 0.7, 0.7)
        });
      }

      // V. Page Numbering
      page.drawText(`${pdfDoc.getPages().length}`, {
        x: width - 40, y: 15, size: 8, font: fontBold, color: brandPurple
      });
    };

    // Initialize Page 1
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawBranding(page, requestData);

    let y = PAGE_HEIGHT - 120;
    
    // --- 1. Header Metadata Section ---
    page.drawText("PURCHASE REQUEST CONTRACT", { x: 50, y, size: 8, font: fontBold, color: brandTeal });
    page.drawText(requestData.requestNumber, { x: 50, y: y - 18, size: 22, font: fontBold, color: brandPurple });
    
    y -= 45;
    
    // Info Grid
    const drawGridItem = (p: any, xVal: number, yVal: number, label: string, value: string) => {
      p.drawText(label.toUpperCase(), { x: xVal, y: yVal, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });
      p.drawText(value.toUpperCase(), { x: xVal, y: yVal - 14, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.25) });
    };

    drawGridItem(page, 50, y, "Requester", requestData.requester?.name || "N/A");
    drawGridItem(page, 200, y, "Department", requestData.requester?.department || "N/A");
    drawGridItem(page, 350, y, "Requested Date", format(new Date(requestData.createdAt), "dd MMM yyyy"));
    drawGridItem(page, 480, y, "Priority", requestData.priority || "Medium");

    y -= 60;

    // Subject Area
    page.drawRectangle({ x: 50, y: y - 10, width: PAGE_WIDTH - 100, height: 40, color: rgb(0.97, 0.97, 1) });
    page.drawText("REQUIREMENT OVERVIEW", { x: 60, y: y + 18, size: 7, font: fontBold, color: brandTeal });
    page.drawText(requestData.title, { x: 60, y: y + 2, size: 12, font: fontBold, color: rgb(0,0,0) });

    y -= 60;

    // --- 2. Item Table (with Page Tracking) ---
    const drawTableHeaders = (p: any, yVal: number) => {
      p.drawRectangle({ x: 45, y: yVal - 5, width: PAGE_WIDTH - 90, height: 22, color: rgb(0.94, 0.94, 0.97) });
      p.drawText("ITEM DESCRIPTION", { x: 55, y: yVal, size: 8, font: fontBold, color: brandPurple });
      p.drawText("QTY", { x: 350, y: yVal, size: 8, font: fontBold, color: brandPurple });
      p.drawText("UNIT COST", { x: 420, y: yVal, size: 8, font: fontBold, color: brandPurple });
      p.drawText("TOTAL", { x: 505, y: yVal, size: 8, font: fontBold, color: brandPurple });
    };

    drawTableHeaders(page, y);
    y -= 30;

    const items = typeof requestData.items === 'string' ? JSON.parse(requestData.items) : (requestData.items || []);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (y < SAFE_ZONE_BOTTOM + 20) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawBranding(page, requestData);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
        drawTableHeaders(page, y);
        y -= 30;
      }

      if (i % 2 === 1) page.drawRectangle({ x: 45, y: y - 8, width: PAGE_WIDTH - 90, height: 20, color: rgb(0.98, 0.98, 1) });
      
      page.drawText(item.name.substring(0, 55), { x: 55, y, size: 9, font: fontRegular });
      page.drawText(item.quantity.toString(), { x: 350, y, size: 9, font: fontRegular });
      page.drawText(item.estimatedCost.toLocaleString(), { x: 420, y, size: 9, font: fontRegular });
      page.drawText((item.quantity * item.estimatedCost).toLocaleString(), { x: 505, y, size: 9, font: fontBold, color: brandPurple });
      
      y -= 25;
    }

    // --- 3. Payment Schedule Grid ---
    if (requestData.installments && requestData.installments.length > 0) {
      if (y < SAFE_ZONE_BOTTOM + 120) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawBranding(page, requestData);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }

      y -= 20;
      page.drawText("PAYMENT MECHANISM & INSTALLMENTS", { x: 50, y, size: 9, font: fontBold, color: brandTeal });
      y -= 25;
      
      // Grid Headers
      page.drawRectangle({ x: 45, y: y - 5, width: PAGE_WIDTH - 90, height: 20, color: rgb(1, 0.96, 0.96) });
      page.drawText("MILESTONE / DESCRIPTION", { x: 55, y, size: 7.5, font: fontBold, color: rgb(0.6, 0.2, 0.2) });
      page.drawText("DUE DATE", { x: 350, y, size: 7.5, font: fontBold, color: rgb(0.6, 0.2, 0.2) });
      page.drawText("PAYMENT STATUS", { x: 430, y, size: 7.5, font: fontBold, color: rgb(0.6, 0.2, 0.2) });
      page.drawText("AMOUNT", { x: 510, y, size: 7.5, font: fontBold, color: rgb(0.6, 0.2, 0.2) });
      
      y -= 22;

      for (const pay of requestData.installments) {
        page.drawText((pay.installmentName || "Standard Installment").substring(0, 45), { x: 55, y, size: 8, font: fontRegular });
        page.drawText(format(new Date(pay.dueDate), "dd MMM yyyy"), { x: 350, y, size: 8, font: fontRegular });
        page.drawText((pay.status || "Pending").toUpperCase(), { x: 430, y, size: 7, font: fontBold, color: brandTeal });
        page.drawText(`${pay.calculatedAmount.toLocaleString()} ${pay.currency || "QAR"}`, { x: 510, y, size: 8, font: fontBold });
        y -= 18;
      }
    }

    // --- 4. Final Totals Area ---
    if (y < SAFE_ZONE_BOTTOM + 100) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawBranding(page, requestData);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    y -= 30;
    page.drawRectangle({ x: 350, y, width: 200, height: 50, color: rgb(0.97, 0.97, 0.99), borderOpacity: 0.5, borderColor: brandPurple });
    page.drawText("GRAND TOTAL EXPOSURE", { x: 360, y: y + 32, size: 7.5, font: fontBold, color: brandTeal });
    page.drawText(`${requestData.totalEstimatedCost.toLocaleString()} QAR`, { x: 360, y: y + 10, size: 20, font: fontBold, color: brandPurple });

    // --- 5. Signature Workflow (The Contract) ---
    y -= 120;
    if (y < SAFE_ZONE_BOTTOM + 80) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawBranding(page, requestData);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    const drawSigBlock = (p: any, xVal: number, yVal: number, title: string, sub: string) => {
      p.drawText(title, { x: xVal, y: yVal, size: 7.5, font: fontBold, color: brandTeal });
      p.drawRectangle({ x: xVal, y: yVal - 45, width: 150, height: 0.5, color: rgb(0.8, 0.8, 0.8) });
      p.drawText(sub, { x: xVal, y: yVal - 58, size: 7.5, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });
    };

    drawSigBlock(page, 50, y, "REQUESTER AUTHORIZATION", "DEPARTMENT HEAD SIGNATURE");
    drawSigBlock(page, 220, y, "FINANCE CONTROL OFFICE", "BUDGET VERIFICATION STAMP");
    drawSigBlock(page, 390, y, "EXECUTIVE OFFICE (CEO)", "FINAL BOARD APPROVAL");

    const pdfBytes = await pdfDoc.save();
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="E3-Request-${requestData.requestNumber}.pdf"`,
      }
    });

  } catch (error: any) {
    console.error("[E3 PDF Engine] Critical Generation Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
