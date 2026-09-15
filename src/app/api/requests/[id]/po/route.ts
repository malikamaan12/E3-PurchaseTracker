import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { db } from "@db";
import { purchaseOrders, purchaseRequests } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { PurchaseOrderService } from "@/lib/services/PurchaseOrderService";

export const dynamic = "force-dynamic";

/**
 * GET /api/requests/[id]/po
 * Retrieves the Purchase Order (if generated) associated with the given Purchase Request.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await params;
    const requestId = parseInt(idStr, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const pr = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, requestId),
      columns: { id: true, status: true, requesterId: true, department: true },
    });

    if (!pr) {
      return NextResponse.json({ error: "Purchase Request not found" }, { status: 404 });
    }

    // Role check
    const isAuthorizedFinance = PurchaseOrderService.isAuthorized(user.role, user.department);
    const isRequester = pr.requesterId === user.id;

    if (!isAuthorizedFinance && !isRequester) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.requestId, requestId),
      orderBy: desc(purchaseOrders.createdAt),
      with: {
        vendor: true,
        createdBy: {
          columns: { username: true, email: true },
        },
        events: {
          orderBy: desc(purchaseOrders.createdAt),
          limit: 10,
        },
      },
    });

    return NextResponse.json({
      success: true,
      exists: !!po,
      canCreate: isAuthorizedFinance && (pr.status === "approved" || pr.status === "partially_paid" || pr.status === "fully_paid") && !po,
      purchaseOrder: po || null,
    });
  } catch (error: any) {
    console.error("[GET /api/requests/[id]/po] Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/requests/[id]/po
 * Generates a Purchase Order for an approved request.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await params;
    const requestId = parseInt(idStr, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const result = await PurchaseOrderService.createPurchaseOrder({
      requestId,
      userId: user.id,
      userRole: user.role,
      userDepartment: user.department,
      expectedDeliveryDate: body.expectedDeliveryDate,
      billingCompany: body.billingCompany,
      deliveryAddress: body.deliveryAddress,
      billingAddress: body.billingAddress,
      specialInstructions: body.specialInstructions,
      termsAndConditions: body.termsAndConditions,
      status: body.status || "issued",
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: result.purchaseOrder,
      rawToken: result.rawToken,
      message: `Purchase Order ${result.purchaseOrder.poNumber} created successfully.`,
    });
  } catch (error: any) {
    console.error("[POST /api/requests/[id]/po] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create Purchase Order" }, { status: 400 });
  }
}
