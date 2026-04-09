import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { generatePurchaseRequestPdf } from "@/lib/pdf/RequestPdfGenerator";

export const dynamic = 'force-dynamic';

async function fetchBuffer(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(20000), 
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.error(`[Full PDF Engine] Fetch failed for ${url}: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`[Full PDF Engine] Critical fetch error:`, error);
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requestId = parseInt(paramId);
    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canView = user.role === "admin" || requestData.requesterId === user.id || requestData.approvals.some((a: any) => a.approverId === user.id);
    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { PDFDocument } = await import("pdf-lib");
    
    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchBuffer(settings?.headerImage || null),
      fetchBuffer(settings?.footerImage || null),
      fetchBuffer(settings?.logo || null)
    ]);

    const basePdfBytes = await generatePurchaseRequestPdf(requestData, {
      headerImage,
      footerImage,
      logo
    });

    const finalDoc = await PDFDocument.create();
    const sourcePr = await PDFDocument.load(basePdfBytes);
    const prPages = await finalDoc.copyPages(sourcePr, sourcePr.getPageIndices());
    prPages.forEach((p) => finalDoc.addPage(p));

    // Support both PDFs and Images
    const attachments = (requestData.attachments || []);
    
    for (const att of attachments) {
      const isPdf = att.fileType.toLowerCase().includes('pdf') || att.fileName.toLowerCase().endsWith('.pdf');
      const isImage = att.fileType.toLowerCase().includes('image/') || /\.(jpg|jpeg|png)$/i.test(att.fileName);

      if (!isPdf && !isImage) continue;

      console.log(`[Full PDF Engine] Processing: ${att.fileName}`);
      const buffer = await fetchBuffer(att.fileUrl);
      if (!buffer || buffer.length === 0) continue;

      try {
        if (isPdf) {
          const attPdf = await PDFDocument.load(buffer);
          const attPages = await finalDoc.copyPages(attPdf, attPdf.getPageIndices());
          attPages.forEach((p) => finalDoc.addPage(p));
        } else if (isImage) {
          const image = att.fileName.toLowerCase().endsWith('.png') 
            ? await finalDoc.embedPng(buffer)
            : await finalDoc.embedJpg(buffer);

          const page = finalDoc.addPage([595.28, 841.89]);
          const { width, height } = page.getSize();
          
          // Scaling Logic (Fit to A4 with 40pt margin)
          const maxWidth = width - 80;
          const maxHeight = height - 80;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
          
          const dims = image.scale(scale);
          page.drawImage(image, {
            x: (width - dims.width) / 2,
            y: (height - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          });
        }
      } catch (e) {
        console.error(`[Full PDF Engine] Failed to process ${att.fileName}:`, e);
      }
    }

    const finalPdfBytes = await finalDoc.save();

    return new Response(finalPdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Full_PR_${requestData.requestNumber}_Package.pdf"`,
      }
    });

  } catch (error: any) {
    console.error("[Full PDF Engine] Critical Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
