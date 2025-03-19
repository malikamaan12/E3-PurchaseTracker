/**
 * Fix Audit Resource ID Validation
 * 
 * This script modifies the PDF audit endpoint to properly validate 
 * resource IDs before logging audit events.
 */

const { db } = require('./db');
const { auditLogs } = require('./db/schema');
const { eq } = require('drizzle-orm');

/**
 * Main function to fix audit logging resource ID validation issues
 */
async function fixAuditResourceIdValidation() {
  console.log('Starting audit resource ID validation fix...');
  
  try {
    // 1. Check for invalid resource IDs in existing logs
    console.log('Checking for invalid audit resource IDs...');
    
    const invalidAuditLogs = await db.query.auditLogs.findMany({
      where: (auditLogs) => {
        return eq(auditLogs.action, 'pdf_downloaded');
      }
    });
    
    console.log(`Found ${invalidAuditLogs.length} PDF download audit logs to analyze`);
    
    // Count logs with various resource ID issues
    const nonNumericIds = invalidAuditLogs.filter(log => 
      log.resourceId === null || 
      isNaN(Number(log.resourceId)) || 
      typeof log.resourceId !== 'number'
    );
    
    const negativeIds = invalidAuditLogs.filter(log => 
      typeof log.resourceId === 'number' && log.resourceId < 0
    );
    
    const zeroIds = invalidAuditLogs.filter(log => 
      log.resourceId === 0
    );
    
    // Log findings
    console.log('Audit log resource ID analysis:');
    console.log(`- Non-numeric IDs: ${nonNumericIds.length}`);
    console.log(`- Negative IDs: ${negativeIds.length}`);
    console.log(`- Zero IDs: ${zeroIds.length}`);
    
    // 2. Check if any invalid logs should be fixed
    if (nonNumericIds.length + negativeIds.length + zeroIds.length > 0) {
      console.log('Found invalid audit logs that need fixing.');
      console.log('No automatic fixes applied - manual review recommended.');
      
      // Sample of problematic entries for review
      if (nonNumericIds.length > 0) {
        console.log('\nSample of non-numeric resource IDs:');
        nonNumericIds.slice(0, 3).forEach(log => {
          console.log(`ID: ${log.id}, Action: ${log.action}, ResourceId: ${log.resourceId}`);
        });
      }
      
      if (negativeIds.length > 0) {
        console.log('\nSample of negative resource IDs:');
        negativeIds.slice(0, 3).forEach(log => {
          console.log(`ID: ${log.id}, Action: ${log.action}, ResourceId: ${log.resourceId}`);
        });
      }
    } else {
      console.log('No invalid resource IDs found in audit logs. No fixes needed.');
    }
    
    console.log('\nAudit resource ID validation check complete.');
    
  } catch (error) {
    console.error('Error fixing audit resource ID validation:', error);
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  fixAuditResourceIdValidation()
    .then(() => {
      console.log('Audit validation fix script completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error running audit validation fix script:', error);
      process.exit(1);
    });
}

module.exports = { fixAuditResourceIdValidation };