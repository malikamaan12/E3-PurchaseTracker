/**
 * Simplified service without AI dependency
 * Provides basic purchase request analysis functionality
 */
export class ClaudeAIService {
  /**
   * Analyzes purchase request details and provides optimization suggestions
   * @param requestDetails - Purchase request data to analyze
   */
  async analyzeRequest(requestDetails: any): Promise<{
    optimizationSuggestions: string[];
    costSavings: string;
    priorityScore: number;
    priorityReason: string;
  }> {
    console.log('Basic purchase request analysis for:', requestDetails.title || 'Untitled request');
    
    // Provide standard optimization suggestions based on request total cost
    const totalCost = requestDetails.totalEstimatedCost || 0;
    let suggestions = [];
    let costSavings = '5-10%';
    let priorityScore = 50;
    let priorityReason = 'Medium priority based on standard analysis';
    
    if (totalCost > 10000) {
      suggestions = [
        'Consider negotiating volume discounts',
        'Request competitive bids from multiple vendors',
        'Review delivery timeline for possible efficiency improvements'
      ];
      costSavings = '10-15%';
      priorityScore = 75;
      priorityReason = 'High priority due to significant financial impact';
    } else if (totalCost > 5000) {
      suggestions = [
        'Compare pricing with alternative vendors',
        'Consider bundling with other similar purchases',
        'Review specifications for potential simplification'
      ];
      costSavings = '5-10%';
      priorityScore = 60;
      priorityReason = 'Medium-high priority based on cost and business need';
    } else {
      suggestions = [
        'Use standard suppliers for faster processing',
        'Consider bulk ordering for future needs',
        'Evaluate if existing inventory can fulfill part of the request'
      ];
      costSavings = '3-5%';
      priorityScore = 40;
      priorityReason = 'Standard priority for routine procurement';
    }

    return {
      optimizationSuggestions: suggestions,
      costSavings,
      priorityScore,
      priorityReason,
    };
  }

  /**
   * Recommends vendors based on purchase request details
   * @param requestDetails - Purchase request details
   * @param vendorOptions - Available vendor options
   */
  async recommendVendors(requestDetails: any, vendorOptions: any[]): Promise<{
    recommendedVendors: string[];
    reasonings: Record<string, string>;
  }> {
    console.log('Basic vendor recommendation for:', requestDetails.title || 'Untitled request');
    
    // Sort vendors by most recently used or updated
    const sortedVendors = [...vendorOptions].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0);
      const dateB = new Date(b.updatedAt || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Take top 3 vendors
    const recommendedVendors = sortedVendors
      .slice(0, 3)
      .map(v => v.name || v.companyName);
    
    // Generate simple reasonings
    const reasonings: Record<string, string> = {};
    recommendedVendors.forEach(name => {
      reasonings[name] = 'Recommended based on previous purchase history and availability';
    });
    
    return {
      recommendedVendors,
      reasonings,
    };
  }

  /**
   * Provides basic attachment validation
   * @param attachmentData - File attachment metadata
   */
  async validateAttachments(attachmentData: any): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    console.log('Basic attachment validation');
    
    const issues: string[] = [];
    const suggestions = [
      'Ensure all files are in standard formats (PDF, DOCX, XLSX)',
      'Include all required documentation'
    ];
    
    // Simple validation based on file size and type
    if (Array.isArray(attachmentData)) {
      for (const attachment of attachmentData) {
        // Check for very large files
        if (attachment.fileSize && attachment.fileSize > 10000000) {
          issues.push(`File ${attachment.fileName} is very large (${Math.round(attachment.fileSize/1000000)}MB)`);
        }
        
        // Check for potentially risky file types
        if (attachment.fileName && /\.(exe|bat|cmd|sh|php|js)$/i.test(attachment.fileName)) {
          issues.push(`File ${attachment.fileName} has a potentially unsafe extension`);
        }
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Generates a basic executive summary for a purchase request
   * @param requestData - Complete request data with approvals and history
   */
  async generateExecutiveSummary(requestData: any): Promise<string> {
    console.log('Generating basic executive summary');
    
    const {
      title = 'Untitled Request',
      requestNumber = 'Unnumbered',
      totalEstimatedCost = 0,
      status = 'pending',
      purposeType = 'Unknown',
      createdAt = new Date().toISOString(),
      description = ''
    } = requestData;
    
    const date = new Date(createdAt).toLocaleDateString();
    const approvalStatus = requestData.approvals?.length > 0 ? 
      `${requestData.approvals.filter((a: any) => a.status === 'approved').length} approvals received` : 
      'Pending initial approvals';
    
    return `Executive Summary: ${title} (${requestNumber})
    
This ${purposeType} purchase request was submitted on ${date} with an estimated cost of ${totalEstimatedCost}. The request is currently ${status} with ${approvalStatus}.

${description ? `Purpose: ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}` : 'No detailed description provided.'}

Recommend standard procurement process and timeline be followed for this request.`;
  }

  // These simplified helper methods replace the AI parsing logic
  private extractOptimizationSuggestions(content: string): string[] {
    return [
      'Consider negotiating for volume discounts',
      'Review alternatives for cost efficiency'
    ];
  }

  private extractCostSavings(content: string): string {
    return '5-10%';
  }

  private extractPriorityInfo(content: string): { priorityScore: number; priorityReason: string } {
    return { 
      priorityScore: 50, 
      priorityReason: 'Based on standard analysis of request parameters' 
    };
  }

  private parseVendorRecommendations(content: string, vendorOptions: any[]): {
    recommendedVendors: string[];
    reasonings: Record<string, string>;
  } {
    const topVendors = vendorOptions
      .slice(0, 3)
      .map(v => v.name || v.companyName);
      
    const topReasonings: Record<string, string> = {};
    topVendors.forEach(name => {
      topReasonings[name] = 'Recommended based on availability';
    });
    
    return {
      recommendedVendors: topVendors,
      reasonings: topReasonings
    };
  }

  private parseAttachmentValidation(content: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    return { 
      isValid: true, 
      issues: [], 
      suggestions: [
        'Ensure all files are in standard formats',
        'Include all required documentation'
      ] 
    };
  }
}

export const claudeAIService = new ClaudeAIService();