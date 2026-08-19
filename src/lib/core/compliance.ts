import { db } from "@db";
import { vendors, vendorDocuments, vendorComplianceOverrides } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { differenceInDays } from "date-fns";

/**
 * PROPRIETARY INTELLECTUAL PROPERTY
 * Core Heuristic Matching Engine for Vendor Compliance
 * 
 * Scans vendor metadata and evaluates the compliance health score.
 * Returns { isBlocked: true, message: string } if the vendor fails compliance.
 * If a valid Super-Admin approved override exists for this requestId, permits workflow progression.
 * 
 * @param vendorId The database ID of the vendor
 * @param requestId Optional PR ID to verify approved compliance overrides
 * @returns Object with isBlocked status and message if blocked
 */
export async function evaluateCompliance(
  vendorId: number,
  requestId?: number
): Promise<{ isBlocked: boolean; message?: string; hasApprovedOverride?: boolean }> {
  if (!vendorId) return { isBlocked: false };

  // Check if there is an active approved compliance override for this specific request
  if (requestId) {
    const [approvedOverride] = await db
      .select()
      .from(vendorComplianceOverrides)
      .where(and(
        eq(vendorComplianceOverrides.requestId, requestId),
        eq(vendorComplianceOverrides.status, "approved")
      ))
      .limit(1);

    if (approvedOverride) {
      return { isBlocked: false, hasApprovedOverride: true };
    }
  }

  const vendorRecord = await db.select({ 
    score: vendors.complianceScore,
    name: vendors.companyName,
    status: vendors.status,
  })
  .from(vendors)
  .where(eq(vendors.id, vendorId))
  .limit(1);

  if (vendorRecord.length === 0) return { isBlocked: false };
  const v = vendorRecord[0];

  // Hard stop: Pending, frozen, or blocked vendors are strictly blocked from institutional procurement
  if (v.status !== "active") {
    console.warn(`[PR_GATEKEEPER] BLOCKED: Vendor "${v.name}" (ID: ${vendorId}) is in non-active status: ${v.status}`);
    return {
      isBlocked: true,
      message: `The selected vendor (${v.name}) is currently in "${v.status}" status and is not eligible for purchase requests until approved and active.`
    };
  }

  if (v.score < 50) {
    console.warn(`[PR_GATEKEEPER] BLOCKED: Vendor "${v.name}" (ID: ${vendorId}) has a critical compliance score of ${v.score}%`);
    return { 
      isBlocked: true, 
      message: `The selected vendor (${v.name}) is currently in CRITICAL status (< 50% health) and is blocked from new institutional procurement until documentation is updated.` 
    };
  }

  const docs = await db.select().from(vendorDocuments).where(eq(vendorDocuments.vendorId, vendorId));
  const now = new Date();
  
  for (const doc of docs) {
    if (doc.expiryDate) {
      const daysSinceExpiry = differenceInDays(now, new Date(doc.expiryDate));
      if (daysSinceExpiry > 30) {
         return {
            isBlocked: true,
            message: `Vendor ${v.name} is blocked because their ${doc.documentType} (${doc.documentName}) expired ${daysSinceExpiry} days ago, exceeding the 30-day grace period.`
         };
      }
    }
  }

  return { isBlocked: false };
}
