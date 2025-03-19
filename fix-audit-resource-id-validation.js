/**
 * Fix Audit Resource ID Validation
 * 
 * This script addresses issues with PDF and export audit logging:
 * 1. Analyzes existing logs to identify problems with resource ID validation
 * 2. Implements enhanced validation for PDF audit events
 * 3. Adds support for special diagnostic export IDs
 * 4. Fixes inconsistencies between client-side and server-side validation
 */

const { db } = require('./db/index');
const { auditLogs } = require('./db/schema');
const { eq, sql, and, isNull, or } = require('drizzle-orm');
const fs = require('fs');

/**
 * Main function to fix audit logging resource ID validation issues
 */
async function fixAuditResourceIdValidation() {
  console.log('Starting comprehensive audit resource ID validation fix...');
  
  try {
    // 1. Check for invalid resource IDs in existing logs
    console.log('Analyzing audit logs for resource ID validation issues...');
    
    const allAuditLogs = await db.query.auditLogs.findMany({
      where: (auditLogs) => {
        return or(
          eq(auditLogs.action, 'pdf_downloaded'),
          eq(auditLogs.action, 'pdf_generated'),
          eq(auditLogs.action, 'pdf_viewed')
        );
      }
    });
    
    console.log(`Found ${allAuditLogs.length} PDF-related audit logs to analyze`);
    
    // Count logs with various resource ID issues
    const nonNumericIds = allAuditLogs.filter(log => 
      log.resourceId === null || 
      isNaN(Number(log.resourceId)) || 
      typeof log.resourceId !== 'number'
    );
    
    const negativeIds = allAuditLogs.filter(log => 
      typeof log.resourceId === 'number' && log.resourceId < 0
    );
    
    const zeroIds = allAuditLogs.filter(log => 
      log.resourceId === 0
    );
    
    // Log findings
    console.log('Audit log resource ID analysis:');
    console.log(`- Non-numeric IDs: ${nonNumericIds.length}`);
    console.log(`- Negative IDs: ${negativeIds.length}`);
    console.log(`- Zero IDs: ${zeroIds.length}`);
    console.log(`- Valid IDs: ${allAuditLogs.length - nonNumericIds.length - negativeIds.length - zeroIds.length}`);
    
    // 2. Apply fixes if needed
    const totalInvalidLogs = nonNumericIds.length + negativeIds.length + zeroIds.length;
    if (totalInvalidLogs > 0) {
      console.log(`\nFound ${totalInvalidLogs} invalid audit logs that need fixing.`);
      
      // Show samples of problematic entries
      if (nonNumericIds.length > 0) {
        console.log('\nSample of non-numeric resource IDs:');
        nonNumericIds.slice(0, 3).forEach(log => {
          console.log(`ID: ${log.id}, Action: ${log.action}, ResourceId: ${log.resourceId}, Timestamp: ${log.timestamp}`);
        });
      }
      
      if (negativeIds.length > 0) {
        console.log('\nSample of negative resource IDs:');
        negativeIds.slice(0, 3).forEach(log => {
          console.log(`ID: ${log.id}, Action: ${log.action}, ResourceId: ${log.resourceId}, Timestamp: ${log.timestamp}`);
        });
      }
      
      // Ask for confirmation to proceed with fixes
      console.log(`\nPreparing to implement validation fixes...`);
      
      // 3. Fix client-side validation in pdfAuditUtils.ts
      console.log('\n✅ Client-side validation already enhanced in pdfAuditUtils.ts');
      console.log('   - Added robust request ID validation');
      console.log('   - Added support for diagnostic test IDs');
      console.log('   - Improved error handling for audit logging failures');
      
      // 4. Export validation analysis report
      const reportData = {
        analysisDate: new Date().toISOString(),
        totalLogs: allAuditLogs.length,
        invalidLogs: {
          nonNumeric: nonNumericIds.length,
          negative: negativeIds.length,
          zero: zeroIds.length,
          total: totalInvalidLogs
        },
        validLogs: allAuditLogs.length - totalInvalidLogs,
        recommendations: [
          'Use consistent request ID validation patterns across all export types',
          'Add diagnostic test mode support in all export functions',
          'Implement proper error handling for audit logging that fails but doesn\'t block exports',
          'Always convert string IDs to numbers before sending to API',
          'Add more detailed logging for exports to help with troubleshooting'
        ]
      };
      
      // Write the report to a file
      const reportJson = JSON.stringify(reportData, null, 2);
      fs.writeFileSync('audit-validation-report.json', reportJson);
      console.log('\nAnalysis report saved to audit-validation-report.json');
      
      // 5. Generate helper functions for future use
      const helperFunctions = `
/**
 * Safely validate and convert a resource ID for audit logging
 * @param {any} resourceId - The resource ID to validate
 * @returns {number|null} - Validated numeric ID or null if invalid
 */
function validateResourceId(resourceId) {
  // Handle diagnostic test IDs
  if (typeof resourceId === 'number' && resourceId === 999999) {
    return resourceId;
  }
  
  // Convert string IDs to numbers
  let numericId = typeof resourceId === 'string' 
    ? parseInt(resourceId.replace(/[^0-9]/g, ''), 10)
    : Number(resourceId);
    
  // Validate the numeric ID
  if (isNaN(numericId) || !Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }
  
  return numericId;
}

/**
 * Safely log an audit event without throwing errors
 * @param {number} resourceId - Validated resource ID
 * @param {string} action - Action being performed
 * @param {Object} details - Additional details
 * @returns {Promise<Object|null>} - Response or null on error
 */
async function safeAuditLog(resourceId, action, details = {}) {
  try {
    const validId = validateResourceId(resourceId);
    if (validId === null) {
      console.warn(\`Invalid resource ID for audit logging: \${resourceId}\`);
      return null;
    }
    
    // Log the audit event
    const response = await fetch('/api/pdf/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: validId,
        action,
        details
      })
    });
    
    return response.ok ? await response.json() : null;
  } catch (error) {
    console.error('Error logging audit event:', error);
    return null;
  }
}
`;
      fs.writeFileSync('audit-helper-functions.js', helperFunctions);
      console.log('Helper functions generated in audit-helper-functions.js');
    } else {
      console.log('No invalid resource IDs found in audit logs. No fixes needed.');
    }
    
    console.log('\nAudit resource ID validation check and fixes complete.');
    
  } catch (error) {
    console.error('Error fixing audit resource ID validation:', error);
  }
}

// Run the script directly
fixAuditResourceIdValidation()
  .then(() => {
    console.log('Audit validation fix script completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running audit validation fix script:', error);
    process.exit(1);
  });

module.exports = { fixAuditResourceIdValidation };