import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { generatePurchaseRequestPdf } from "@/lib/pdf/RequestPdfGenerator";

export const dynamic = 'force-dynamic';

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

    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchImageBuffer(settings?.headerImage || null),
      fetchImageBuffer(settings?.footerImage || null),
      fetchImageBuffer(settings?.logo || null)
    ]);

    const pdfBytes = await generatePurchaseRequestPdf(requestData, {
      headerImage,
      footerImage,
      logo
    });
    
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="E3-Request-${requestData.requestNumber}.pdf"`,
        'X-PDF-Engine': 'Unified-E3-v3',
        'X-Consistency-Locked': 'true'
      }
    });

  } catch (error: any) {
    console.error("[Unified PDF Route] Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
