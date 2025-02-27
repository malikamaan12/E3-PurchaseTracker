import { type PurchaseRequestWithRelations } from '@db/schema';

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

    if (!request.items || request.items.length === 0) {
      warnings.push('Request contains no items');
      suggestions.push('Add at least one item to the request');
    }

    // Check for purpose - using optional chaining to prevent errors
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

    // Add missing approvals suggestions
    if (request.requiredApprovals?.length > 0 && request.approvals) {
      const pendingApprovals = request.requiredApprovals.filter(
        dept => !request.approvals?.some(a => a.department === dept)
      );

      if (pendingApprovals.length > 0) {
        warnings.push(`Waiting on approvals from: ${pendingApprovals.join(', ')}`);
        suggestions.push('Follow up with pending approval departments');
      }
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

// Function to predict potential errors based on user input or system state
export function predictPotentialErrors(context: string, currentState: any): string[] {
  const predictions: string[] = [];

  // Analyze context and current state to predict potential errors
  if (context === 'purchase-request') {
    if (!currentState.items || currentState.items.length === 0) {
      predictions.push('Request might be rejected due to missing items');
    }

    if (!currentState.purpose) {
      predictions.push('Purpose is required for request approval');
    }

    if (Number(currentState.totalEstimatedCost) > 10000 && !currentState.justification) {
      predictions.push('High-value requests require justification documentation');
    }
  } else if (context === 'approval-process') {
    if (!currentState.comments && currentState.status === 'rejected') {
      predictions.push('Comments are typically required when rejecting requests');
    }

    if (currentState.status === 'changes_requested' && !currentState.comments) {
      predictions.push('Specific change requests should be detailed in comments');
    }
  }

  return predictions;
}

// Function to generate suggestions based on current state
export function generateSmartSuggestions(context: string, currentState: any): string[] {
  const suggestions: string[] = [];

  if (context === 'purchase-request') {
    // Time-based suggestions
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    if (currentHour > 16) {
      suggestions.push('Consider submitting during business hours for faster processing');
    }

    if (currentDay === 5) { // Friday
      suggestions.push('Requests submitted on Friday may not be processed until Monday');
    }

    // Content-based suggestions
    if (currentState.items?.length > 0 && currentState.items.length < 3) {
      suggestions.push('Consider bundling related items to reduce approval complexity');
    }

    if (Number(currentState.totalEstimatedCost) > 1000) {
      suggestions.push('Attach quotes from multiple vendors for cost comparison');
    }
  }

  return suggestions;
}