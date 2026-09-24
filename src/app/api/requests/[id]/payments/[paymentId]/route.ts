import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { paymentInstallments, purchaseRequests, auditLogs } from "@db/schema";
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
 *   4. Immutable Audit Trail: Record before/after values and notes for every modification.
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

    const userDepts = (user.departments || [user.department]).filter(Boolean).map(d => String(d).toLowerCase().trim());
    const isFinance = userDepts.includes('finance') || user.department?.toLowerCase() === 'finance';
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isFinance && !isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Only Finance or Super Admin can update payment ledgers." },
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

    // ── 1.5 Strict Compliance: Only editable if APPROVED or FULLY_PAID ───────
    if (request.status !== "approved" && (request.status as string) !== "fully_paid") {
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
      calculatedAmount,
      installmentName,
      dueDate,
      paidAmount,
      status,
      rescheduledDate,
      financeNotes,
      actualPaymentDate,
      transactionReference,
      attachmentUrl,
      isFinalSettlement, // Staged inline via savingsAmount
    } = body;

    // ── 2. Backend Gatekeeper & Status Defaults ──────────────────────────────
    const normalizedStatus = status?.toLowerCase() || existing.status;
    let safePaidAmount = 0;

    if (normalizedStatus === 'pending') {
      safePaidAmount = paidAmount !== undefined ? Math.round(Number(paidAmount)) : 0;
    } else if (normalizedStatus === 'paid') {
      safePaidAmount = paidAmount !== undefined && Number(paidAmount) > 0 
        ? Math.round(Number(paidAmount)) 
        : (calculatedAmount !== undefined ? Math.round(Number(calculatedAmount)) : (existing.calculatedAmount || existing.paidAmount || 0));
    } else {
      safePaidAmount = paidAmount !== undefined ? Math.round(Number(paidAmount)) : (existing.paidAmount ?? 0);
    }

    const validBudget = request.revisedTotalCost ?? request.totalEstimatedCost ?? 0;
    
    // Calculate global total paid IF this update is applied (counting only active cleared/partial entries)
    const otherPaymentsTotal = allInstallments
      .filter(p => p.id !== paymentId && (p.status === 'paid' || p.status === 'partial' || p.status === 'settled_savings'))
      .reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
    
    const newGlobalPaid = otherPaymentsTotal + safePaidAmount;

    if (newGlobalPaid > validBudget && normalizedStatus !== 'pending') {
      return NextResponse.json({ 
        error: "BUDGET_EXCEEDED", 
        message: `Payment of ${safePaidAmount.toLocaleString()} QAR exceeds the remaining approved budget.`,
        remaining: validBudget - otherPaymentsTotal
      }, { status: 400 });
    }

    // ── 3. Build update payload ───────────────────────────────────────────────
    let resolvedActualPaymentDate: Date | null = null;
    if (normalizedStatus === 'pending') {
      resolvedActualPaymentDate = actualPaymentDate ? new Date(actualPaymentDate) : null;
    } else if (actualPaymentDate) {
      resolvedActualPaymentDate = new Date(actualPaymentDate);
    } else if (normalizedStatus === 'paid' || normalizedStatus === 'partial') {
      resolvedActualPaymentDate = existing.actualPaymentDate || new Date();
    }

    const updatePayload: any = { 
      updatedAt: new Date(),
      lastModifiedBy: user.id,
      paidAmount: safePaidAmount,
      status: normalizedStatus,
      financeNotes: financeNotes !== undefined ? financeNotes : existing.financeNotes,
      transactionReference: transactionReference !== undefined ? transactionReference : existing.transactionReference,
      attachmentUrl: attachmentUrl !== undefined ? attachmentUrl : existing.attachmentUrl,
      actualPaymentDate: resolvedActualPaymentDate,
      rescheduledDate: rescheduledDate ? new Date(rescheduledDate) : existing.rescheduledDate,
    };

    if (calculatedAmount !== undefined) {
      const parsedCalc = Math.round(Number(calculatedAmount));
      if (!isNaN(parsedCalc) && parsedCalc >= 0) {
        updatePayload.calculatedAmount = parsedCalc;
        updatePayload.calculatedAmountQar = Math.round(parsedCalc * Number(existing.exchangeRate || 1));
      }
    }
    if (installmentName !== undefined && String(installmentName).trim()) {
      updatePayload.installmentName = String(installmentName).trim();
    }
    if (dueDate !== undefined) {
      updatePayload.dueDate = new Date(dueDate);
    }

    let responseMessage = "Payment ledger updated successfully.";

    // ── 4. Logic Scenarios (High Efficiency) ────────────────────────────────
    
    // A. Inline Savings (Neon Optimization)
    if (isFinalSettlement === true && safePaidAmount < existing.calculatedAmount && normalizedStatus === 'paid') {
      updatePayload.status = "paid";
      updatePayload.savingsAmount = Math.round(existing.calculatedAmount - safePaidAmount);
      responseMessage = `Final settlement logged. Inline savings of ${updatePayload.savingsAmount.toLocaleString()} QAR recorded.`;
    }

    // B. Two-Row Differential
    if (normalizedStatus === "partial" && safePaidAmount < existing.calculatedAmount && !isFinalSettlement) {
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

    // ── 5.5 Check overall request completion status ──────────────────────────
    const refreshedInstallments = allInstallments.map(inst => inst.id === paymentId ? updatedPayment : inst);
    const allCleared = refreshedInstallments.length > 0 && refreshedInstallments.every(
      inst => inst.status === 'paid' || inst.status === 'settled_savings'
    );

    if (allCleared && (request.status as string) === 'approved') {
      await db.update(purchaseRequests)
        .set({ status: 'fully_paid', updatedAt: new Date() })
        .where(eq(purchaseRequests.id, requestId));
    } else if (!allCleared && (request.status as string) === 'fully_paid') {
      await db.update(purchaseRequests)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(purchaseRequests.id, requestId));
    }

    // ── 6. Record Immutable Audit Trail ──────────────────────────────────────
    try {
      await db.insert(auditLogs).values({
        resourceId: requestId,
        resourceType: "payment_installment",
        action: "PAYMENT_MODIFIED",
        userId: user.id,
        details: {
          installmentId: paymentId,
          installmentName: updatePayload.installmentName || existing.installmentName,
          previous: {
            calculatedAmount: existing.calculatedAmount,
            paidAmount: existing.paidAmount,
            status: existing.status,
            installmentName: existing.installmentName,
            dueDate: existing.dueDate,
            transactionReference: existing.transactionReference,
            actualPaymentDate: existing.actualPaymentDate,
            financeNotes: existing.financeNotes,
            attachmentUrl: existing.attachmentUrl,
          },
          updated: {
            calculatedAmount: updatePayload.calculatedAmount ?? existing.calculatedAmount,
            paidAmount: updatePayload.paidAmount,
            status: updatePayload.status,
            installmentName: updatePayload.installmentName ?? existing.installmentName,
            dueDate: updatePayload.dueDate ?? existing.dueDate,
            transactionReference: updatePayload.transactionReference,
            actualPaymentDate: updatePayload.actualPaymentDate,
            financeNotes: updatePayload.financeNotes,
            attachmentUrl: updatePayload.attachmentUrl,
          },
          author: user.username,
          role: user.role,
          department: user.department,
          modifiedAt: new Date().toISOString(),
        },
        timestamp: new Date(),
      });
    } catch (auditErr) {
      console.warn("[Finance Ledger API] Non-fatal audit log error:", auditErr);
    }

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
