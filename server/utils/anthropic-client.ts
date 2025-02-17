import { type PurchaseRequestWithRelations } from '@db/schema';

// Enhanced error analysis utility with prediction
export async function analyzeError(error: Error | string | unknown, context: string): Promise<{
  message: string;
  predictions: string[];
  suggestions: string[];
}> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`Error in ${context}:`, {
    message: errorMessage,
    stack: errorStack,
  });

  // Analyze error patterns and predict potential issues
  const predictions = predictPotentialIssues(errorMessage, context);
  const suggestions = generateSuggestions(errorMessage, context, predictions);

  return {
    message: `An error occurred in ${context}. ${errorMessage}`,
    predictions,
    suggestions
  };
}

// Predict potential issues based on error patterns
function predictPotentialIssues(errorMessage: string, context: string): string[] {
  const predictions: string[] = [];
  const lowerError = errorMessage.toLowerCase();

  // Database related predictions
  if (context.includes('database') || lowerError.includes('sql')) {
    predictions.push(
      'Potential connection timeout issues',
      'Possible schema inconsistencies',
      'Risk of data constraints violations'
    );
  }

  // Authentication related predictions
  if (context.includes('auth') || lowerError.includes('permission') || lowerError.includes('unauthorized')) {
    predictions.push(
      'Session might expire soon',
      'User roles might need verification',
      'Possible token validation issues'
    );
  }

  // Form submission related predictions
  if (context.includes('form') || context.includes('submit')) {
    predictions.push(
      'Validation errors might occur',
      'File upload size limits might be reached',
      'Required fields might be missing'
    );
  }

  // API related predictions
  if (context.includes('api') || lowerError.includes('request failed')) {
    predictions.push(
      'Rate limits might be approached',
      'Network timeout risks',
      'API endpoint availability issues'
    );
  }

  return predictions;
}

// Generate suggestions based on error and predictions
function generateSuggestions(errorMessage: string, context: string, predictions: string[]): string[] {
  const suggestions: string[] = [];
  const lowerError = errorMessage.toLowerCase();

  // Generic suggestions
  suggestions.push('Verify all required fields are filled correctly');
  suggestions.push('Check your network connection');

  // Context-specific suggestions
  if (context.includes('database')) {
    suggestions.push(
      'Ensure database credentials are correct',
      'Verify database schema matches expected structure',
      'Check for any pending migrations'
    );
  }

  if (context.includes('auth')) {
    suggestions.push(
      'Try logging out and back in',
      'Check if your session is still valid',
      'Verify you have the required permissions'
    );
  }

  if (lowerError.includes('timeout')) {
    suggestions.push(
      'Try the operation again',
      'Check your internet connection',
      'The server might be experiencing high load'
    );
  }

  // Add prediction-based suggestions
  if (predictions.some(p => p.includes('validation'))) {
    suggestions.push(
      'Review form input requirements',
      'Check for any special character restrictions',
      'Ensure file types match allowed formats'
    );
  }

  return suggestions;
}

// Enhanced purchase request analysis with AI
export async function analyzePurchaseRequest(request: PurchaseRequestWithRelations) {
  try {
    const totalCost = Number(request.totalEstimatedCost || 0);
    const hasMandatoryApprovals = request.approvals?.some(a => a.isMandatory);
    const isUrgent = request.priority === 'urgent';

    let priority: 'low' | 'medium' | 'high' | 'urgent';
    let score = 50; // Default medium score
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Analyze potential issues
    if (totalCost > 50000) {
      warnings.push('High-value request requires additional scrutiny');
      suggestions.push('Prepare detailed justification documentation');
    }

    if (request.items?.length === 0) {
      warnings.push('Request contains no items');
      suggestions.push('Add at least one item to the request');
    }

    if (!request.purpose) {
      warnings.push('Purpose not specified');
      suggestions.push('Add a clear purpose description');
    }

    // Determine priority and score
    if (isUrgent) {
      priority = 'urgent';
      score = 90;
      suggestions.push('Ensure emergency approval procedures are followed');
    } else if (totalCost > 10000 || hasMandatoryApprovals) {
      priority = 'high';
      score = 75;
      suggestions.push('Prepare comprehensive documentation');
    } else if (totalCost > 5000) {
      priority = 'medium';
      score = 50;
      suggestions.push('Include detailed cost breakdown');
    } else {
      priority = 'low';
      score = 25;
      suggestions.push('Standard approval process applies');
    }

    // Add time-based suggestions
    const currentHour = new Date().getHours();
    if (currentHour > 16) { // After 4 PM
      suggestions.push('Consider submitting during business hours for faster processing');
    }

    return {
      priority,
      score,
      warnings,
      suggestions,
      reason: `Priority based on cost (${totalCost}), urgency (${isUrgent}), and approval requirements`,
    };
  } catch (error) {
    console.error('Error analyzing purchase request:', error);
    return {
      priority: 'medium',
      score: 50,
      warnings: ['Analysis encountered an error'],
      suggestions: ['Please review all inputs and try again'],
      reason: 'Unable to analyze - using default priority'
    };
  }
}

// Enhanced UI component analysis
export async function analyzeUIComponent(
  componentCode: string,
  errorDescription: string
): Promise<{
  issues: string[];
  predictions: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const predictions: string[] = [];
  const recommendations: string[] = [];

  // Pattern analysis
  if (errorDescription.toLowerCase().includes('undefined')) {
    issues.push('Possible null/undefined value access');
    predictions.push(
      'Similar undefined errors might occur in related components',
      'State updates might cause undefined values'
    );
    recommendations.push(
      'Add null checks before accessing properties',
      'Implement default values for nullable properties',
      'Consider using optional chaining'
    );
  }

  if (errorDescription.toLowerCase().includes('type')) {
    issues.push('Type mismatch in component');
    predictions.push(
      'Similar type errors might exist in child components',
      'API responses might not match expected types'
    );
    recommendations.push(
      'Verify prop types and event handler parameters',
      'Add type guards for complex data structures',
      'Update component interfaces if needed'
    );
  }

  // Code analysis
  if (componentCode.includes('useEffect')) {
    predictions.push(
      'Potential memory leaks in effect cleanup',
      'Possible infinite effect loops'
    );
    recommendations.push(
      'Verify effect dependencies',
      'Implement proper cleanup functions',
      'Consider using useCallback for handlers'
    );
  }

  if (componentCode.includes('useState')) {
    predictions.push(
      'State updates might be batched unexpectedly',
      'Initial state might be computed unnecessarily'
    );
    recommendations.push(
      'Use functional updates for state changes',
      'Consider using useMemo for complex initial states'
    );
  }

  // Add default recommendations if no specific issues found
  if (issues.length === 0) {
    issues.push('Manual review required');
    predictions.push(
      'Performance issues might arise with larger datasets',
      'Component might not handle edge cases'
    );
    recommendations.push(
      'Review component lifecycle',
      'Add error boundaries',
      'Implement proper loading states'
    );
  }

  return { issues, predictions, recommendations };
}