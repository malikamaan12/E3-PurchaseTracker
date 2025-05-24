// Simplified service - removed AI dependency for a lighter app

/**
 * Simple form analysis - no AI dependency
 */
export async function analyzeFormStateIssue(formCode: string): Promise<string> {
  // Basic analysis
  return "Check form state management and event handlers for potential issues.";
}

/**
 * Analyze draft submission with basic validation - no AI dependency
 */
export async function analyzeDraftSubmission(formData: any, validationErrors: string[]): Promise<{
  fixedData: any;
  analysisMessage: string;
}> {
  // Check if there's any form data
  const hasFormData = formData && 
    (formData.title || 
     formData.description || 
     (formData.items && formData.items.length > 0 && formData.items.some((i: any) => i.name || i.quantity > 0 || i.estimatedCost > 0)));
  
  if (!hasFormData) {
    return {
      fixedData: formData,
      analysisMessage: "Draft saved with minimal data. Add more details before submitting."
    };
  }
  
  // If there are validation errors, provide basic guidance
  if (validationErrors && validationErrors.length > 0) {
    return {
      fixedData: formData,
      analysisMessage: `Draft saved with ${validationErrors.length} validation issues to fix before submission.`
    };
  }
  
  // Default case - no issues found
  return {
    fixedData: formData,
    analysisMessage: "Draft saved successfully."
  };
}

/**
 * Simple validation context analysis - no AI dependency
 */
export async function analyzeValidationContext(
  formData: any, 
  validationErrors: string[], 
  action: 'draft' | 'submit'
): Promise<{
  shouldProceed: boolean;
  fixedData?: any;
  message: string;
}> {
  // For drafts, always allow saving regardless of validation errors
  if (action === 'draft') {
    return {
      shouldProceed: true,
      fixedData: formData,
      message: validationErrors.length > 0 
        ? "Draft saved with some validation issues. These will need to be fixed before submission."
        : "Draft saved successfully."
    };
  }
  
  // For submission, only proceed if there are no validation errors
  const hasErrors = validationErrors && validationErrors.length > 0;
  
  return {
    shouldProceed: !hasErrors,
    fixedData: formData,
    message: hasErrors
      ? `Please fix the validation issues before submitting: ${validationErrors.join(', ')}`
      : "Request ready for submission."
  };
}