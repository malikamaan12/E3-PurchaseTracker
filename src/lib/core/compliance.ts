import { db } from "@db";
import { vendors, vendorDocuments } from "@db/schema";
import { eq } from "drizzle-orm";
import { differenceInDays } from "date-fns";

/**
 * PROPRIETARY INTELLECTUAL PROPERTY
 * Core Heuristic Matching Engine for Vendor Compliance
 * 
 * Scans vendor metadata and evaluates the compliance health score.
 * Returns { isBlocked: true, message: string } if the vendor fails compliance.
 * 
 * @param vendorId The database ID of the vendor
 * @returns Object with isBlocked status and message if blocked
 */
export async function evaluateCompliance(vendorId: number): Promise<{ isBlocked: boolean; message?: string }> {
  if (!vendorId) return { isBlocked: false };

  const vendorRecord = await db.select({ 
    score: vendors.complianceScore,
    name: vendors.companyName 
  })
  .from(vendors)
  .where(eq(vendors.id, vendorId))
  .limit(1);

  if (vendorRecord.length === 0) return { isBlocked: false };
  const v = vendorRecord[0];

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
