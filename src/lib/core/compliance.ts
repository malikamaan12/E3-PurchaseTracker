import { db } from "@db";
import { vendors } from "@db/schema";
import { eq } from "drizzle-orm";

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

  if (vendorRecord.length > 0 && vendorRecord[0].score < 50) {
    console.warn(`[PR_GATEKEEPER] BLOCKED: Vendor "${vendorRecord[0].name}" (ID: ${vendorId}) has a critical compliance score of ${vendorRecord[0].score}%`);
    return { 
      isBlocked: true, 
      message: `The selected vendor (${vendorRecord[0].name}) is currently in CRITICAL status (< 50% health) and is blocked from new institutional procurement until documentation is updated.` 
    };
  }

  return { isBlocked: false };
}
