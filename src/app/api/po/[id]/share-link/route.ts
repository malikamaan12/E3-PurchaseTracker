import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { db } from "@db";
import { purchaseOrders } from "@db/schema";
import { eq } from "drizzle-orm";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";

export const dynamic = "force-dynamic";

/**
 * POST /api/po/[id]/share-link
 * Generates or regenerates a shareable token for the vendor portal.
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

    const result = await PurchaseOrderService.regenerateShareToken(
      poId,
      user.id,
      user.role,
      user.department
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.e3.qa";
    const shareUrl = `${appUrl}/portal/po/${result.rawToken}`;

    return NextResponse.json({
      success: true,
      rawToken: result.rawToken,
      shareUrl,
      expiresAt: result.po.tokenExpiresAt,
      message: "Share link generated successfully.",
    });
  } catch (error: any) {
    console.error("[POST /api/po/[id]/share-link] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate share link" }, { status: 400 });
  }
}
