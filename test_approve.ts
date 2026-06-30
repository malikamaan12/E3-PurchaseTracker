
import { db } from './db/index';
import { purchaseRequests, approvals } from './db/schema';
import { eq } from 'drizzle-orm';

async function test() {
  try {
     const [pr] = await db.select().from(purchaseRequests).limit(1);

     const [finalRequest] = await db
      .update(purchaseRequests)
      .set({
        baseAmountQar: NaN
      })
      .where(eq(purchaseRequests.id, pr.id))
      .returning();
      
      console.log('Update success', finalRequest.status);
  } catch(e) {
      console.error('Update failed:', e);
  }
  process.exit(0);
}
test();

