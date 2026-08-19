import { db } from "@db";
import { vendorChangeRequests, vendors, auditLogs } from "@db/schema";
import { eq, and } from "drizzle-orm";

export class VendorBankingSecurityService {
  /**
   * Masks sensitive account number, showing only last 4 digits.
   * e.g. "123456789012" -> "•••• •••• 9012"
   */
  static maskAccountNumber(accountNumber?: string | null): string {
    if (!accountNumber) return "••••";
    const cleaned = accountNumber.trim();
    if (cleaned.length <= 4) return "•••• " + cleaned;
    const last4 = cleaned.slice(-4);
    return `•••• •••• •••• ${last4}`;
  }

  /**
   * Masks sensitive IBAN, preserving country code and last 4 characters.
   * e.g. "QA58QNBA0000000012345678" -> "QA•• •••• •••• 5678"
   */
  static maskIban(iban?: string | null): string {
    if (!iban) return "••••";
    const cleaned = iban.trim();
    if (cleaned.length <= 6) return cleaned.slice(0, 2) + "••••";
    const prefix = cleaned.slice(0, 2);
    const last4 = cleaned.slice(-4);
    return `${prefix}•• •••• •••• ${last4}`;
  }

  /**
   * Sanitizes vendor banking information for non-elevated views.
   */
  static sanitizeVendorBanking(vendor: Record<string, any>) {
    return {
      ...vendor,
      accountNumber: this.maskAccountNumber(vendor.accountNumber),
      ibanNumber: this.maskIban(vendor.ibanNumber),
      isBankingMasked: true,
    };
  }

  /**
   * Classifies proposed changes into GENERAL_UPDATE, BANKING_DETAILS, or COMPLIANCE_RENEWAL.
   */
  static classifyChangeType(proposedData: Record<string, any>): "GENERAL_UPDATE" | "BANKING_DETAILS" | "COMPLIANCE_RENEWAL" {
    const bankingFields = ["bankName", "branchName", "accountNumber", "ibanNumber", "payment_currency"];
    const hasBankingChanges = bankingFields.some((field) => field in proposedData);
    if (hasBankingChanges) {
      return "BANKING_DETAILS";
    }
    return "GENERAL_UPDATE";
  }

  /**
   * Routes a proposed banking change request for elevated dual review.
   */
  static async processBankingReview(params: {
    changeRequestId: number;
    reviewerId: number;
    reviewerRole: string;
    reviewerDept: string;
    action: "approve" | "reject";
    notes?: string;
  }) {
    const { changeRequestId, reviewerId, reviewerRole, reviewerDept, action, notes } = params;

    const [changeReq] = await db
      .select()
      .from(vendorChangeRequests)
      .where(eq(vendorChangeRequests.id, changeRequestId))
      .limit(1);

    if (!changeReq) {
      throw new Error(`Change request #${changeRequestId} not found.`);
    }

    const isBanking = changeReq.changeType === "BANKING_DETAILS";
    const isSuperAdmin = reviewerRole === "super_admin";
    const isFinance = reviewerDept?.toLowerCase() === "finance" || reviewerRole === "admin" || isSuperAdmin;

    if (action === "reject") {
      const [updated] = await db
        .update(vendorChangeRequests)
        .set({
          status: "rejected",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: notes || "Banking change rejected.",
          updatedAt: new Date(),
        })
        .where(eq(vendorChangeRequests.id, changeRequestId))
        .returning();

      return { status: "rejected", record: updated };
    }

    // Dual-approval flow for banking changes
    if (isBanking) {
      if (changeReq.status === "pending") {
        if (!isFinance) {
          throw new Error("Stage 1 of banking changes requires Finance verification.");
        }
        // Stage 1 complete -> move to finance_approved
        const [updated] = await db
          .update(vendorChangeRequests)
          .set({
            status: "finance_approved",
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            reviewNotes: notes || "Finance verification completed.",
            updatedAt: new Date(),
          })
          .where(eq(vendorChangeRequests.id, changeRequestId))
          .returning();

        return { status: "finance_approved", record: updated, message: "Finance approved. Awaiting Super Admin final confirmation." };
      }

      if (changeReq.status === "finance_approved") {
        if (!isSuperAdmin) {
          throw new Error("Stage 2 final confirmation of banking changes strictly requires Super Admin.");
        }

        // Stage 2 complete -> apply changes to vendor record
        const proposed = changeReq.proposedData as Record<string, any>;
        await db.update(vendors)
          .set({
            bankName: proposed.bankName || undefined,
            accountNumber: proposed.accountNumber || undefined,
            ibanNumber: proposed.ibanNumber || undefined,
            branchName: proposed.branchName || undefined,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, changeReq.vendorId));

        const [updated] = await db
          .update(vendorChangeRequests)
          .set({
            status: "approved",
            secondReviewedBy: reviewerId,
            secondReviewedAt: new Date(),
            reviewNotes: (changeReq.reviewNotes ? changeReq.reviewNotes + "\n" : "") + (notes || "Super Admin confirmed."),
            updatedAt: new Date(),
          })
          .where(eq(vendorChangeRequests.id, changeRequestId))
          .returning();

        return { status: "approved", record: updated, message: "Banking details successfully updated and applied." };
      }
    }

    // Standard change request approval
    const proposed = changeReq.proposedData as Record<string, any>;
    await db.update(vendors)
      .set({
        ...proposed,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, changeReq.vendorId));

    const [updated] = await db
      .update(vendorChangeRequests)
      .set({
        status: "approved",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes || "Approved.",
        updatedAt: new Date(),
      })
      .where(eq(vendorChangeRequests.id, changeRequestId))
      .returning();

    return { status: "approved", record: updated, message: "Change request approved and applied." };
  }
}
