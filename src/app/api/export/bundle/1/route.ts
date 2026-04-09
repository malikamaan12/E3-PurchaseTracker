import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { format } from "date-fns";
import JSZip from "jszip";

export const dynamic = 'force-dynamic';

/**
 * Optimized Image Buffer Fetcher
 */
async function fetchImageBuffer(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
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

// E3 Brand Token Normalization (Normalized to 0-1 for pdf-lib)
const E3_PURPLE = { r: 91/255, g: 75/255, b: 138/255 }; 
const E3_TEAL = { r: 47/255, g: 183/255, b: 178/255 };
const E3_INDIGO = { r: 46/255, g: 42/255, b: 94/255 };
const COLOR_WHITE = { r: 1, g: 1, b: 1 };
const COLOR_GRAY = { r: 0.95, g: 0.95, b: 0.95 };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Authorization: Admin or Requester or Approver
    const canView = user.role === "admin" || requestData.requesterId === user.id || requestData.approvals.some((a: any) => a.approverId === user.id);
    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // 1. Generate PDF (E3 Branded)
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    const [fontBold, fontRegular, settingsResult] = await Promise.all([
      pdfDoc.embedFont(StandardFonts.HelveticaBold),
      pdfDoc.embedFont(StandardFonts.Helvetica),
      db.select().from(pdfSettings).limit(1)
    ]);
    
    const settings = settingsResult[0] || null;
    const logoBuffer = await fetchImageBuffer(settings?.logo || null);
    const logoImg = logoBuffer ? await pdfDoc.embedPng(logoBuffer).catch(() => null) : null;

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    const purple = rgb(E3_PURPLE.r, E3_PURPLE.g, E3_PURPLE.b);
    const teal = rgb(E3_TEAL.r, E3_TEAL.g, E3_TEAL.b);
    const indigo = rgb(E3_INDIGO.r, E3_INDIGO.g, E3_INDIGO.b);
    const white = rgb(COLOR_WHITE.r, COLOR_WHITE.g, COLOR_WHITE.b);
    const gray = rgb(COLOR_GRAY.r, COLOR_GRAY.g, COLOR_GRAY.b);

    // Draft Header Design
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: indigo });
    if (logoImg) {
      const logoW = 50;
      const logoH = (logoImg.height / logoImg.width) * logoW;
      page.drawImage(logoImg, { x: 40, y: height - 75, width: logoW, height: logoH });
    }
    page.drawText("PURCHASE TRANSACTION BUNDLE", { x: 40, y: height - 35, size: 10, font: fontBold, color: teal });
    page.drawText(`REF: ${requestData.requestNumber}`, { x: width - 180, y: height - 35, size: 10, font: fontBold, color: white });

    let y = height - 130;
    
    // Core Metadata
    page.drawText("PRIMARY ENTITY RECORD", { x: 40, y, size: 14, font: fontBold, color: indigo });
    y -= 25;
    page.drawText(`Request Title: ${requestData.title}`, { x: 40, y, size: 10, font: fontBold, color: purple });
    y -= 15;
    page.drawText(`Vendor: ${requestData.vendor?.companyName || 'N/A'}`, { x: 40, y, size: 9, font: fontRegular, color: indigo });
    y -= 15;
    page.drawText(`Total Expenditure: ${requestData.totalEstimatedCost.toLocaleString()} ${requestData.currency}`, { x: 40, y, size: 12, font: fontBold, color: indigo });

    // Itemized Ledger Section
    y -= 40;
    page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 20, color: purple });
    page.drawText("ITEMIZED FISCAL BREAKDOWN", { x: 50, y: y + 2, size: 8, font: fontBold, color: white });
    
    y -= 40;
    const items = typeof requestData.items === 'string' ? JSON.parse(requestData.items) : (requestData.items || []);
    for (const item of items) {
       page.drawText(item.name || "Unnamed Item", { x: 50, y, size: 8, font: fontRegular, color: indigo });
       page.drawText(`${item.quantity} x ${item.estimatedCost.toLocaleString()}`, { x: 300, y, size: 8, font: fontRegular, color: indigo });
       page.drawText(`QAR ${(item.quantity * item.estimatedCost).toLocaleString()}`, { x: width - 150, y, size: 8, font: fontBold, color: purple });
       y -= 15;
       page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: gray });
       y -= 10;
    }

    const pdfBytes = await pdfDoc.save();

    // 2. Generate CSV
    const csvHeaders = ["Item Name", "Quantity", "Estimated Unit Cost", "Total Line Cost", "Vendor", "Request Reference"];
    const csvRows = items.map((item: any) => [
      `"${item.name}"`,
      item.quantity,
      item.estimatedCost,
      item.quantity * item.estimatedCost,
      `"${requestData.vendor?.companyName || 'N/A'}"`,
      requestData.requestNumber
    ]);
    const csvContent = [csvHeaders.join(","), ...csvRows.map((r: any) => r.join(","))].join("\n");

    // 3. Zip Packaging
    const zip = new JSZip();
    zip.file(`PurchaseRequest_${requestData.requestNumber}_Report.pdf`, pdfBytes);
    zip.file(`PurchaseRequest_${requestData.requestNumber}_Ledger.csv`, csvContent);
    
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="PR_${requestData.requestNumber}_Bundle.zip"`,
        'X-Serverless-Optimization': 'True',
        'X-E3-Version': 'Final'
      }
    });

  } catch (error: any) {
    console.error("[Bundle Engine] Critical Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
