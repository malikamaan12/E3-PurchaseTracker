import { db } from "@db";
import {
  vendors,
  vendorAssignedRequirements,
  vendorRequirementSubmissions,
  vendorComplianceScoreHistory,
  vendorDocuments,
  auditLogs,
  type VendorAssignedRequirement,
} from "../../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface ComplianceSnapshotData {
  vendorId: number;
  vendorName: string;
  entityType: string;
  engagementType: string;
  complianceScore: number;
  complianceStatus: string;
  vendorAgeDays: number;
  complianceDeadline: string | null;
  isOverdue: boolean;
  overdueDays: number;
  missingMandatoryKeys: string[];
  expiredRequirementKeys: string[];
  rulesetVersionId: number | null;
  assignedRequirementsCount: number;
  verifiedCount: number;
  underReviewCount: number;
  missingCount: number;
  snapshotTimestamp: string;
}

export interface ComplianceEvaluationResult {
  vendorId: number;
  previousScore: number;
  newScore: number;
  previousStatus: string;
  newStatus: string;
  isCompliant: boolean;
  scoreBreakdown: {
    totalWeight: number;
    earnedWeight: number;
    score: number;
    verifiedRequirements: string[];
    underReviewRequirements: string[];
    missingMandatory: string[];
    expiredRequirements: string[];
    expiringSoonRequirements: string[];
    optionalIncomplete: string[];
  };
  summaryLabel: string;
}

export class ComplianceEvaluationService {
  /**
   * Deterministically evaluates a vendor's compliance posture across assigned requirements,
   * verification states, document expiration, and deadlines.
   */
  static async evaluateVendor(
    vendorId: number,
    triggeringEvent: string = "MANUAL_EVALUATION",
    executorId?: number
  ): Promise<ComplianceEvaluationResult> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor #${vendorId} not found for compliance evaluation`);
    }

    const assignedRequirements = await db
      .select()
      .from(vendorAssignedRequirements)
      .where(eq(vendorAssignedRequirements.vendorId, vendorId))
      .orderBy(vendorAssignedRequirements.displayOrder);

    const now = new Date();
    const vendorCreatedAt = vendor.createdAt ? new Date(vendor.createdAt) : now;
    const vendorAgeDays = Math.max(0, Math.floor((now.getTime() - vendorCreatedAt.getTime()) / (1000 * 60 * 60 * 24)));

    let complianceDeadline = vendor.complianceDeadline ? new Date(vendor.complianceDeadline) : null;
    let isOverdue = false;
    let overdueDays = 0;

    if (complianceDeadline) {
      const diffMs = now.getTime() - complianceDeadline.getTime();
      if (diffMs > 0) {
        isOverdue = true;
        overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    let totalWeight = 0;
    let earnedWeight = 0;
    const verifiedRequirements: string[] = [];
    const underReviewRequirements: string[] = [];
    const missingMandatory: string[] = [];
    const expiredRequirements: string[] = [];
    const expiringSoonRequirements: string[] = [];
    const optionalIncomplete: string[] = [];

    let hasUnderReviewMandatory = false;
    let hasMissingOrRejectedMandatory = false;
    let hasExpiredMandatory = false;
    let hasExpiringSoonMandatory = false;

    // Evaluate each assigned requirement
    for (const req of assignedRequirements) {
      const weight = req.scoreWeight || 10;
      if (req.affectsScore) {
        totalWeight += weight;
      }

      // Refresh deadline status if needed
      let deadlineStatus = req.deadlineStatus;
      const reqDueDate = new Date(req.resolvedDueDate);
      if (req.submissionStatus === "missing" || req.submissionStatus === "rejected") {
        deadlineStatus = now > reqDueDate ? "overdue" : "due";
      }

      if (req.submissionStatus === "verified") {
        if (req.validityStatus === "expired") {
          expiredRequirements.push(req.ruleKey);
          if (req.isMandatory) hasExpiredMandatory = true;
        } else {
          // Verified & not expired: Award 100% of weight
          if (req.affectsScore) earnedWeight += weight;
          verifiedRequirements.push(req.ruleKey);

          if (req.validityStatus === "expiring_soon") {
            expiringSoonRequirements.push(req.ruleKey);
            if (req.isMandatory) hasExpiringSoonMandatory = true;
          }
        }
      } else if (req.submissionStatus === "submitted" || req.submissionStatus === "under_review") {
        // DIRECTIVE 1: Submitted or under-review requirements receive 0 compliance-score credit until verified.
        underReviewRequirements.push(req.ruleKey);
        if (req.isMandatory) {
          hasUnderReviewMandatory = true;
        }
      } else {
        // Missing or rejected
        if (req.isMandatory) {
          missingMandatory.push(req.ruleKey);
          hasMissingOrRejectedMandatory = true;
        } else if (req.affectsScore) {
          optionalIncomplete.push(req.ruleKey);
        }
      }
    }

    // Mathematical score calculation (0-100)
    let newScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
    newScore = Math.max(0, Math.min(100, newScore));

    // Derive compliance status
    let newStatus = "compliant";

    if (hasExpiredMandatory) {
      newStatus = "non_compliant";
    } else if (hasMissingOrRejectedMandatory) {
      if (isOverdue) {
        newStatus = "non_compliant";
      } else {
        newStatus = "pending";
      }
    } else if (hasUnderReviewMandatory) {
      newStatus = "under_review";
    } else if (hasExpiringSoonMandatory) {
      newStatus = "expiring_soon";
    } else {
      newStatus = "compliant";
    }

    // Build human-readable summary label
    let summaryLabel = "";
    if (newStatus === "compliant") {
      if (newScore === 100) {
        summaryLabel = "Compliant — 100% Profile Score. All requirements satisfied.";
      } else {
        summaryLabel = `Compliant — ${newScore}% Profile Score. All mandatory requirements satisfied; optional details incomplete.`;
      }
    } else if (newStatus === "under_review") {
      summaryLabel = `Submitted — Under Review (${newScore}% Score). Documents submitted, pending review.`;
    } else if (newStatus === "pending") {
      summaryLabel = `Pending — ${newScore}% Score. Mandatory requirements due before ${vendor.complianceDeadline ? new Date(vendor.complianceDeadline).toLocaleDateString() : "deadline"}.`;
    } else if (newStatus === "expiring_soon") {
      summaryLabel = `Expiring Soon — ${newScore}% Score. Mandatory document expiring in less than 30 days.`;
    } else {
      summaryLabel = `Non-Compliant — ${newScore}% Score. ${isOverdue ? `Overdue by ${overdueDays} days.` : "Mandatory requirements missing or expired."}`;
    }

    const previousScore = vendor.complianceScore || 0;
    const previousStatus = vendor.complianceStatus || "unassessed";

    // Update vendor record
    await db
      .update(vendors)
      .set({
        complianceScore: newScore,
        complianceStatus: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    const scoreBreakdown = {
      totalWeight,
      earnedWeight,
      score: newScore,
      verifiedRequirements,
      underReviewRequirements,
      missingMandatory,
      expiredRequirements,
      expiringSoonRequirements,
      optionalIncomplete,
    };

    // Log append-only score history
    if (previousScore !== newScore || previousStatus !== newStatus || triggeringEvent === "INITIAL_CREATION") {
      await db.insert(vendorComplianceScoreHistory).values({
        vendorId,
        previousScore,
        newScore,
        previousStatus,
        newStatus,
        calculationBreakdown: scoreBreakdown,
        triggeringEvent,
        rulesetVersionId: vendor.rulesetVersionId,
        recalculatedBy: executorId,
      });
    }

    return {
      vendorId,
      previousScore,
      newScore,
      previousStatus,
      newStatus,
      isCompliant: newStatus === "compliant",
      scoreBreakdown,
      summaryLabel,
    };
  }

  /**
   * Generates an immutable compliance snapshot for a Purchase Request.
   */
  static async getSnapshot(vendorId: number): Promise<ComplianceSnapshotData> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor #${vendorId} not found for PR snapshot`);
    }

    const reqs = await db
      .select()
      .from(vendorAssignedRequirements)
      .where(eq(vendorAssignedRequirements.vendorId, vendorId));

    const now = new Date();
    const vendorCreatedAt = vendor.createdAt ? new Date(vendor.createdAt) : now;
    const vendorAgeDays = Math.max(0, Math.floor((now.getTime() - vendorCreatedAt.getTime()) / (1000 * 60 * 60 * 24)));

    let complianceDeadlineStr = vendor.complianceDeadline ? new Date(vendor.complianceDeadline).toISOString() : null;
    let isOverdue = false;
    let overdueDays = 0;

    if (vendor.complianceDeadline) {
      const diffMs = now.getTime() - new Date(vendor.complianceDeadline).getTime();
      if (diffMs > 0) {
        isOverdue = true;
        overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    const missingMandatoryKeys: string[] = [];
    const expiredRequirementKeys: string[] = [];
    let verifiedCount = 0;
    let underReviewCount = 0;
    let missingCount = 0;

    for (const r of reqs) {
      if (r.submissionStatus === "verified") {
        verifiedCount++;
        if (r.validityStatus === "expired") {
          expiredRequirementKeys.push(r.ruleKey);
        }
      } else if (r.submissionStatus === "submitted" || r.submissionStatus === "under_review") {
        underReviewCount++;
      } else {
        missingCount++;
        if (r.isMandatory) {
          missingMandatoryKeys.push(r.ruleKey);
        }
      }
    }

    return {
      vendorId,
      vendorName: vendor.companyName,
      entityType: vendor.vendorType,
      engagementType: vendor.engagementType,
      complianceScore: vendor.complianceScore || 0,
      complianceStatus: vendor.complianceStatus || "unassessed",
      vendorAgeDays,
      complianceDeadline: complianceDeadlineStr,
      isOverdue,
      overdueDays,
      missingMandatoryKeys,
      expiredRequirementKeys,
      rulesetVersionId: vendor.rulesetVersionId,
      assignedRequirementsCount: reqs.length,
      verifiedCount,
      underReviewCount,
      missingCount,
      snapshotTimestamp: now.toISOString(),
    };
  }
}
