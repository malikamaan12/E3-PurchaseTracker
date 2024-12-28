import { type PurchaseRequestWithRelations } from '@db/schema';

// Standard error analysis utility
export async function analyzeError(error: Error | string | unknown, context: string): Promise<string> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`Error in ${context}:`, {
    message: errorMessage,
    stack: errorStack,
  });

  return `An error occurred in ${context}. Please try again later.`;
}

// Standard analysis without AI
export async function analyzePurchaseRequest(request: PurchaseRequestWithRelations) {
  try {
    const totalCost = Number(request.totalEstimatedCost || 0);
    const hasMandatoryApprovals = request.approvals?.some(a => a.isMandatory);
    const isUrgent = request.priority === 'urgent';

    let priority: 'low' | 'medium' | 'high' | 'urgent';
    let score = 50; // Default medium score

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

    return {
      priority,
      reason: `Priority based on cost (${totalCost}), urgency (${isUrgent}), and approval requirements`,
      score,
      recommendations: [
        'Review request details thoroughly',
        'Check all required approvals',
        'Verify cost estimates'
      ]
    };
  } catch (error) {
    console.error('Error analyzing purchase request:', error);
    return {
      priority: 'medium',
      reason: 'Unable to analyze - using default priority',
      score: 50
    };
  }
}

// Simple UI component analysis without AI
export async function analyzeUIComponent(
  componentCode: string,
  errorDescription: string
): Promise<{
  issues: string[];
  recommendations: string[];
}> {
  const issues = [];
  const recommendations = [];

  // Basic error pattern matching
  if (errorDescription.toLowerCase().includes('undefined')) {
    issues.push('Possible null/undefined value access');
    recommendations.push('Add null checks before accessing properties');
  }

  if (errorDescription.toLowerCase().includes('type')) {
    issues.push('Type mismatch in component');
    recommendations.push('Verify prop types and event handler parameters');
  }

  // Add default recommendations if no specific issues found
  if (issues.length === 0) {
    issues.push('Manual review required');
    recommendations.push(
      'Check component props and types',
      'Verify event handlers',
      'Review component lifecycle'
    );
  }

  return { issues, recommendations };
}