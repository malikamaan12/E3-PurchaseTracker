
import { db } from './db/index';
import { purchaseRequests, approvals } from './db/schema';
import { eq, and, inArray } from 'drizzle-orm';

async function test() {
  try {
     const prId = 58;
     
     // First update Finance and CEO Office to approved
     await db.update(approvals).set({ status: 'approved' }).where(and(eq(approvals.requestId, prId), inArray(approvals.department, ['Finance', 'CEO Office'])));
     
     const nextRequestStatus = 'approved';
     const finalizedProposedCost = undefined;
     const [updatedRequest] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);

     const activeCost = finalizedProposedCost ?? updatedRequest.revisedTotalCost ?? updatedRequest.totalEstimatedCost ?? 0;
     const baseAmountQar = Math.round(activeCost * Number(updatedRequest.exchangeRate || 1.0));
     
     const [finalRequest] = await db
      .update(purchaseRequests)
      .set({
        status: nextRequestStatus as any,
        isLocked: true,
        revisedTotalCost: finalizedProposedCost ?? updatedRequest.revisedTotalCost,
        proposedRevisedCost: finalizedProposedCost ? null : updatedRequest.proposedRevisedCost, // Clear staging if approved
        exchangeRate: updatedRequest.exchangeRate,
        baseAmountQar,
        updatedAt: new Date()
      })
      .where(eq(purchaseRequests.id, prId))
      .returning();
      
      console.log('Final Update success:', finalRequest?.status);
  } catch(e) {
      console.error('Update failed:', e);
  }
  process.exit(0);
}
test();

