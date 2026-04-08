import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings, systemSettings, paymentInstallments } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { format } from "date-fns";

export const dynamic = 'force-dynamic';

/**
 * Optimized Image Buffer Fetcher
 * Uses native fetch with a strict timeout to prevent thread blocking.
 */
async function fetchImageBuffer(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.warn(`[PDF Engine] Image fetch failed for ${url}:`, error);
    return null;
  }
}

async function getFullRequestData(requestId: number) {
  return await db.query.purchaseRequests.findFirst({
    where: (pr, { eq }) => eq(pr.id, requestId),
    with: {
      requester: true,
      vendor: true,
      subPurpose: true,
      attachments: true,
      installments: true, 
      approvals: {
        with: {
          approver: {
            columns: { username: true }
          }
        }
      }
    }
  });
}

// Design Tokens for E3 Minimal Engine (Hardware Accelerated UI Colors)
const COLOR_BLACK = { r: 0, g: 0, b: 0 }; 
const COLOR_INDIGO = { r: 46 / 255, g: 42 / 255, b: 94 / 255 }; 
const COLOR_WHITE = { r: 1, g: 1, b: 1 };
const COLOR_GRAY = { r: 0.9, g: 0.9, b: 0.9 };
const COLOR_DARK_GRAY = { r: 0.4, g: 0.4, b: 0.4 };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const canView = user.role === "admin" || 
                    requestData.requesterId === user.id || 
                    requestData.approvals.some((a: any) => a.approverId === user.id);
    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // Parallelize all initialization steps to unblock the event loop
    const [settingsResult, { PDFDocument, rgb, StandardFonts }] = await Promise.all([
      db.select().from(pdfSettings).limit(1),
      import("pdf-lib")
    ]);

    const settings = settingsResult[0] || null;
    const pdfDoc = await PDFDocument.create();

    const [fontBold, fontRegular, headerImgBuffer, footerImgBuffer, logoImgBuffer] = await Promise.all([
      pdfDoc.embedFont(StandardFonts.HelveticaBold),
      pdfDoc.embedFont(StandardFonts.Helvetica),
      fetchImageBuffer(settings?.headerImage || null),
      fetchImageBuffer(settings?.footerImage || null),
      fetchImageBuffer(settings?.logo || null)
    ]);

    const headerImg = headerImgBuffer ? await pdfDoc.embedPng(headerImgBuffer).catch(() => null) : null;
    const footerImg = footerImgBuffer ? await pdfDoc.embedPng(footerImgBuffer).catch(() => null) : null;
    const logoImg = logoImgBuffer ? await pdfDoc.embedPng(logoImgBuffer).catch(() => null) : null;

    const PAGE_HEIGHT = 841.89;
    const PAGE_WIDTH = 595.28;
    const SAFE_ZONE_TOP = 80;
    const SAFE_ZONE_BOTTOM = 80;
    
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

      const timestamp = format(new Date(), "dd MMM yyyy, hh:mm a");
      page.drawText(`Downloaded: ${timestamp}`, { x: PAGE_WIDTH - 180, y: PAGE_HEIGHT - 95, size: 8, font: fontRegular, color: darkGray });
      
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
    };

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderAndFooter(page);

    let y = PAGE_HEIGHT - SAFE_ZONE_TOP - 20;

    // --- Title & Core Tracking ---
    page.drawText("PURCHASE REQUEST", { x: 40, y, size: 24, font: fontBold, color: black });
    page.drawText(`PR REF: ${requestData.requestNumber}`, { x: PAGE_WIDTH - 150, y, size: 12, font: fontBold, color: indigo });
    
    y -= 25;
    page.drawText(`STATUS: `, { x: 40, y, size: 9, font: fontBold, color: indigo });
    page.drawText(`${requestData.status.toUpperCase().replace(/_/g, ' ')}`, { x: 85, y, size: 9, font: fontBold, color: black });

    y -= 15;
    page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 1, color: borderGray });
    y -= 20;

    // --- Metadata Grid ---
    const drawMeta = (p: any, xVal: number, yVal: number, key: string, val: string) => {
      p.drawText(`${key}:`, { x: xVal, y: yVal, size: 8, font: fontBold, color: indigo });
      p.drawText(val || "N/A", { x: xVal + 70, y: yVal, size: 8, font: fontRegular, color: black });
    };

    drawMeta(page, 40, y, "Requester", requestData.requester?.username || "N/A");
    drawMeta(page, PAGE_WIDTH / 2, y, "Department", requestData.requester?.department || "N/A");
    y -= 20;
    drawMeta(page, 40, y, "Created Date", format(new Date(requestData.createdAt), "dd MMM yyyy"));
    drawMeta(page, PAGE_WIDTH / 2, y, "Priority", requestData.priority?.toUpperCase() || "MEDIUM");
    y -= 20;
    drawMeta(page, 40, y, "Vendor", requestData.vendor?.companyName || "N/A");
    drawMeta(page, PAGE_WIDTH / 2, y, "Currency", requestData.currency || "QAR");

    y -= 40;
    page.drawText("REQUIREMENT OVERVIEW", { x: 40, y, size: 9, font: fontBold, color: indigo });
    y -= 15;
    page.drawText(requestData.title || "Untitled", { x: 40, y, size: 12, font: fontBold, color: black });

    y -= 40;

    // --- "Request Item Breakdown" Table ---
    page.drawRectangle({ x: 40, y: y - 5, width: PAGE_WIDTH - 80, height: 20, color: indigo });
    page.drawText("REQUEST ITEM BREAKDOWN", { x: 45, y: y + 2, size: 9, font: fontBold, color: white });
    y -= 25;

    page.drawLine({ start: { x: 40, y: y+15 }, end: { x: PAGE_WIDTH - 40, y: y+15 }, thickness: 1, color: indigo });
    page.drawText("DESCRIPTION", { x: 45, y, size: 8, font: fontBold, color: indigo });
    page.drawText("QTY", { x: 350, y, size: 8, font: fontBold, color: indigo });
    page.drawText("COST", { x: 420, y, size: 8, font: fontBold, color: indigo });
    page.drawText("TOTAL", { x: 490, y, size: 8, font: fontBold, color: indigo });
    y -= 10;
    page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.5, color: borderGray });
    y -= 15;

    const items = typeof requestData.items === 'string' ? JSON.parse(requestData.items) : (requestData.items || []);
    for (const item of items) {
      if (y < SAFE_ZONE_BOTTOM + 50) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderAndFooter(page);
        y = PAGE_HEIGHT - SAFE_ZONE_TOP;
      }

      page.drawText((item.name || "").substring(0, 50), { x: 45, y, size: 8, font: fontRegular, color: black });
      page.drawText((item.quantity || 0).toString(), { x: 350, y, size: 8, font: fontRegular, color: black });
      page.drawText((item.estimatedCost || 0).toLocaleString(), { x: 420, y, size: 8, font: fontRegular, color: black });
      page.drawText(((item.quantity || 0) * (item.estimatedCost || 0)).toLocaleString(), { x: 490, y, size: 8, font: fontBold, color: black });
      
      y -= 15;
      page.drawLine({ start: { x: 40, y }, end: { x: PAGE_WIDTH - 40, y }, thickness: 0.5, color: borderGray });
      y -= 10;
    }

    y -= 25;

    // --- Total Box ---
    if (y < SAFE_ZONE_BOTTOM + 80) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderAndFooter(page);
      y = PAGE_HEIGHT - SAFE_ZONE_TOP;
    }

    page.drawRectangle({ x: PAGE_WIDTH - 220, y: y - 35, width: 180, height: 40, color: white, borderColor: indigo, borderWidth: 1 });
    page.drawText("TOTAL ESTIMATED EXPENDITURE", { x: PAGE_WIDTH - 210, y: y - 12, size: 8, font: fontBold, color: indigo });
    page.drawText(`${(requestData.totalEstimatedCost + (requestData.freightAmount || 0)).toLocaleString()} ${requestData.currency || "QAR"}`, { x: PAGE_WIDTH - 210, y: y - 28, size: 14, font: fontBold, color: black });

    y -= 80;

    // --- Universal Signature Workflows ---
    if (y < SAFE_ZONE_BOTTOM + 110) {
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

      if (sig.data?.status === 'approved') {
        statusText = `Approved: ${sig.data.approver?.username || 'SYSTEM'}`;
        statusColor = black;
      } else if (sig.data?.status === 'rejected') {
        statusText = "REJECTED";
      }

      page.drawText(statusText, { x: blockX, y: y + 5, size: 6, font: fontRegular, color: statusColor });
      blockX += 125;
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="E3-Request-${requestData.requestNumber}.pdf"`,
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        'X-PDF-Engine': 'Optimized-E3-v2'
      }
    });

  } catch (error: any) {
    console.error("[E3 PDF Engine] Generation Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
