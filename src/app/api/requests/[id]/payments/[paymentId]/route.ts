import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { paymentInstallments, purchaseRequests } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/requests/[id]/payments/[paymentId]
 * Enterprise Refactor: High-Performance Ledger Update.
 * Logic Goals:
 *   1. Backend Gatekeeper: Forcefully prevent overpayment via real-time DB total check.
 *   2. Two-Row Differential: Consolidate partials into the final row (Minimizes connection spam).
 *   3. Inline Savings: Uses savingsAmount column instead of spawning rows.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: requestIdStr, paymentId: paymentIdStr } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const isFinance = user.department?.toLowerCase() === 'finance';
    const isAdmin = user.role === 'admin';
    if (!isFinance && !isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Only Finance can update payment ledgers." },
        { status: 403 }
      );
    }

    const requestId = parseInt(requestIdStr);
    const paymentId = parseInt(paymentIdStr);
    if (isNaN(requestId) || isNaN(paymentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // ── 1. Fetch Request & ALL Installments (Absolute Source of Truth) ───────
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // ── 1.5 Strict Compliance: Only editable if APPROVED ──────────────────────
    if (request.status !== "approved") {
      return NextResponse.json({ 
        error: "FORBIDDEN", 
        message: `Financial Disbursement Schedule is locked while status is '${request.status.replace(/_/g, ' ')}'. Modifications require Management Approval.` 
      }, { status: 403 });
    }

    const allInstallments = await db
      .select()
      .from(paymentInstallments)
      .where(eq(paymentInstallments.requestId, requestId))
      .orderBy(desc(paymentInstallments.dueDate), desc(paymentInstallments.id));

    const existing = allInstallments.find(p => p.id === paymentId);
    if (!existing) return NextResponse.json({ error: "Payment installment not found" }, { status: 404 });

    const body = await req.json();
    const {
      paidAmount,
      status,
      rescheduledDate,
      financeNotes,
      actualPaymentDate,
      transactionReference,
      attachmentUrl,
      isFinalSettlement, // Staged inline via savingsAmount
    } = body;

    // ── 2. Backend Gatekeeper: Overpayment Protection ────────────────────────
    const safePaidAmount = paidAmount !== undefined ? Math.round(Number(paidAmount)) : (existing.paidAmount ?? 0);
    const validBudget = request.revisedTotalCost ?? request.totalEstimatedCost;
    
    // Calculate global total paid IF this update is applied
    const otherPaymentsTotal = allInstallments
      .filter(p => p.id !== paymentId)
      .reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
    
    const newGlobalPaid = otherPaymentsTotal + safePaidAmount;

    if (newGlobalPaid > validBudget) {
      return NextResponse.json({ 
        error: "BUDGET_EXCEEDED", 
        message: `Payment of ${safePaidAmount.toLocaleString()} QAR exceeds the remaining approved budget.`,
        remaining: validBudget - otherPaymentsTotal
      }, { status: 400 });
    }

    // ── 3. Build update payload ───────────────────────────────────────────────
    const updatePayload: any = { 
      updatedAt: new Date(),
      paidAmount: safePaidAmount,
      status: status?.toLowerCase() || existing.status,
      financeNotes: financeNotes !== undefined ? financeNotes : existing.financeNotes,
      transactionReference: transactionReference !== undefined ? transactionReference : existing.transactionReference,
      attachmentUrl: attachmentUrl !== undefined ? attachmentUrl : existing.attachmentUrl,
      actualPaymentDate: actualPaymentDate ? new Date(actualPaymentDate) : (status?.toLowerCase() === 'paid' ? new Date() : existing.actualPaymentDate),
      rescheduledDate: rescheduledDate ? new Date(rescheduledDate) : existing.rescheduledDate,
    };

    let responseMessage = "Payment ledger updated successfully.";

    // ── 4. Logic Scenarios (High Efficiency) ────────────────────────────────
    
    // A. Inline Savings (Neon Optimization)
    if (isFinalSettlement === true && safePaidAmount < existing.calculatedAmount) {
      updatePayload.status = "paid";
      updatePayload.savingsAmount = Math.round(existing.calculatedAmount - safePaidAmount);
      responseMessage = `Final settlement logged. Inline savings of ${updatePayload.savingsAmount.toLocaleString()} QAR recorded.`;
    }

    // B. Two-Row Differential
    if (status?.toLowerCase() === "partial" && safePaidAmount < existing.calculatedAmount && !isFinalSettlement) {
      const delta = Math.round(existing.calculatedAmount - safePaidAmount);
      const finalInstallment = allInstallments[0]; // Chronologically latest

      if (finalInstallment && finalInstallment.id !== paymentId) {
        // CASE 1: Shift delta to the final row
        await db.update(paymentInstallments)
          .set({ 
            calculatedAmount: (finalInstallment.calculatedAmount || 0) + delta,
            updatedAt: new Date()
          })
          .where(eq(paymentInstallments.id, finalInstallment.id));
        
        responseMessage = `Partial payment logged. Remainder of ${delta.toLocaleString()} QAR shifted to final installment (${finalInstallment.installmentName}).`;
      } else {
        // CASE 2: Single-Row Edge Case (Auto-spawn)
        await db.insert(paymentInstallments).values({
          requestId,
          vendorId: existing.vendorId,
          installmentName: `${existing.installmentName} (Remainder)`,
          dueDate: rescheduledDate ? new Date(rescheduledDate) : new Date(),
          valueType: "FIXED_AMOUNT",
          amountValue: delta,
          calculatedAmount: delta,
          currency: existing.currency,
          status: "pending",
          financeNotes: `Auto-generated remainder from 1st-row partial payment of ${safePaidAmount.toLocaleString()} QAR.`,
          createdBy: user.id,
        });
        responseMessage = `Partial payment logged. Remainder of ${delta.toLocaleString()} QAR auto-spawned (Single-Row Edge Case).`;
      }
    }

    // ── 5. Apply the update ──────────────────────────────────────────────────
    const [updatedPayment] = await db
      .update(paymentInstallments)
      .set(updatePayload)
      .where(and(eq(paymentInstallments.id, paymentId), eq(paymentInstallments.requestId, requestId)))
      .returning();

    return NextResponse.json({
      success: true,
      message: responseMessage,
      payment: updatedPayment
    });

  } catch (error: any) {
    console.error("[Finance Ledger API] Refactor Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
