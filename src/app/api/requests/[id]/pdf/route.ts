import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings, systemSettings } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { format } from "date-fns";

export const dynamic = 'force-dynamic';

// Helper to fetch request with relations
async function getFullRequestData(requestId: number) {
  return await db.query.purchaseRequests.findFirst({
    where: (pr: any, { eq }: any) => eq(pr.id, requestId),
    with: {
      requester: true,
      vendor: true,
      subPurpose: true,
      attachments: true,
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
 * Robust multi-page PDF generator for E3 Enterprise.
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

    // 1. Permission Check
    const canView = user.role === "admin" || 
                    requestData.requesterId === user.id || 
                    requestData.approvals.some((a: any) => a.approverId === user.id);

    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // 2. Fetch Branding Config
    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;
    const systemSettingsRecords = await db.select().from(systemSettings).catch(() => []);

    const getSetting = (key: string, defaultValue: any) => {
      const records = systemSettingsRecords as any[];
      return records.find(r => r.key === key)?.value || defaultValue;
    };

    const primaryHex = settings?.headerColor || getSetting("brand_primary_color", "#6F2AE6");
    const secondaryHex = settings?.footerColor || getSetting("brand_secondary_color", "#15CDD8");
    
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

    // --- Template Helpers ---
    const drawBranding = (page: any, data: any) => {
      const { width, height } = page.getSize();
      
      // 1. Repeating Diagonal Watermark Pattern (Subtle Security Pattern)
      const watermarkSize = 12;
      const watermarkText = "E3 AUTHENTIC DOCUMENT • ";
      const textWidth = fontBold.widthOfTextAtSize(watermarkText, watermarkSize);
      
      for (let i = 0; i < width + height; i += 200) {
        for (let j = 0; j < height; j += 40) {
          page.drawText(watermarkText, {
            x: i - j * 0.5, y: j, size: watermarkSize, font: fontBold,
            color: rgb(0.96, 0.96, 0.98), rotate: degrees(30),
            opacity: 0.4,
          });
        }
      }

      // 2. High-Fidelity Header Section
      // Top Accent Line
      page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: brandPurple });
      
      // Brand Mark (Typography-based)
      page.drawText("E3", { x: 50, y: height - 50, size: 28, font: fontBold, color: brandPurple });
      page.drawText("ENTERPRISE", { x: 92, y: height - 50, size: 28, font: fontRegular, color: rgb(0.2, 0.2, 0.35) });
      page.drawText("ASSET MANAGEMENT SYSTEMS", { x: 50, y: height - 65, size: 9, font: fontBold, color: brandTeal, opacity: 0.8 });

      // Dynamic Status Badge
      const statusTitle = (data.status || 'PENDING').toUpperCase();
      const stWidth = fontBold.widthOfTextAtSize(statusTitle, 10);
      page.drawRectangle({ x: width - stWidth - 70, y: height - 55, width: stWidth + 20, height: 25, color: rgb(0.95, 0.95, 1), borderRadius: 4 });
      page.drawText(statusTitle, { x: width - stWidth - 60, y: height - 48, size: 10, font: fontBold, color: brandPurple });
      page.drawText("CURRENT STATUS", { x: width - stWidth - 70, y: height - 65, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });

      // Horizontal Divider
      page.drawRectangle({ x: 50, y: height - 85, width: width - 100, height: 0.5, color: rgb(0.85, 0.85, 0.9) });
    };

    // Initialize Page 1
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    drawBranding(page, requestData);

    let y = height - 110;
    
    // --- 2x2 High-Density Metadata Grid ---
    // Column 1
    page.drawText("REFERENCE NUMBER", { x: 50, y, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });
    page.drawText(requestData.requestNumber, { x: 50, y: y - 14, size: 12, font: fontBold, color: brandPurple });
    
    page.drawText("REQUEST DATE", { x: 50, y: y - 40, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });
    page.drawText(format(new Date(requestData.createdAt || ""), "dd MMM yyyy").toUpperCase(), { x: 50, y: y - 54, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.3) });

    // Column 2
    const col2X = width / 2;
    page.drawText("REQUESTER NAME", { x: col2X, y, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });
    page.drawText((requestData.requester?.name || 'SYSTEM ADMIN').toUpperCase(), { x: col2X, y: y - 14, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.3) });

    page.drawText("DEPARTMENT", { x: col2X, y: y - 40, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });
    page.drawText((requestData.requester?.department || 'N/A').toUpperCase(), { x: col2X, y: y - 54, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.3) });

    y -= 85;

    // Request Title Focus
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 35, color: rgb(0.98, 0.98, 1) });
    page.drawText("PURCHASE SUBJECT", { x: 60, y: y + 18, size: 7, font: fontBold, color: brandTeal });
    page.drawText(requestData.title.toUpperCase(), { x: 60, y: y + 2, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.2) });

    y -= 50;
    
    // --- Items Table Headers ---
    page.drawRectangle({ x: 45, y: y - 5, width: width - 90, height: 22, color: rgb(0.94, 0.94, 0.97) });
    page.drawText("ITEM DESCRIPTION", { x: 55, y, size: 8, font: fontBold, color: brandPurple });
    page.drawText("QTY", { x: 350, y, size: 8, font: fontBold, color: brandPurple });
    page.drawText("UNIT COST", { x: 420, y, size: 8, font: fontBold, color: brandPurple });
    page.drawText("TOTAL", { x: 505, y, size: 8, font: fontBold, color: brandPurple });
    
    y -= 30;

    // --- Items Table Content with Page Breaks ---
    const items = typeof requestData.items === 'string' ? JSON.parse(requestData.items) : (requestData.items || []);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // PAGE BREAK TRIGGER - Increased to 140 for more generous footer padding
      if (y < 140) {
        page = pdfDoc.addPage([595.28, 841.89]);
        drawBranding(page, requestData);
        y = height - 120;
        
        // Re-draw table headers on new page
        page.drawRectangle({ x: 45, y: y - 5, width: width - 90, height: 22, color: rgb(0.94, 0.94, 0.97) });
        page.drawText("ITEM DESCRIPTION (CONT.)", { x: 55, y, size: 8, font: fontBold, color: brandPurple });
        page.drawText("QTY", { x: 350, y, size: 8, font: fontBold, color: brandPurple });
        page.drawText("UNIT COST", { x: 420, y, size: 8, font: fontBold, color: brandPurple });
        page.drawText("TOTAL", { x: 505, y, size: 8, font: fontBold, color: brandPurple });
        y -= 30;
      }

      const total = (item.quantity * item.estimatedCost).toLocaleString();
      // Zebra Striping
      if (i % 2 === 1) {
        page.drawRectangle({ x: 45, y: y - 8, width: width - 90, height: 20, color: rgb(0.98, 0.98, 1) });
      }

      page.drawText(item.name.substring(0, 55), { x: 55, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.25) });
      page.drawText(item.quantity.toString(), { x: 350, y, size: 9, font: fontRegular });
      page.drawText(item.estimatedCost.toLocaleString(), { x: 420, y, size: 9, font: fontRegular });
      page.drawText(total, { x: 505, y, size: 9, font: fontBold, color: brandPurple });

      // Subtle row separator line
      page.drawRectangle({ x: 50, y: y - 8, width: width - 100, height: 0.3, color: rgb(0.9, 0.9, 0.95) });
      y -= 25;
    }

    // --- Summary Area ---
    if (y < 220) { // Increased check space for summary block protection
      page = pdfDoc.addPage([595.28, 841.89]);
      drawBranding(page, requestData);
      y = height - 120;
    }

    y -= 20;
    page.drawRectangle({ x: 350, y, width: 200, height: 50, color: rgb(0.97, 0.97, 0.99) });
    page.drawText("TOTAL ESTIMATED COST", { x: 360, y: y + 32, size: 7.5, font: fontBold, color: brandTeal });
    page.drawText(`${requestData.totalEstimatedCost.toLocaleString()} QAR`, { x: 360, y: y + 10, size: 18, font: fontBold, color: brandPurple });

    // --- Final Signatures (If enabled) ---
    if (settings?.showSignatures) {
      y -= 120;
      if (y < 140) {
        page = pdfDoc.addPage([595.28, 841.89]);
        drawBranding(page, requestData);
        y = height - 120;
      }
      
      // Signature Blocks with High-Density Alignment
      const sigY = y - 45;
      page.drawText("REQUESTER AUTHORIZATION", { x: 50, y, size: 7, font: fontBold, color: brandTeal });
      page.drawRectangle({ x: 50, y: sigY, width: 175, height: 0.3, color: rgb(0.5, 0.5, 0.6) });
      page.drawText(requestData.requester?.name || "MEMBER SIGNATURE", { x: 50, y: sigY - 12, size: 7, font: fontRegular, color: rgb(0.6, 0.6, 0.7) });
      page.drawText("Duly Signed & Verified", { x: 50, y: sigY - 22, size: 6, font: fontBold, color: rgb(0.8, 0.8, 0.8) });
      
      page.drawText("APPROVER AUTHORIZATION", { x: width - 225, y, size: 7, font: fontBold, color: brandTeal });
      page.drawRectangle({ x: width - 225, y: sigY, width: 175, height: 0.3, color: rgb(0.5, 0.5, 0.6) });
      page.drawText("AUTHORIZED SIGNATORY", { x: width - 225, y: sigY - 12, size: 7, font: fontRegular, color: rgb(0.6, 0.6, 0.7) });
      page.drawText("Departmental Stamp & Date", { x: width - 225, y: sigY - 22, size: 6, font: fontBold, color: rgb(0.8, 0.8, 0.8) });
    }

    const pdfBytes = await pdfDoc.save();
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="E3-Request-${requestData.requestNumber}.pdf"`,
      }
    });

  } catch (error: any) {
    console.error("[Native PDF API] Multi-page Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
