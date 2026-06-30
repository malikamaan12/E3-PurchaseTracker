
import { db } from './db/index';
import { purchaseRequests, approvals } from './db/schema';
import { desc, eq } from 'drizzle-orm';

async function test() {
  const prs = await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.id)).limit(5);
  console.log('Recent PRs:');
  for (const pr of prs) {
     console.log('ID: ' + pr.id + ' Status: ' + pr.status + ' EstCost: ' + pr.totalEstimatedCost + ' Proposed: ' + pr.proposedRevisedCost + ' BaseQar: ' + pr.baseAmountQar);
     const app = await db.select().from(approvals).where(eq(approvals.requestId, pr.id));
     console.log('  Approvals:', app.map(a => a.department + ': ' + a.status).join(', '));
  }
  process.exit(0);
}
test();

