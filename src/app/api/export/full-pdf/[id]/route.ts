import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { generatePurchaseRequestPdf } from "@/lib/pdf/RequestPdfGenerator";

export const dynamic = 'force-dynamic';
// Promote to Vercel Fluid Function — allows 60s execution for large PDF packages.
// The default 10-15s serverless limit consistently causes 504s on heavy documents.
export const maxDuration = 60;

async function fetchBuffer(url: string | null, reqUrl?: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    let fetchUrl = url;
    if (url.startsWith('/') && reqUrl) {
      const baseUrl = new URL(reqUrl).origin;
      fetchUrl = `${baseUrl}${url}`;
    }
    const response = await fetch(fetchUrl, { 
      signal: AbortSignal.timeout(20000), 
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.error(`[Full PDF Engine] Fetch failed for ${fetchUrl}: ${response.status}`);
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
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canView = user.role === "admin" || requestData.requesterId === user.id || requestData.approvals.some((a: any) => a.approverId === user.id);
    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { PDFDocument, rgb } = await import("pdf-lib");
    // A4 dimensions in PDF points (72pts/inch)
    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;
    
    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchBuffer(settings?.headerImage || null, req.url),
      fetchBuffer(settings?.footerImage || null, req.url),
      fetchBuffer(settings?.logo || null, req.url)
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

    const attachments = (requestData.attachments || []);
    
    // --- PERFORMANCE OPTIMIZATION: Parallel Fetching ---
    // We fetch all buffers in parallel to avoid sequential network delays
    const attachmentBuffers = await Promise.all(
      attachments.map(async (att: any) => {
        const fileType = att.fileType || '';
        const fileName = att.fileName || '';
        const isPdf = fileType.toLowerCase().includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
        const isImage = fileType.toLowerCase().includes('image/') || /\.(jpg|jpeg|png)$/i.test(fileName);
        if (!isPdf && !isImage) return null;
        
        let downloadUrl = att.fileUrl;
        if (downloadUrl && !downloadUrl.startsWith("http")) {
           try {
             const { r2Storage } = await import("@/lib/services/R2StorageService");
             downloadUrl = await r2Storage.getReadPresignedUrl(downloadUrl, 3600);
           } catch (e) {
             console.error("Failed to generate presigned URL for export", e);
           }
        } else if (downloadUrl) {
           try {
             const urlWithoutQuery = downloadUrl.split("?")[0];
             const matchIndex = urlWithoutQuery.indexOf("attachments/");
             if (matchIndex !== -1) {
                const extractedKey = decodeURIComponent(urlWithoutQuery.substring(matchIndex));
                const { r2Storage } = await import("@/lib/services/R2StorageService");
                downloadUrl = await r2Storage.getReadPresignedUrl(extractedKey, 3600);
             }
           } catch (e) {
             console.error("Failed to refresh legacy URL for export", e);
           }
        }
        
        const buffer = await fetchBuffer(downloadUrl, req.url);
        return buffer ? { ...att, buffer, isPdf, isImage } : null;
      })
    );

    const startTime = Date.now();
    const TIMEOUT_LIMIT = 8000; // 8s safety limit for the generation phase

    for (const att of attachmentBuffers) {
      if (!att) continue;

      // --- SERVERLESS TIMEOUT PREVENTION ---
      // If we approach the 8s mark, we stop merging to ensure the function returns
      if (Date.now() - startTime > TIMEOUT_LIMIT) {
        console.warn(`[Full PDF Engine] TIMEOUT PROTECTION TRIGGERED: Skipping remaining attachments for PR ${requestData.requestNumber}`);
        const warningPage = finalDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        warningPage.drawText("CAUTION: Document Package Partially Generated", { x: 50, y: 400, size: 18, color: rgb(1, 0, 0) });
        warningPage.drawText("The procurement package was too large to process in a single serverless cycle.", { x: 50, y: 370, size: 10 });
        warningPage.drawText("Please download individual attachments for full documentation.", { x: 50, y: 355, size: 10 });
        break;
      }

      try {
        if (att.isPdf) {
          const attPdf = await PDFDocument.load(att.buffer);
          const attPages = await finalDoc.copyPages(attPdf, attPdf.getPageIndices());
          attPages.forEach((p) => finalDoc.addPage(p));
        } else if (att.isImage) {
          const image = att.fileName.toLowerCase().endsWith('.png') 
            ? await finalDoc.embedPng(att.buffer)
            : await finalDoc.embedJpg(att.buffer);

          const page = finalDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          const { width, height } = page.getSize();
          
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
