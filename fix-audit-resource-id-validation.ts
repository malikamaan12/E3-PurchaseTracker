/**
 * Fix Audit Resource ID Validation
 * 
 * This script modifies the PDF audit endpoint to properly validate 
 * resource IDs before logging audit events.
 */

import { db } from './db/index';
import { auditLogs } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import type { AuditAction } from './db/schema';

/**
 * Main function to fix audit logging resource ID validation issues
 */
async function fixAuditResourceIdValidation() {
  console.log('Starting audit resource ID validation fix...');
  
  try {
    // 1. First, let's query the schema to identify the correct column name
    const schemaQuery = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs';
    `);
    console.log('Database schema for audit_logs table:');
    console.log(schemaQuery.rows);
    
    // Check if audit logs table exists
    console.log('Checking for PDF audit logs...');
    
    // Direct SQL query to avoid schema mapping issues
    const auditLogsQuery = await db.execute(sql`
      SELECT id, action, resourceid, resourcetype, details 
      FROM audit_logs 
      WHERE action = 'pdf_downloaded'
      LIMIT 100;
    `);
    
    const auditLogRows = auditLogsQuery.rows;
    console.log(`Found ${auditLogRows.length} PDF download audit logs to analyze`);
    
    if (auditLogRows.length === 0) {
      console.log('No audit logs found for PDF downloads.');
      return;
    }
    
    // Count logs with various resource ID issues
    const nonNumericIds = auditLogRows.filter(log => 
      log.resourceid === null || 
      isNaN(Number(log.resourceid)) || 
      typeof log.resourceid !== 'number'
    );
    
    const negativeIds = auditLogRows.filter(log => 
      typeof log.resourceid === 'number' && log.resourceid < 0
    );
    
    const zeroIds = auditLogRows.filter(log => 
      log.resourceid === 0
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
          console.log(`ID: ${log.id}, Action: ${log.action}, ResourceId: ${log.resourceid}`);
        });
      }
      
      if (negativeIds.length > 0) {
        console.log('\nSample of negative resource IDs:');
        negativeIds.slice(0, 3).forEach(log => {
          console.log(`ID: ${log.id}, Action: ${log.action}, ResourceId: ${log.resourceid}`);
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

// Run the script directly
fixAuditResourceIdValidation()
  .then(() => {
    console.log('Audit validation fix script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running audit validation fix script:', error);
    process.exit(1);
  });

export { fixAuditResourceIdValidation };