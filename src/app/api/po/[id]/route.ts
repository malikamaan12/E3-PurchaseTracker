import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { db } from "@db";
import { purchaseOrders } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";

export const dynamic = "force-dynamic";

/**
 * GET /api/po/[id]
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
        events: {
          orderBy: desc(purchaseOrders.createdAt),
          limit: 15,
        },
      },
    });

    if (!po) return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });

    const isAuthorizedFinance = PurchaseOrderService.isAuthorized(user.role, user.department);
    const isRequester = po.request?.requesterId === user.id;

    if (!isAuthorizedFinance && !isRequester) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ success: true, purchaseOrder: po });
  } catch (error: any) {
    console.error("[GET /api/po/[id]] Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/po/[id]
 * Update draft PO fields, issue draft PO, or cancel PO.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await params;
    const poId = parseInt(idStr, 10);
    if (isNaN(poId)) return NextResponse.json({ error: "Invalid PO ID" }, { status: 400 });

    const body = await req.json();
    const { action, cancellationReason, ...draftUpdates } = body;

    if (action === "issue") {
      const issued = await PurchaseOrderService.issuePurchaseOrder(poId, user.id, user.role, user.department);
      return NextResponse.json({ success: true, purchaseOrder: issued, message: "Purchase Order issued successfully." });
    }

    if (action === "cancel") {
      const cancelled = await PurchaseOrderService.cancelPurchaseOrder(
        poId,
        user.id,
        user.role,
        user.department,
        cancellationReason || "Cancelled by Finance"
      );
      return NextResponse.json({ success: true, purchaseOrder: cancelled, message: "Purchase Order cancelled." });
    }

    // Default: update draft fields
    const updated = await PurchaseOrderService.updateDraftPo(poId, user.id, user.role, user.department, draftUpdates);
    return NextResponse.json({ success: true, purchaseOrder: updated, message: "Draft updated successfully." });
  } catch (error: any) {
    console.error("[PATCH /api/po/[id]] Error:", error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 400 });
  }
}
