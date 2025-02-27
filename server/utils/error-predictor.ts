import { AppError } from './errors';
import { type PurchaseRequestWithRelations } from '@db/schema';

/**
 * Predicts potential errors based on context and current state
 */
export async function predictErrors(
  context: string,
  data: any
): Promise<{
  predictions: string[];
  suggestions: string[];
}> {
  const predictions: string[] = [];
  const suggestions: string[] = [];

  try {
    // Database-related predictions
    if (context.includes('database') || context.includes('DB')) {
      predictions.push(
        'Database connection may timeout during peak hours',
        'Schema validation might fail with unexpected data formats'
      );
      suggestions.push(
        'Implement connection pooling',
        'Add comprehensive data validation before DB operations',
        'Consider adding retry logic for transient errors'
      );
    }

    // Authentication/authorization predictions
    if (context.includes('auth') || context.includes('permission')) {
      predictions.push(
        'Token expiration might cause unexpected logouts',
        'Permission changes may not be immediately reflected'
      );
      suggestions.push(
        'Implement token refresh mechanisms',
        'Add grace periods for permission changes',
        'Include clear error messages for permission issues'
      );
    }

    // Request-specific predictions
    if (context.includes('request') && data) {
      if (data.totalEstimatedCost > 50000) {
        predictions.push(
          'High-value requests frequently require additional approval steps',
          'Cost justification documentation may be scrutinized more heavily'
        );
        suggestions.push(
          'Prepare detailed cost breakdowns',
          'Include multiple vendor quotes for high-value items',
          'Document business justification comprehensively'
        );
      }

      if (data.priority === 'urgent') {
        predictions.push(
          'Urgent requests might bypass normal approval channels',
          'Emergency approvals may require post-approval documentation'
        );
        suggestions.push(
          'Document emergency justification clearly',
          'Follow up with standard documentation after emergency resolution',
          'Notify all stakeholders about urgent request status'
        );
      }
    }

    // File/document predictions
    if (context.includes('file') || context.includes('document')) {
      predictions.push(
        'Large files may exceed upload limits',
        'Unsupported file formats might be rejected',
        'Document processing could timeout for complex files'
      );
      suggestions.push(
        'Check file size before uploading',
        'Verify supported file formats',
        'Break large documents into smaller chunks'
      );
    }

    return { predictions, suggestions };
  } catch (error) {
    console.error('Error in predictErrors:', error);
    return {
      predictions: ['Error analysis system encountered an issue'],
      suggestions: ['Please try again or contact support']
    };
  }
}

/**
 * Analyzes a purchase request for potential issues and opportunities
 */
export async function analyzeRequestForPredictions(
  request: PurchaseRequestWithRelations
): Promise<{
  priority: 'low' | 'medium' | 'high' | 'urgent';
  score: number;
  warnings: string[];
  suggestions: string[];
  predictions: string[];
}> {
  try {
    // Base analysis
    const totalCost = Number(request.totalEstimatedCost || 0);
    const hasMandatoryApprovals = request.approvals?.some(a => a.isMandatory);
    const isUrgent = request.priority === 'urgent';

    let priority: 'low' | 'medium' | 'high' | 'urgent';
    let score = 50; // Default medium score
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const predictions: string[] = [];

    // Determine priority and score
    if (isUrgent) {
      priority = 'urgent';
      score = 90;
    } else if (totalCost > 10000 || hasMandatoryApprovals) {
      priority = 'high';
      score = 75;
    } else if (totalCost > 5000) {
      priority = 'medium';
      score = 50;
    } else {
      priority = 'low';
      score = 25;
    }

    // Analyze potential issues
    if (totalCost > 50000) {
      warnings.push('High-value request requires additional scrutiny');
      suggestions.push('Prepare detailed justification documentation');
      predictions.push(
        'Approval process likely to take 3+ business days',
        'Additional financial review may be required'
      );
    }

    if (!request.items || request.items.length === 0) {
      warnings.push('Request contains no items');
      suggestions.push('Add at least one item to the request');
      predictions.push('Request will be rejected without items');
    }

    if (!request.purpose) {
      warnings.push('Purpose not specified');
      suggestions.push('Add a clear purpose description');
      predictions.push('Approval will be delayed without clear purpose');
    }

    // Time-based suggestions
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    if (currentHour > 16) { // After 4 PM
      suggestions.push('Consider submitting during business hours for faster processing');
      predictions.push('After-hours submissions typically processed next business day');
    }
    
    if (currentDay === 5) { // Friday
      suggestions.push('Requests submitted on Friday may not be processed until Monday');
      predictions.push('Weekend submissions often face delays');
    }

    // Contextual predictions
    if (isUrgent) {
      suggestions.push('Include clear emergency justification');
      predictions.push(
        'Urgent requests without clear justification may be downgraded',
        'Emergency approvals often require post-approval documentation'
      );
    }

    if (hasMandatoryApprovals) {
      suggestions.push('Follow up with mandatory approvers directly');
      predictions.push('Mandatory approval processes may take longer than standard approvals');
    }

    return {
      priority,
      score,
      warnings,
      suggestions,
      predictions
    };
  } catch (error) {
    console.error('Error analyzing request for predictions:', error);
    return {
      priority: 'medium',
      score: 50,
      warnings: ['Analysis encountered an error'],
      suggestions: ['Please review all inputs and try again'],
      predictions: ['System could not generate reliable predictions']
    };
  }
}

/**
 * Handles AppError and enhances it with predictive insights
 */
export async function enhanceErrorWithPredictions(
  error: AppError | Error | unknown,
  context: string
): Promise<{
  error: AppError;
  predictions: string[];
  suggestions: string[];
}> {
  // Convert to AppError if needed
  const appError = error instanceof AppError
    ? error
    : new AppError(
        error instanceof Error ? error.message : String(error),
        500,
        'error'
      );

  // Generate predictions based on error and context
  const { predictions, suggestions } = await predictErrors(context, null);

  return {
    error: appError,
    predictions,
    suggestions
  };
}
