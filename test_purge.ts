import { db } from './db/index'; 
import { purchaseRequests } from './db/schema'; 
async function main() { 
  try { 
    await db.delete(purchaseRequests); 
    console.log('success'); 
  } catch (e) { 
    console.error('PG ERROR:', e); 
  } 
  process.exit(0); 
}; 
main();
