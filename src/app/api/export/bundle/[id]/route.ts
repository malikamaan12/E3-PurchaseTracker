import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { generatePurchaseRequestPdf } from "@/lib/pdf/RequestPdfGenerator";
import { format } from "date-fns";
import JSZip from "jszip";
import { safeParseItems } from "@/lib/utils/safe-parse";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function fetchImageBuffer(url: string | null, reqUrl?: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    let fetchUrl = url;
    if (url.startsWith('/') && reqUrl) {
      const baseUrl = new URL(reqUrl).origin;
      fetchUrl = `${baseUrl}${url}`;
    }
    const response = await fetch(fetchUrl, { 
      signal: AbortSignal.timeout(20000), // Extended timeout for R2
      redirect: 'follow'
    });
    if (!response.ok) {
      console.error(`[Bundle Engine] Fetch failed for ${fetchUrl}: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`[Bundle Engine] Critical fetch error for ${url}:`, error);
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

function sanitizeFilename(filename: string): string {
  // Replace illegal chars but preserve extension
  return filename.replace(/[<>:"/\\|?*]/g, '_');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canView = user.role === "admin" || requestData.requesterId === user.id || requestData.approvals.some((a: any) => a.approverId === user.id);
    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchImageBuffer(settings?.headerImage || null, req.url),
      fetchImageBuffer(settings?.footerImage || null, req.url),
      fetchImageBuffer(settings?.logo || null, req.url)
    ]);

    // 1. Generate Unified PDF
    const pdfBytes = await generatePurchaseRequestPdf(requestData, {
      headerImage,
      footerImage,
      logo
    });

    // 2. Generate Executive CSV
    const items = safeParseItems(requestData.items);
    const csvHeaders = [
      "PR Reference", "Title", "Requester", "Department", "Created At", 
      "Priority", "Vendor Name", "Vendor Contact", "Item Name", "Quantity", 
      "Unit Cost", "Total Line Cost", "Currency", "Net Subtotal", "Freight", 
      "Total Gross", "Status", "Approvals (Dept:Status)"
    ];

    const approvalString = (requestData.approvals || [])
      .map((a: any) => `${a.department}:${a.status}`)
      .join(" | ");

    const csvRows = items.map((item: any) => [
      requestData.requestNumber,
      `"${requestData.title.replace(/"/g, '""')}"`,
      requestData.requester?.username,
      requestData.requester?.department,
      format(new Date(requestData.createdAt), "yyyy-MM-dd HH:mm"),
      requestData.priority?.toUpperCase(),
      `"${requestData.vendor?.companyName?.replace(/"/g, '""') || 'N/A'}"`,
      `"${requestData.vendor?.email || 'N/A'}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      item.quantity,
      item.estimatedCost,
      item.quantity * item.estimatedCost,
      requestData.currency,
      requestData.totalEstimatedCost,
      requestData.freightAmount || 0,
      requestData.totalEstimatedCost + (requestData.freightAmount || 0),
      requestData.status.toUpperCase(),
      `"${approvalString}"`
    ]);
    const csvContent = [csvHeaders.join(","), ...csvRows.map((r: any) => r.join(","))].join("\n");

    // 3. ZIP Assembly
    const zip = new JSZip();
    zip.file(`PR_${requestData.requestNumber}_Report.pdf`, pdfBytes);
    zip.file(`PR_${requestData.requestNumber}_Ledger.csv`, csvContent);
    
    // Add attachments in protective try-catch loop
    const attachmentFolder = zip.folder("attachments");
    if (attachmentFolder) {
      for (const att of (requestData.attachments || [])) {
        try {
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
          const fileBuffer = await fetchImageBuffer(downloadUrl, req.url);
          if (fileBuffer && fileBuffer.length > 0) {
            attachmentFolder.file(sanitizeFilename(att.fileName), fileBuffer);
          }
        } catch (err) {
          console.warn(`[Bundle Engine] Skipping failed attachment ${att.fileName}:`, err);
        }
      }
    }
    
    const zipBuffer = await zip.generateAsync({ 
      type: "nodebuffer", 
      compression: "DEFLATE", 
      compressionOptions: { level: 9 } 
    });

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="PR_${requestData.requestNumber}_Audit_Bundle.zip"`,
        'X-Bundle-Status': 'Success'
      }
    });

  } catch (error: any) {
    console.error("[Bundle Engine] Critical Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
