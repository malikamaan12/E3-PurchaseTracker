import { db } from './db';
import { vendors } from './db/schema';
import { complianceService } from './src/lib/services/ComplianceService';

async function run() {
  const allVendors = await db.select().from(vendors);
  console.log(`Found ${allVendors.length} vendors`);
  for (const v of allVendors) {
    await complianceService.scanVendorDocuments(v.id);
  }
  console.log('All scanned');
}
run().catch(console.error);
