import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { db } from "@db";
import { purchaseOrders, pdfSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";
import { generatePurchaseOrderPdf } from "@/lib/pdf/PoPdfGenerator";
import { fetchPdfAssetBuffer } from "@/lib/pdf/image-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/po/[id]/pdf
 * Generates and streams official PO PDF for internal staff.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await params;
    const poId = parseInt(idStr, 10);
    if (isNaN(poId)) return NextResponse.json({ error: "Invalid PO ID" }, { status: 400 });

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, poId),
      with: {
        vendor: true,
        request: true,
        createdBy: {
          columns: { username: true, email: true },
        },
      },
    });

    if (!po) return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });

    const isAuthorizedFinance = PurchaseOrderService.isAuthorized(user.role, user.department);
    const isRequester = po.request?.requesterId === user.id;

    if (!isAuthorizedFinance && !isRequester) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchPdfAssetBuffer(settings?.headerImage || null, req.url),
      fetchPdfAssetBuffer(settings?.footerImage || null, req.url),
      fetchPdfAssetBuffer(settings?.logo || null, req.url),
    ]);

    const pdfBytes = await generatePurchaseOrderPdf(po, {
      logo,
      headerImage,
      footerImage,
      headerTitle: settings?.headerTitle,
      headerSubtitle: settings?.headerSubtitle,
      headerColor: settings?.headerColor,
      footerText: settings?.footerText,
      footerColor: settings?.footerColor,
      watermarkText: po.status === "draft" ? "DRAFT PO" : po.status === "cancelled" ? "CANCELLED" : settings?.watermarkText,
      watermarkOpacity: settings?.watermarkOpacity,
    });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="E3-${po.poNumber || "PurchaseOrder"}.pdf"`,
        "X-PDF-Engine": "E3-Purchase-Order-v1",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/po/[id]/pdf] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
