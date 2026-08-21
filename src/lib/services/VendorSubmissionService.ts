import { db } from "@db";
import {
  vendorAssignedRequirements,
  vendorRequirementSubmissions,
  vendorDocuments,
  vendors,
  auditLogs,
  type VendorRequirementSubmission,
  type VendorAssignedRequirement,
} from "../../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ComplianceEvaluationService } from "./ComplianceEvaluationService";

export interface SubmitRequirementData {
  fieldValue?: string;
  documentIds?: number[];
  expiryDate?: string | Date | null;
  submissionNotes?: string;
}

export class VendorSubmissionService {
  /**
   * Submits a vendor response for an assigned requirement (supporting typed fields, multi-docs, and replacements).
   */
  static async submitResponse(
    assignedRequirementId: number,
    data: SubmitRequirementData,
    submitter: { type: "vendor" | "user"; id?: number }
  ): Promise<{ submission: VendorRequirementSubmission; assignedRequirement: VendorAssignedRequirement }> {
    const [assignedReq] = await db
      .select()
      .from(vendorAssignedRequirements)
      .where(eq(vendorAssignedRequirements.id, assignedRequirementId))
      .limit(1);

    if (!assignedReq) {
      throw new Error(`Assigned requirement ${assignedRequirementId} not found`);
    }

    const previousSubmissions = await db
      .select()
      .from(vendorRequirementSubmissions)
      .where(eq(vendorRequirementSubmissions.assignedRequirementId, assignedRequirementId))
      .orderBy(desc(vendorRequirementSubmissions.versionNumber));

    const nextVersion = previousSubmissions.length > 0 ? previousSubmissions[0].versionNumber + 1 : 1;

    // Mark previous submissions as superseded
    if (previousSubmissions.length > 0) {
      await db
        .update(vendorRequirementSubmissions)
        .set({ status: "superseded" })
        .where(eq(vendorRequirementSubmissions.assignedRequirementId, assignedRequirementId));
    }

    const submittedAt = new Date();
    const resolvedDueDate = new Date(assignedReq.resolvedDueDate);

    // DIRECTIVE 2: Deadline completion is determined using submission timestamp
    const deadlineStatus = submittedAt <= resolvedDueDate ? "completed_on_time" : "completed_late";

    // Evaluate validity status if expiryDate is provided
    let validityStatus: "valid" | "expiring_soon" | "expired" | "not_applicable" = "valid";
    let parsedExpiry: Date | null = null;

    if (data.expiryDate) {
      parsedExpiry = new Date(data.expiryDate);
      if (!isNaN(parsedExpiry.getTime())) {
        const now = new Date();
        const daysToExpiry = Math.floor((parsedExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry < 0) {
          validityStatus = "expired";
        } else if (daysToExpiry <= (assignedReq.expiryRequired ? 30 : 0)) {
          validityStatus = "expiring_soon";
        } else {
          validityStatus = "valid";
        }
      }
    }

    // Insert new versioned submission
    const [submission] = await db
      .insert(vendorRequirementSubmissions)
      .values({
        assignedRequirementId,
        vendorId: assignedReq.vendorId,
        versionNumber: nextVersion,
        fieldValue: data.fieldValue,
        documentIds: data.documentIds || [],
        expiryDate: parsedExpiry,
        submissionNotes: data.submissionNotes,
        status: "submitted",
        submittedByType: submitter.type,
        submittedById: submitter.id,
        submittedAt,
      })
      .returning();

    // Update assigned requirement status
    const [updatedAssignedReq] = await db
      .update(vendorAssignedRequirements)
      .set({
        submissionStatus: "submitted", // Displayed as "Submitted — Under Review"
        validityStatus,
        deadlineStatus,
        updatedAt: new Date(),
      })
      .where(eq(vendorAssignedRequirements.id, assignedRequirementId))
      .returning();

    // Recalculate compliance score
    await ComplianceEvaluationService.evaluateVendor(assignedReq.vendorId, "SUBMISSION_RECEIVED");

    return {
      submission,
      assignedRequirement: updatedAssignedReq,
    };
  }

  /**
   * Verifies or rejects a requirement submission.
   */
  static async verifySubmission(
    submissionId: number,
    decision: "verify" | "reject",
    reviewerId: number,
    notes?: string
  ): Promise<{ submission: VendorRequirementSubmission; assignedRequirement: VendorAssignedRequirement }> {
    const [submission] = await db
      .select()
      .from(vendorRequirementSubmissions)
      .where(eq(vendorRequirementSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    const [assignedReq] = await db
      .select()
      .from(vendorAssignedRequirements)
      .where(eq(vendorAssignedRequirements.id, submission.assignedRequirementId))
      .limit(1);

    if (!assignedReq) {
      throw new Error(`Assigned requirement ${submission.assignedRequirementId} not found`);
    }

    const verifiedAt = new Date();

    if (decision === "verify") {
      const [updatedSubmission] = await db
        .update(vendorRequirementSubmissions)
        .set({
          status: "verified",
          verifiedBy: reviewerId,
          verifiedAt,
          verificationNotes: notes,
        })
        .where(eq(vendorRequirementSubmissions.id, submissionId))
        .returning();

      const [updatedAssignedReq] = await db
        .update(vendorAssignedRequirements)
        .set({
          submissionStatus: "verified",
          updatedAt: verifiedAt,
        })
        .where(eq(vendorAssignedRequirements.id, assignedReq.id))
        .returning();

      // Recalculate score (Awards 100% weight for verified requirement)
      await ComplianceEvaluationService.evaluateVendor(assignedReq.vendorId, "SUBMISSION_VERIFIED", reviewerId);

      return {
        submission: updatedSubmission,
        assignedRequirement: updatedAssignedReq,
      };
    } else {
      // Rejection logic
      const [updatedSubmission] = await db
        .update(vendorRequirementSubmissions)
        .set({
          status: "rejected",
          verifiedBy: reviewerId,
          verifiedAt,
          rejectionReason: notes || "Requirement submission was rejected during verification review.",
        })
        .where(eq(vendorRequirementSubmissions.id, submissionId))
        .returning();

      // DIRECTIVE 2: Reopen requirement. If deadline has passed, mark it overdue.
      const now = new Date();
      const resolvedDueDate = new Date(assignedReq.resolvedDueDate);
      const isPastDeadline = now > resolvedDueDate;

      const [updatedAssignedReq] = await db
        .update(vendorAssignedRequirements)
        .set({
          submissionStatus: "rejected",
          deadlineStatus: isPastDeadline ? "overdue" : "due",
          updatedAt: verifiedAt,
        })
        .where(eq(vendorAssignedRequirements.id, assignedReq.id))
        .returning();

      // Recalculate score
      await ComplianceEvaluationService.evaluateVendor(assignedReq.vendorId, "SUBMISSION_REJECTED", reviewerId);

      return {
        submission: updatedSubmission,
        assignedRequirement: updatedAssignedReq,
      };
    }
  }

  /**
   * Retrieves full submission history for an assigned requirement.
   */
  static async getSubmissionHistory(assignedRequirementId: number): Promise<VendorRequirementSubmission[]> {
    return await db
      .select()
      .from(vendorRequirementSubmissions)
      .where(eq(vendorRequirementSubmissions.assignedRequirementId, assignedRequirementId))
      .orderBy(desc(vendorRequirementSubmissions.versionNumber));
  }
}
