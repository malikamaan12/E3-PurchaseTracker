import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { paymentInstallments } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/requests/[id]/payments/[paymentId]
 * Finance ledger update. Supports:
 *   - PAID: marks installment paid at full amount.
 *   - PARTIAL: auto-creates a Remainder row for the delta.
 *   - RESCHEDULED: defers due date.
 *   - isFinalSettlement=true: marks paid at lower amount + auto-creates a
 *       SETTLED_SAVINGS row for the savings delta (Scenario A).
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

    const [existing] = await db
      .select()
      .from(paymentInstallments)
      .where(and(eq(paymentInstallments.id, paymentId), eq(paymentInstallments.requestId, requestId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Payment installment not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      paidAmount,
      status,
      rescheduledDate,
      financeNotes,
      actualPaymentDate,
      transactionReference,
      attachmentUrl,
      isFinalSettlement, // boolean — Scenario A: saves remainder as SETTLED_SAVINGS
    } = body;

    // ── Validate Status ─────────────────────────────────────────────────────
    const validStatuses = ["pending", "partial", "paid", "rescheduled", "pending_approval"];
    if (status && !validStatuses.includes(status.toLowerCase())) {
      return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
    }

    // PARTIAL requires rescheduledDate
    if (status?.toLowerCase() === "partial" && !rescheduledDate) {
      return NextResponse.json(
        { error: "A rescheduled date is required for partial payments." },
        { status: 400 }
      );
    }

    // ── Integer Safety ───────────────────────────────────────────────────────
    const safePaidAmount =
      paidAmount !== undefined && paidAmount !== null
        ? Math.round(Number(paidAmount))
        : undefined;

    // ── Build update payload ─────────────────────────────────────────────────
    const updatePayload: any = { updatedAt: new Date() };
    if (safePaidAmount !== undefined)  updatePayload.paidAmount = safePaidAmount;
    if (status)                        updatePayload.status = status.toLowerCase();
    if (rescheduledDate !== undefined) updatePayload.rescheduledDate = rescheduledDate ? new Date(rescheduledDate) : null;
    if (actualPaymentDate !== undefined) updatePayload.actualPaymentDate = actualPaymentDate ? new Date(actualPaymentDate) : null;
    if (financeNotes !== undefined)    updatePayload.financeNotes = financeNotes;
    if (transactionReference !== undefined) updatePayload.transactionReference = transactionReference;
    if (attachmentUrl !== undefined)   updatePayload.attachmentUrl = attachmentUrl;

    if (status?.toLowerCase() === "paid" && !updatePayload.actualPaymentDate) {
      updatePayload.actualPaymentDate = new Date();
    }

    // ── Scenario A: Final Settlement ─────────────────────────────────────────
    // If Finance pays less than expected on a finalised invoice, mark the
    // current row PAID at the lower amount and auto-create a SETTLED_SAVINGS
    // row for the difference — keeping the ledger balanced.
    let settledSavingsInstallment = null;

    if (isFinalSettlement === true && safePaidAmount !== undefined && safePaidAmount < existing.calculatedAmount) {
      // Force the status to PAID regardless of what was submitted
      updatePayload.status = "paid";
      if (!updatePayload.actualPaymentDate) updatePayload.actualPaymentDate = new Date();

      const savingsDelta = Math.round(existing.calculatedAmount - safePaidAmount);

      if (savingsDelta > 0) {
        const [savingsRow] = await db
          .insert(paymentInstallments)
          .values({
            requestId,
            vendorId: existing.vendorId,
            installmentName: `${existing.installmentName} (Savings Δ -${savingsDelta.toLocaleString()} ${existing.currency})`,
            dueDate: new Date(), // Settled immediately
            amount: savingsDelta,
            valueType: "FIXED_AMOUNT",
            amountValue: savingsDelta,
            calculatedAmount: savingsDelta,
            currency: existing.currency,
            status: "settled_savings",
            paidAmount: 0,          // Zero cost to the company
            actualPaymentDate: new Date(),
            financeNotes: `Final settlement saving. Original estimate: ${existing.calculatedAmount.toLocaleString()} ${existing.currency}. Paid: ${safePaidAmount.toLocaleString()} ${existing.currency}. Saved: ${savingsDelta.toLocaleString()} ${existing.currency}.`,
            createdBy: user.id,
          })
          .returning();

        settledSavingsInstallment = savingsRow;
      }
    }

    // ── 1. Update the target installment ────────────────────────────────────
    const [updatedPayment] = await db
      .update(paymentInstallments)
      .set(updatePayload)
      .where(and(eq(paymentInstallments.id, paymentId), eq(paymentInstallments.requestId, requestId)))
      .returning();

    // ── 2. PARTIAL SPLIT: Auto-spawn remainder installment ──────────────────
    let remainderInstallment = null;

    if (
      status?.toLowerCase() === "partial" &&
      safePaidAmount !== undefined &&
      safePaidAmount < existing.calculatedAmount &&
      !isFinalSettlement
    ) {
      const remainingAmount = Math.round(existing.calculatedAmount - safePaidAmount);

      if (remainingAmount > 0) {
        const [newInstallment] = await db
          .insert(paymentInstallments)
          .values({
            requestId,
            vendorId: existing.vendorId,
            installmentName: `${existing.installmentName} (Remainder)`,
            dueDate: rescheduledDate ? new Date(rescheduledDate) : new Date(),
            amount: remainingAmount,
            valueType: "FIXED_AMOUNT",
            amountValue: remainingAmount,
            calculatedAmount: remainingAmount,
            currency: existing.currency,
            status: "pending",
            rescheduledDate: rescheduledDate ? new Date(rescheduledDate) : null,
            financeNotes: `Auto-generated remainder from partial payment of ${safePaidAmount.toLocaleString()} ${existing.currency}. Original installment ID: ${paymentId}.`,
            createdBy: user.id,
          })
          .returning();

        remainderInstallment = newInstallment;
      }
    }

    // ── Build response message ───────────────────────────────────────────────
    let message = "Payment ledger updated successfully.";
    if (settledSavingsInstallment) {
      message = `Final settlement logged. Savings of ${settledSavingsInstallment.calculatedAmount.toLocaleString()} ${existing.currency} recorded.`;
    } else if (remainderInstallment) {
      message = `Partial payment logged. Remainder of ${remainderInstallment.calculatedAmount.toLocaleString()} ${existing.currency} split into new installment.`;
    }

    return NextResponse.json({
      success: true,
      message,
      payment: updatedPayment,
      remainderInstallment,
      settledSavingsInstallment,
    });

  } catch (error: any) {
    console.error("[Finance Ledger API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
