import { db } from "@db";
import {
  vendorBankingSubmissions,
  vendors,
  auditLogs,
  type VendorBankingSubmission,
  type Vendor,
} from "../../../db/schema";
import { eq, desc } from "drizzle-orm";
import { ComplianceEvaluationService } from "./ComplianceEvaluationService";

export interface StageBankingData {
  bankName: string;
  branchName: string;
  accountNumber: string;
  ibanNumber: string;
  payment_currency?: string;
  bankLetterDocId?: number;
}

export class VendorBankingStagingService {
  /**
   * Masks account number (shows only last 4 digits).
   */
  static maskAccountNumber(accountNumber?: string | null): string {
    if (!accountNumber) return "";
    const clean = accountNumber.replace(/\s+/g, "");
    if (clean.length <= 4) return "••••";
    return `•••• •••• ${clean.slice(-4)}`;
  }

  /**
   * Masks IBAN (shows first 2 and last 4 characters).
   */
  static maskIban(iban?: string | null): string {
    if (!iban) return "";
    const clean = iban.replace(/\s+/g, "").toUpperCase();
    if (clean.length <= 6) return "••••";
    return `${clean.slice(0, 2)}•• •••• •••• ${clean.slice(-4)}`;
  }

  /**
   * Stages vendor-submitted banking details into quarantine without touching canonical vendor payable fields.
   */
  static async stageSubmission(
    vendorId: number,
    data: StageBankingData
  ): Promise<VendorBankingSubmission> {
    const [submission] = await db
      .insert(vendorBankingSubmissions)
      .values({
        vendorId,
        bankName: data.bankName,
        branchName: data.branchName,
        accountNumber: data.accountNumber,
        ibanNumber: data.ibanNumber,
        payment_currency: data.payment_currency || "QAR",
        bankLetterDocId: data.bankLetterDocId,
        status: "pending_stage1",
      })
      .returning();

    await db
      .update(vendors)
      .set({
        bankingVerificationStatus: "pending_stage1",
      })
      .where(eq(vendors.id, vendorId));

    // Audit log
    await db.insert(auditLogs).values({
      action: "VENDOR_BANKING_STAGED",
      resourceType: "vendor_banking_submission",
      resourceId: submission.id,
      details: {
        vendorId,
        bankName: data.bankName,
        maskedIban: this.maskIban(data.ibanNumber),
      },
    });

    return submission;
  }

  /**
   * Stage 1 Review by Finance Reviewer.
   */
  static async reviewStage1(
    submissionId: number,
    financeUserId: number,
    notes?: string,
    isApproved: boolean = true
  ): Promise<VendorBankingSubmission> {
    const [submission] = await db
      .select()
      .from(vendorBankingSubmissions)
      .where(eq(vendorBankingSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new Error(`Banking submission ${submissionId} not found`);
    }

    if (submission.status !== "pending_stage1") {
      throw new Error(`Banking submission is not pending Stage 1 review (current status: ${submission.status})`);
    }

    const reviewedAt = new Date();

    if (isApproved) {
      const [updated] = await db
        .update(vendorBankingSubmissions)
        .set({
          status: "pending_stage2",
          stage1ReviewedBy: financeUserId,
          stage1ReviewedAt: reviewedAt,
          stage1Notes: notes,
        })
        .where(eq(vendorBankingSubmissions.id, submissionId))
        .returning();

      await db
        .update(vendors)
        .set({
          bankingVerificationStatus: "pending_stage2",
        })
        .where(eq(vendors.id, submission.vendorId));

      return updated;
    } else {
      const [updated] = await db
        .update(vendorBankingSubmissions)
        .set({
          status: "rejected",
          stage1ReviewedBy: financeUserId,
          stage1ReviewedAt: reviewedAt,
          rejectionReason: notes || "Rejected during Finance Stage 1 review",
        })
        .where(eq(vendorBankingSubmissions.id, submissionId))
        .returning();

      await db
        .update(vendors)
        .set({
          bankingVerificationStatus: "unverified",
        })
        .where(eq(vendors.id, submission.vendorId));

      return updated;
    }
  }

  /**
   * Stage 2 Final Confirmation by Super Admin.
   * Promotes staged details to canonical vendor payable fields.
   */
  static async reviewStage2(
    submissionId: number,
    superAdminUserId: number,
    notes?: string,
    isApproved: boolean = true
  ): Promise<VendorBankingSubmission> {
    const [submission] = await db
      .select()
      .from(vendorBankingSubmissions)
      .where(eq(vendorBankingSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new Error(`Banking submission ${submissionId} not found`);
    }

    if (submission.status !== "pending_stage2") {
      throw new Error(`Banking submission is not pending Stage 2 review (current status: ${submission.status})`);
    }

    const reviewedAt = new Date();

    if (isApproved) {
      const [updated] = await db
        .update(vendorBankingSubmissions)
        .set({
          status: "verified",
          stage2ReviewedBy: superAdminUserId,
          stage2ReviewedAt: reviewedAt,
          stage2Notes: notes,
        })
        .where(eq(vendorBankingSubmissions.id, submissionId))
        .returning();

      // PROMOTE TO CANONICAL VENDOR PAYABLE FIELDS
      await db
        .update(vendors)
        .set({
          bankName: submission.bankName,
          branchName: submission.branchName,
          accountNumber: submission.accountNumber,
          ibanNumber: submission.ibanNumber,
          payment_currency: submission.payment_currency,
          bankingVerificationStatus: "verified",
          updatedAt: reviewedAt,
        })
        .where(eq(vendors.id, submission.vendorId));

      // Recalculate vendor compliance score
      await ComplianceEvaluationService.evaluateVendor(
        submission.vendorId,
        "BANKING_VERIFIED",
        superAdminUserId
      );

      // Audit Log
      await db.insert(auditLogs).values({
        userId: superAdminUserId,
        action: "VENDOR_BANKING_PROMOTED",
        resourceType: "vendor",
        resourceId: submission.vendorId,
        details: {
          submissionId: submission.id,
          stage1Reviewer: submission.stage1ReviewedBy,
          stage2Reviewer: superAdminUserId,
          maskedIban: this.maskIban(submission.ibanNumber),
        },
      });

      return updated;
    } else {
      const [updated] = await db
        .update(vendorBankingSubmissions)
        .set({
          status: "rejected",
          stage2ReviewedBy: superAdminUserId,
          stage2ReviewedAt: reviewedAt,
          rejectionReason: notes || "Rejected during Super Admin Stage 2 confirmation",
        })
        .where(eq(vendorBankingSubmissions.id, submissionId))
        .returning();

      await db
        .update(vendors)
        .set({
          bankingVerificationStatus: "unverified",
        })
        .where(eq(vendors.id, submission.vendorId));

      return updated;
    }
  }

  /**
   * Retrieves pending banking submissions for the review queue.
   */
  static async getPendingSubmissions(stage: "stage1" | "stage2" | "all" = "all"): Promise<any[]> {
    let query = db
      .select({
        submission: vendorBankingSubmissions,
        vendor: {
          id: vendors.id,
          companyName: vendors.companyName,
          vendorType: vendors.vendorType,
          contactPerson: vendors.contactPerson,
          email: vendors.email,
        },
      })
      .from(vendorBankingSubmissions)
      .innerJoin(vendors, eq(vendorBankingSubmissions.vendorId, vendors.id))
      .orderBy(desc(vendorBankingSubmissions.submittedAt));

    const results = await query;

    if (stage === "stage1") {
      return results.filter((r) => r.submission.status === "pending_stage1");
    } else if (stage === "stage2") {
      return results.filter((r) => r.submission.status === "pending_stage2");
    }

    return results;
  }
}
