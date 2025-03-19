/**
 * Audit Validation Helper
 * 
 * This script provides helper functions for proper audit logging validation
 * without requiring database access.
 */

// Helper functions for export validation
export const auditValidationHelpers = {
  /**
   * Safely validate and convert a resource ID for audit logging
   * @param {any} resourceId - The resource ID to validate
   * @returns {number|null} - Validated numeric ID or null if invalid
   */
  validateResourceId(resourceId) {
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
      console.warn(`Invalid resource ID for audit logging: ${resourceId}`);
      return null;
    }
    
    return numericId;
  },

  /**
   * Safely log an audit event without throwing errors
   * @param {number} resourceId - Validated resource ID
   * @param {string} action - Action being performed
   * @param {Object} details - Additional details
   * @returns {Promise<Object|null>} - Response or null on error
   */
  async safeAuditLog(resourceId, action, details = {}) {
    try {
      const validId = this.validateResourceId(resourceId);
      if (validId === null) {
        console.warn(`Invalid resource ID for audit logging: ${resourceId}`);
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
  },

  /**
   * Validates IDs for multiple export types consistently
   * @param {any} resourceId - The resource ID to validate
   * @param {string} exportType - The type of export ('pdf', 'csv', 'excel', 'zip')
   * @returns {number|null} - Validated numeric ID or null if invalid
   */
  validateExportResourceId(resourceId, exportType = 'pdf') {
    // Special handling for diagnostic tests with mock IDs
    if (resourceId === 'diagnostic' || resourceId === '999999' || resourceId === 999999) {
      console.log(`Using special diagnostic ID for ${exportType} export validation`);
      return 999999;
    }
    
    return this.validateResourceId(resourceId);
  },

  /**
   * Analyze a provided ID and suggest fixes
   * @param {any} resourceId - The resource ID to analyze
   * @returns {Object} - Analysis result with suggestions
   */
  analyzeResourceId(resourceId) {
    const result = {
      original: resourceId,
      type: typeof resourceId,
      isValid: false,
      suggestedFix: null,
      reason: null
    };
    
    // Handle null/undefined values
    if (resourceId === null || resourceId === undefined) {
      result.reason = 'ID is null or undefined';
      result.suggestedFix = 'Provide a valid numeric ID or use 999999 for diagnostics';
      return result;
    }
    
    // Handle numeric IDs
    if (typeof resourceId === 'number') {
      if (!Number.isInteger(resourceId)) {
        result.reason = 'ID is not an integer';
        result.suggestedFix = `Convert ${resourceId} to an integer using Math.floor() or parseInt()`;
      } else if (resourceId <= 0) {
        result.reason = 'ID is zero or negative';
        result.suggestedFix = 'Provide a positive integer ID';
      } else {
        result.isValid = true;
        result.suggestedFix = 'None needed - already valid';
      }
      return result;
    }
    
    // Handle string IDs
    if (typeof resourceId === 'string') {
      if (resourceId.trim() === '') {
        result.reason = 'ID is an empty string';
        result.suggestedFix = 'Provide a valid numeric ID or use "999999" for diagnostics';
      } else {
        const cleanedId = resourceId.replace(/[^\d]/g, '');
        if (cleanedId === '') {
          result.reason = 'ID contains no numeric characters';
          result.suggestedFix = 'Provide a string containing at least one digit';
        } else {
          const parsedId = parseInt(cleanedId, 10);
          result.reason = 'ID needs to be parsed from string';
          result.suggestedFix = `Parse to ${parsedId} using parseInt("${resourceId}".replace(/[^\\d]/g, ''), 10)`;
          
          if (parsedId > 0) {
            result.isValid = true;
          }
        }
      }
      return result;
    }
    
    // Handle other types
    result.reason = `ID is an unsupported type: ${typeof resourceId}`;
    result.suggestedFix = 'Convert to a numeric ID';
    return result;
  }
};

// Run a simple test
const testResourceIds = [
  123,
  "456",
  "PR-789",
  null,
  undefined,
  -1,
  0,
  "abc",
  123.45,
  999999,
  "diagnostic"
];

console.log('Audit Validation Helper - Test Results:');
console.log('======================================');

testResourceIds.forEach(id => {
  const analysis = auditValidationHelpers.analyzeResourceId(id);
  const validationResult = auditValidationHelpers.validateResourceId(id);
  
  console.log(`ID: ${id} (${typeof id})`);
  console.log(`- Valid: ${analysis.isValid}`);
  console.log(`- Reason: ${analysis.reason}`);
  console.log(`- Suggested Fix: ${analysis.suggestedFix}`);
  console.log(`- Validation Result: ${validationResult}`);
  console.log('-------------------------------------');
});

// Export consistently validated IDs for both Excel and CSV exports
console.log('\nCross-export validation consistency check:');
console.log('=======================================');

const exportTypes = ['pdf', 'csv', 'excel', 'zip'];
const testId = "PR-78901";

exportTypes.forEach(type => {
  const result = auditValidationHelpers.validateExportResourceId(testId, type);
  console.log(`${type.toUpperCase()} export validation for "${testId}": ${result}`);
});

console.log('\nHelper functions ready for import into client code.');