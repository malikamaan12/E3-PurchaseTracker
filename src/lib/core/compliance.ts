import { db } from "@db";
import {
  vendors,
  vendorDocuments,
  purchaseRequestComplianceSnapshots,
  purchaseRequests,
} from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { ComplianceEvaluationService, type ComplianceSnapshotData } from "../services/ComplianceEvaluationService";

/**
 * Non-Blocking Vendor Compliance Assessment for Purchase Requests.
 * Evaluates compliance score and warnings for display and logging without blocking procurement.
 * 
 * In accordance with the approved redesign:
 * Missing or incomplete vendor compliance information NEVER blocks PR creation, submission, or approval.
 */
export async function evaluateCompliance(
  vendorId: number,
  requestId?: number
): Promise<{
  isBlocked: false;
  warning?: string;
  complianceScore: number;
  complianceStatus: string;
  isOverdue: boolean;
  overdueDays: number;
}> {
  if (!vendorId) {
    return {
      isBlocked: false,
      complianceScore: 100,
      complianceStatus: "compliant",
      isOverdue: false,
      overdueDays: 0,
    };
  }

  const [vendor] = await db
    .select({
      id: vendors.id,
      score: vendors.complianceScore,
      name: vendors.companyName,
      status: vendors.status,
      complianceStatus: vendors.complianceStatus,
      complianceDeadline: vendors.complianceDeadline,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    return {
      isBlocked: false,
      complianceScore: 0,
      complianceStatus: "unassessed",
      isOverdue: false,
      overdueDays: 0,
    };
  }

  const now = new Date();
  let isOverdue = false;
  let overdueDays = 0;

  if (vendor.complianceDeadline) {
    const diffMs = now.getTime() - new Date(vendor.complianceDeadline).getTime();
    if (diffMs > 0) {
      isOverdue = true;
      overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  let warning: string | undefined;
  if (vendor.complianceStatus === "non_compliant") {
    warning = `Vendor compliance is currently non-compliant (${vendor.score}% score). Procurement may proceed, but documentation should be requested.`;
  } else if (vendor.complianceStatus === "pending") {
    warning = `Vendor compliance is pending (${vendor.score}% score). Documents are due before deadline.`;
  } else if (vendor.complianceStatus === "expiring_soon") {
    warning = `Vendor has documents expiring in less than 30 days.`;
  }

  return {
    isBlocked: false, // NEVER BLOCK
    warning,
    complianceScore: vendor.score || 0,
    complianceStatus: vendor.complianceStatus || "unassessed",
    isOverdue,
    overdueDays,
  };
}

/**
 * Captures an immutable append-only compliance snapshot for a Purchase Request submission/resubmission event.
 */
export async function capturePrComplianceSnapshot(
  requestId: number,
  vendorId: number,
  eventType: "submission" | "resubmission" | "approval_step" = "submission",
  triggeredBy?: number
): Promise<number> {
  const snapshotData = await ComplianceEvaluationService.getSnapshot(vendorId);

  const [inserted] = await db
    .insert(purchaseRequestComplianceSnapshots)
    .values({
      requestId,
      vendorId,
      eventType,
      complianceScore: snapshotData.complianceScore,
      complianceStatus: snapshotData.complianceStatus,
      vendorAgeDays: snapshotData.vendorAgeDays,
      complianceDeadline: snapshotData.complianceDeadline ? new Date(snapshotData.complianceDeadline) : null,
      isOverdue: snapshotData.isOverdue,
      overdueDays: snapshotData.overdueDays,
      missingMandatoryKeys: snapshotData.missingMandatoryKeys,
      expiredRequirementKeys: snapshotData.expiredRequirementKeys,
      rulesetVersionId: snapshotData.rulesetVersionId,
      rawSnapshotData: snapshotData,
      triggeredBy,
    })
    .returning();

  // Update latest snapshot reference on PR
  await db
    .update(purchaseRequests)
    .set({ latestComplianceSnapshotId: inserted.id })
    .where(eq(purchaseRequests.id, requestId));

  return inserted.id;
}
