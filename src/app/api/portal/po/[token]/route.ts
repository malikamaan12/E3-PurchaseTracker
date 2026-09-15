import { NextRequest, NextResponse } from "next/server";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/po/[token]
 * Public endpoint for the vendor portal to fetch PO details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    // Rate limiting: max 30 requests per 10 minutes per IP
    const rateLimit = await durableRateLimiter.consume(`po_portal_${ip}`, 30, 600);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const data = await PurchaseOrderService.getPurchaseOrderByToken(token, ip, userAgent);

    return NextResponse.json({
      success: true,
      data: {
        poNumber: data.po.poNumber,
        companyLogo: "/images/e3-white-logo.png",
        status: data.po.status,
        currency: data.po.currency,
        itemsSnapshot: data.po.itemsSnapshot,
        subtotalAmount: data.po.subtotalAmount,
        freightAmount: data.po.freightAmount,
        taxAmount: data.po.taxAmount,
        totalAmount: data.po.totalAmount,
        paymentTerms: data.po.paymentTerms,
        expectedDeliveryDate: data.po.expectedDeliveryDate,
        deliveryAddress: data.po.deliveryAddress,
        billingCompany: data.po.billingCompany,
        billingAddress: data.po.billingAddress,
        specialInstructions: data.po.specialInstructions,
        termsAndConditions: data.po.termsAndConditions,
        issuedAt: data.po.issuedAt,
        acknowledgedAt: data.po.acknowledgedAt,
        acknowledgedBy: data.po.acknowledgedBy,
        acknowledgmentNotes: data.po.acknowledgmentNotes,
        vendor: {
          companyName: data.vendor?.companyName,
          contactPerson: data.vendor?.contactPerson,
          contactNumber: data.vendor?.contactNumber,
          email: data.vendor?.email,
          address: data.vendor?.address,
          taxNumber: data.vendor?.taxNumber,
          registrationNumber: data.vendor?.registrationNumber,
          bankName: data.vendor?.bankName,
          ibanNumber: data.vendor?.ibanNumber,
        },
        request: {
          requestNumber: data.request?.requestNumber,
          title: data.request?.title,
          department: data.request?.department,
        },
      },
    });
  } catch (error: any) {
    console.error("[GET /api/portal/po/[token]] Error:", error);
    return NextResponse.json({ error: error.message || "Invalid or expired link" }, { status: 404 });
  }
}
