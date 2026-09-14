import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";

export const dynamic = "force-dynamic";

/**
 * POST /api/po/[id]/share-email
 * Sends official branded PO notification and link to the vendor email via Resend.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await params;
    const poId = parseInt(idStr, 10);
    if (isNaN(poId)) return NextResponse.json({ error: "Invalid PO ID" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { rawToken, customMessage } = body;

    let activeRawToken = rawToken;
    if (!activeRawToken) {
      // If client didn't supply an active raw token, generate a fresh one
      const tokenResult = await PurchaseOrderService.regenerateShareToken(
        poId,
        user.id,
        user.role,
        user.department
      );
      activeRawToken = tokenResult.rawToken;
    }

    const result = await PurchaseOrderService.sendVendorPoEmail(
      poId,
      activeRawToken,
      user.id,
      user.role,
      user.department,
      customMessage
    );

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Official Purchase Order email successfully sent to vendor.",
    });
  } catch (error: any) {
    console.error("[POST /api/po/[id]/share-email] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send email to vendor" }, { status: 400 });
  }
}
