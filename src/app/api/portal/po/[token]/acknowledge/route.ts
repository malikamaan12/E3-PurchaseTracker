import { NextRequest, NextResponse } from "next/server";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

export const dynamic = "force-dynamic";

/**
 * POST /api/portal/po/[token]/acknowledge
 * Vendor confirms receipt and acceptance of the Purchase Order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Rate limiting: max 5 acknowledgment attempts per 10 minutes per IP
    const rateLimit = await durableRateLimiter.consume(`po_ack_${ip}`, 5, 600);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { acknowledgedBy, acknowledgmentNotes } = body;

    const updated = await PurchaseOrderService.acknowledgePurchaseOrder(
      token,
      { acknowledgedBy, acknowledgmentNotes },
      ip
    );

    return NextResponse.json({
      success: true,
      message: `Purchase Order ${updated.poNumber} confirmed successfully.`,
      status: updated.status,
      acknowledgedAt: updated.acknowledgedAt,
      acknowledgedBy: updated.acknowledgedBy,
    });
  } catch (error: any) {
    console.error("[POST /api/portal/po/[token]/acknowledge] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to acknowledge Purchase Order" }, { status: 400 });
  }
}
