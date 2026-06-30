import { db } from './db/index'; 
import { purchaseRequests, approvals } from './db/schema'; 
import { eq, ne } from 'drizzle-orm'; 

async function test() { 
  const prs = await db.select().from(purchaseRequests).where(ne(purchaseRequests.status, 'draft')); 
  for (const pr of prs) { 
    const apps = await db.select().from(approvals).where(eq(approvals.requestId, pr.id)); 
    console.log(`PR ${pr.id} [${pr.status}]`);
    for (const a of apps) {
      console.log(`  - ${a.department} (${a.status}) isMandatory:${a.isMandatory}`);
    }
  } 
  process.exit(0); 
} 
test();
