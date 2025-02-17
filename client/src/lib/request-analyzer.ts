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
