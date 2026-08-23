import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, paymentInstallments } from "@db/schema";
import { eq, count } from "drizzle-orm";

import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

// DEVELOPMENT & DIAGNOSTIC ONLY — super_admin access required
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const user = await getAuthenticatedUser(req);
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: "Unauthorized: Super Admin access required" }, { status: 403 });
  }

  try {
    const countResult = await db.select({ count: count() }).from(purchaseRequests);
    const nextNum = (Number(countResult[0]?.count) || 0) + 9999;
    const requestNumber = `PR-TEST-${nextNum}`;

    // Step 1: purchase request insert
    let req1: any;
    try {
      [req1] = await db.insert(purchaseRequests).values({
        requestNumber,
        title: "Diagnostic Test",
        description: "Diagnostic description for testing",
        totalEstimatedCost: 1000,
        vendorId: 1,
        purposeType: "PROJECT",
        purposeCategoryId: null,
        subPurposeId: null,
        priority: "medium",
        currency: "QAR",
        freightAmount: 0,
        requesterId: 1,
        items: JSON.stringify([{ name: "Test", quantity: 1, estimatedCost: 1000 }]) as any,
        additionalApprovers: JSON.stringify([]) as any,
        paymentStructure: "POST_PROJECT",
        status: "draft",
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
    } catch (e: any) {
      return NextResponse.json({ step: 1, failed: true, error: e.message, detail: e.detail, code: e.code }, { status: 500 });
    }

    // Step 2: installment insert
    let inst1: any;
    try {
      [inst1] = await db.insert(paymentInstallments).values({
        requestId: req1.id,
        vendorId: 1,
        installmentName: "Post-Project Settlement",
        dueDate: new Date(),
        valueType: "PERCENTAGE",
        amountValue: 100,
        calculatedAmount: 1000,
        currency: "QAR",
        createdBy: 1,
      }).returning();
    } catch (e: any) {
      await db.delete(purchaseRequests).where(eq(purchaseRequests.id, req1.id));
      return NextResponse.json({ step: 2, failed: true, error: e.message, detail: e.detail, code: e.code }, { status: 500 });
    }

    // Clean up 
    await db.delete(paymentInstallments).where(eq(paymentInstallments.id, inst1.id));
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, req1.id));

    return NextResponse.json({ success: true, message: "All inserts passed" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, detail: e.detail, code: e.code }, { status: 500 });
  }
}
