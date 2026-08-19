import { db } from "@db";
import { vendors, vendorDocuments, vendorComplianceSettings, vendorComplianceCases, auditLogs } from "@db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface ComplianceEvaluationResult {
  vendorId: number;
  vendorType: string;
  previousStatus: string;
  newStatus: string;
  complianceScore: number;
  missingDocuments: string[];
  expiringDocuments: Array<{ documentType: string; expiryDate: Date; daysRemaining: number }>;
  expiredDocuments: Array<{ documentType: string; expiryDate: Date }>;
  validDocuments: string[];
  isInGracePeriod: boolean;
  gracePeriodDeadline?: Date | null;
}

export class ComplianceEvaluationService {
  /**
   * Deterministically evaluates a vendor's compliance posture across all documents,
   * expiration thresholds, and checklist configurations.
   */
  static async evaluateVendor(vendorId: number, executorId?: number): Promise<ComplianceEvaluationResult> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor #${vendorId} not found for compliance evaluation`);
    }

    // 1. Fetch compliance settings or defaults
    const [settings] = await db
      .select()
      .from(vendorComplianceSettings)
      .limit(1);

    const companyChecklist: string[] = settings?.companyChecklist || ["CR", "TAX_CARD", "ESTABLISHMENT_ID"];
    const freelancerChecklist: string[] = settings?.freelancerChecklist || [];

    const activeChecklist = vendor.vendorType === "freelancer" ? freelancerChecklist : companyChecklist;

    // 2. If active checklist is completely empty, compliance is not applicable
    if (!activeChecklist || activeChecklist.length === 0) {
      const newStatus = "compliance_not_applicable";
      if (vendor.complianceStatus !== newStatus) {
        await db.update(vendors)
          .set({ complianceStatus: newStatus, complianceScore: 100, updatedAt: new Date() })
          .where(eq(vendors.id, vendorId));
      }
      return {
        vendorId,
        vendorType: vendor.vendorType,
        previousStatus: vendor.complianceStatus,
        newStatus,
        complianceScore: 100,
        missingDocuments: [],
        expiringDocuments: [],
        expiredDocuments: [],
        validDocuments: [],
        isInGracePeriod: false,
      };
    }

    // 3. Fetch all active approved documents for this vendor
    const activeDocs = await db
      .select()
      .from(vendorDocuments)
      .where(and(
        eq(vendorDocuments.vendorId, vendorId),
        eq(vendorDocuments.status, "valid"),
        eq(vendorDocuments.reviewStatus, "approved")
      ))
      .orderBy(desc(vendorDocuments.uploadedAt));

    // Deduplicate by latest documentType
    const latestDocMap = new Map<string, typeof activeDocs[0]>();
    for (const doc of activeDocs) {
      if (!latestDocMap.has(doc.documentType)) {
        latestDocMap.set(doc.documentType, doc);
      }
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const missingDocuments: string[] = [];
    const expiredDocuments: Array<{ documentType: string; expiryDate: Date }> = [];
    const expiringDocuments: Array<{ documentType: string; expiryDate: Date; daysRemaining: number }> = [];
    const validDocuments: string[] = [];

    for (const requiredType of activeChecklist) {
      const doc = latestDocMap.get(requiredType);
      if (!doc) {
        missingDocuments.push(requiredType);
        continue;
      }

      if (doc.expiryDate) {
        const expiry = new Date(doc.expiryDate);
        if (expiry.getTime() < now.getTime()) {
          expiredDocuments.push({ documentType: requiredType, expiryDate: expiry });
        } else if (expiry.getTime() <= thirtyDaysFromNow.getTime()) {
          const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
          expiringDocuments.push({ documentType: requiredType, expiryDate: expiry, daysRemaining });
          validDocuments.push(requiredType);
        } else {
          validDocuments.push(requiredType);
        }
      } else {
        validDocuments.push(requiredType);
      }
    }

    // 4. Check active grace period
    const isInGracePeriod = Boolean(
      vendor.gracePeriodDeadline && new Date(vendor.gracePeriodDeadline).getTime() > now.getTime()
    );

    // 5. Determine new status and score
    let newStatus: string = "compliant";
    let complianceScore = 100;

    if (missingDocuments.length > 0 || expiredDocuments.length > 0) {
      if (isInGracePeriod) {
        newStatus = "grace_period";
        complianceScore = 50;
      } else {
        newStatus = "non_compliant";
        complianceScore = 0;
      }
    } else if (expiringDocuments.length > 0) {
      newStatus = "expiring_soon";
      complianceScore = 75;
    } else {
      newStatus = "compliant";
      complianceScore = 100;
    }

    // Preserve legacy_pending_assessment if vendor is unassessed and not yet evaluated
    if (vendor.complianceStatus === "legacy_pending_assessment" && newStatus === "non_compliant" && !vendor.remarks?.includes("FORMAL_AUDIT_COMPLETED")) {
      newStatus = "legacy_pending_assessment";
    }

    // 6. Update vendor if status or score changed
    if (vendor.complianceStatus !== newStatus || vendor.complianceScore !== complianceScore) {
      await db.update(vendors)
        .set({
          complianceStatus: newStatus,
          complianceScore,
          complianceMetadata: {
            lastEvaluatedAt: now.toISOString(),
            missingDocuments,
            expiredDocuments,
            expiringDocuments,
            validDocuments,
          },
          updatedAt: now,
        })
        .where(eq(vendors.id, vendorId));

      // Record audit log
      try {
        await db.insert(auditLogs).values({
          resourceType: "vendor",
          resourceId: vendorId,
          action: "COMPLIANCE_STATUS_RECALCULATED",
          userId: executorId || 1,
          details: {
            previousStatus: vendor.complianceStatus,
            newStatus,
            complianceScore,
            missingDocuments,
            expiredDocuments,
            expiringDocuments,
          },
        });
      } catch (logErr) {
        console.error("[ComplianceEvaluationService] Audit log write failed:", logErr);
      }
    }

    return {
      vendorId,
      vendorType: vendor.vendorType,
      previousStatus: vendor.complianceStatus,
      newStatus,
      complianceScore,
      missingDocuments,
      expiringDocuments,
      expiredDocuments,
      validDocuments,
      isInGracePeriod,
      gracePeriodDeadline: vendor.gracePeriodDeadline,
    };
  }
}
