import { db } from "@db";
import { vendorComplianceOverrides, purchaseRequests, vendors, auditLogs } from "@db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export class ComplianceOverrideService {
  /**
   * Request a compliance override for a specific Purchase Request draft.
   */
  static async requestOverride(params: {
    requestId: number;
    vendorId: number;
    caseId?: number;
    justification: string;
    requestedBy: number;
  }) {
    const { requestId, vendorId, caseId, justification, requestedBy } = params;

    if (!justification || justification.trim().length < 10) {
      throw new Error("Justification is mandatory and must be at least 10 characters.");
    }

    // 1. Verify PR exists and fetch snapshot
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new Error(`Purchase Request #${requestId} not found.`);
    }

    // 2. Verify Vendor exists
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor #${vendorId} not found.`);
    }

    // 3. Check for existing active override for this PR
    const [existing] = await db
      .select()
      .from(vendorComplianceOverrides)
      .where(and(
        eq(vendorComplianceOverrides.requestId, requestId),
        inArray(vendorComplianceOverrides.status, ["pending", "approved"])
      ))
      .limit(1);

    if (existing) {
      throw new Error(`An active compliance override request already exists for PR #${requestId} (Status: ${existing.status}).`);
    }

    const requestSnapshot = {
      prNumber: request.requestNumber || `PR-${request.id}`,
      totalCost: request.totalEstimatedCost,
      currency: request.currency,
      vendorName: vendor.companyName,
      vendorStatus: vendor.complianceStatus,
      createdAt: new Date().toISOString(),
    };

    // 4. Insert override record
    const [override] = await db
      .insert(vendorComplianceOverrides)
      .values({
        requestId,
        vendorId,
        caseId: caseId || null,
        status: "pending",
        justification: justification.trim(),
        requestedBy,
        requestSnapshot,
      })
      .returning();

    // 5. Audit Log
    await db.insert(auditLogs).values({
      resourceType: "purchase_request",
      resourceId: requestId,
      action: "COMPLIANCE_OVERRIDE_REQUESTED",
      userId: requestedBy,
      details: {
        overrideId: override.id,
        vendorId,
        justification: justification.trim(),
      },
    });

    return override;
  }

  /**
   * Review (Approve or Reject) a compliance override. Super Admin only.
   */
  static async reviewOverride(params: {
    overrideId: number;
    action: "approved" | "rejected";
    reviewerId: number;
    rejectionReason?: string;
  }) {
    const { overrideId, action, reviewerId, rejectionReason } = params;

    const [override] = await db
      .select()
      .from(vendorComplianceOverrides)
      .where(eq(vendorComplianceOverrides.id, overrideId))
      .limit(1);

    if (!override) {
      throw new Error(`Compliance override #${overrideId} not found.`);
    }

    if (override.status !== "pending") {
      throw new Error(`Cannot review override with status '${override.status}'.`);
    }

    if (action === "rejected" && (!rejectionReason || rejectionReason.trim().length < 5)) {
      throw new Error("A reason is required when rejecting an override.");
    }

    const now = new Date();
    const [updated] = await db
      .update(vendorComplianceOverrides)
      .set({
        status: action,
        reviewedBy: reviewerId,
        reviewedAt: now,
        rejectionReason: action === "rejected" ? rejectionReason?.trim() : null,
      })
      .where(eq(vendorComplianceOverrides.id, overrideId))
      .returning();

    // Audit Log
    await db.insert(auditLogs).values({
      resourceType: "purchase_request",
      resourceId: override.requestId,
      action: action === "approved" ? "COMPLIANCE_OVERRIDE_APPROVED" : "COMPLIANCE_OVERRIDE_REJECTED",
      userId: reviewerId,
      details: {
        overrideId: override.id,
        vendorId: override.vendorId,
        action,
        rejectionReason,
      },
    });

    return updated;
  }

  /**
   * Atomically consume an approved override upon PR workflow transition.
   */
  static async consumeOverride(requestId: number, userId: number) {
    const [override] = await db
      .select()
      .from(vendorComplianceOverrides)
      .where(and(
        eq(vendorComplianceOverrides.requestId, requestId),
        eq(vendorComplianceOverrides.status, "approved")
      ))
      .limit(1);

    if (!override) return null;

    const [consumed] = await db
      .update(vendorComplianceOverrides)
      .set({
        status: "consumed",
        consumedAt: new Date(),
      })
      .where(eq(vendorComplianceOverrides.id, override.id))
      .returning();

    await db.insert(auditLogs).values({
      resourceType: "purchase_request",
      resourceId: requestId,
      action: "COMPLIANCE_OVERRIDE_CONSUMED",
      userId,
      details: {
        overrideId: override.id,
        vendorId: override.vendorId,
      },
    });

    return consumed;
  }
}
