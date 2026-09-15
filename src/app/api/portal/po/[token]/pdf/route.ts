import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseOrders, purchaseOrderEvents, pdfSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";
import { generatePurchaseOrderPdf } from "@/lib/pdf/PoPdfGenerator";
import { fetchPdfAssetBuffer } from "@/lib/pdf/image-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/po/[token]/pdf
 * Public endpoint for vendor to download the official Purchase Order PDF.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const data = await PurchaseOrderService.getPurchaseOrderByToken(token, ip);

    // Asynchronously record download event
    db.insert(purchaseOrderEvents).values({
      poId: data.po.id,
      eventType: "PDF_DOWNLOADED",
      actorType: "vendor",
      metadata: { ip, timestamp: new Date().toISOString() },
    }).catch(() => null);

    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchPdfAssetBuffer(settings?.headerImage || null, req.url),
      fetchPdfAssetBuffer(settings?.footerImage || null, req.url),
      fetchPdfAssetBuffer(settings?.logo || null, req.url),
    ]);

    const pdfBytes = await generatePurchaseOrderPdf(data.po, {
      logo,
      headerImage,
      footerImage,
      headerTitle: settings?.headerTitle,
      headerSubtitle: settings?.headerSubtitle,
      headerColor: settings?.headerColor,
      footerText: settings?.footerText,
      footerColor: settings?.footerColor,
      watermarkText: data.po.status === "draft" ? "DRAFT PO" : data.po.status === "cancelled" ? "CANCELLED" : settings?.watermarkText,
      watermarkOpacity: settings?.watermarkOpacity,
    });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="E3-${data.po.poNumber || "PurchaseOrder"}.pdf"`,
        "X-PDF-Engine": "E3-Purchase-Order-v1",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/portal/po/[token]/pdf] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to download PDF" }, { status: 404 });
  }
}
