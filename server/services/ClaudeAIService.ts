import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025

export class ClaudeAIService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

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
    try {
      const prompt = `
        As a procurement analyst, review this purchase request and provide:
        1. At least 2-3 optimization suggestions to improve cost efficiency
        2. Potential cost savings as a percentage
        3. Priority score (1-100) with reasoning

        Purchase request details:
        ${JSON.stringify(requestDetails, null, 2)}
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }
      const content = contentBlock.text;
      
      // Parse response to extract insights
      const optimizationSuggestions = this.extractOptimizationSuggestions(content);
      const costSavings = this.extractCostSavings(content);
      const { priorityScore, priorityReason } = this.extractPriorityInfo(content);

      return {
        optimizationSuggestions,
        costSavings,
        priorityScore,
        priorityReason,
      };
    } catch (error) {
      console.error('Error analyzing purchase request with Claude:', error);
      return {
        optimizationSuggestions: [],
        costSavings: 'Unknown',
        priorityScore: 50,
        priorityReason: 'Unable to analyze with AI at this time',
      };
    }
  }

  /**
   * Analyzes potential vendors for a request and recommends the best options
   * @param requestDetails - Purchase request details
   * @param vendorOptions - Available vendor options
   */
  async recommendVendors(requestDetails: any, vendorOptions: any[]): Promise<{
    recommendedVendors: string[];
    reasonings: Record<string, string>;
  }> {
    try {
      const prompt = `
        As a vendor selection specialist, analyze this purchase request and available vendors.
        Recommend the top 3 vendors that would be best suited for this request and provide
        brief reasoning for each recommendation.

        Purchase request details:
        ${JSON.stringify(requestDetails, null, 2)}

        Available vendors:
        ${JSON.stringify(vendorOptions, null, 2)}
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }
      const content = contentBlock.text;
      return this.parseVendorRecommendations(content, vendorOptions);
    } catch (error) {
      console.error('Error recommending vendors with Claude:', error);
      return {
        recommendedVendors: [],
        reasonings: {},
      };
    }
  }

  /**
   * Validates attachments by analyzing their content 
   * @param attachmentData - Document data and metadata
   */
  async validateAttachments(attachmentData: any): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const prompt = `
        As a document validation specialist, review this attachment data for a purchase request.
        Check for completeness, accuracy, and any potential issues or red flags.
        Provide a list of any issues found and suggestions for improvement.

        Attachment data:
        ${JSON.stringify(attachmentData, null, 2)}
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }
      const content = contentBlock.text;
      return this.parseAttachmentValidation(content);
    } catch (error) {
      console.error('Error validating attachments with Claude:', error);
      return {
        isValid: true, // Default to valid if analysis fails
        issues: [],
        suggestions: ['Unable to analyze attachment at this time'],
      };
    }
  }

  /**
   * Summarizes purchase request content for executives
   * @param requestData - Full purchase request data
   */
  async generateExecutiveSummary(requestData: any): Promise<string> {
    try {
      const prompt = `
        Generate a concise executive summary (max 250 words) of this purchase request.
        Focus on business impact, cost justification, and alignment with organization goals.
        Use professional, executive-level language.

        Purchase request data:
        ${JSON.stringify(requestData, null, 2)}
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }
      return contentBlock.text.trim();
    } catch (error) {
      console.error('Error generating executive summary with Claude:', error);
      return 'Executive summary generation failed. Please review the complete request details.';
    }
  }

  // Helper methods to parse Claude responses

  private extractOptimizationSuggestions(content: string): string[] {
    try {
      // Look for numbered suggestions in the response
      const regex = /\d\.\s+(.*?)(?=\d\.\s+|$)/g;
      const matches = Array.from(content.match(regex) || []);
      
      if (matches && matches.length > 0) {
        return matches.map(match => match.trim());
      }
      
      // Fallback: split by newlines and look for suggestions
      const lines = content.split('\n');
      const suggestions = lines.filter(line => 
        line.includes('suggestion') || 
        line.includes('recommend') || 
        line.includes('optimize')
      ).map(line => line.trim());
      
      return suggestions.slice(0, 3);
    } catch (error) {
      console.error('Error extracting optimization suggestions:', error);
      return [];
    }
  }

  private extractCostSavings(content: string): string {
    try {
      // Look for percentage patterns
      const percentageRegex = /(\d+(?:\.\d+)?)\s*%\s*(?:cost savings|savings|reduction)/i;
      const percentageMatch = content.match(percentageRegex);
      
      if (percentageMatch) {
        return percentageMatch[0];
      }
      
      // Look for statements about cost savings
      const savingsRegex = /(?:savings|reduce costs|cost reduction)\s+(?:of|by)\s+(\d+(?:\.\d+)?)\s*%/i;
      const savingsMatch = content.match(savingsRegex);
      
      if (savingsMatch) {
        return `${savingsMatch[1]}%`;
      }
      
      return 'Unknown';
    } catch (error) {
      console.error('Error extracting cost savings:', error);
      return 'Unknown';
    }
  }

  private extractPriorityInfo(content: string): { priorityScore: number; priorityReason: string } {
    try {
      // Extract priority score
      const scoreRegex = /priority\s+(?:score|rating|level)?:?\s*(\d+)/i;
      const scoreMatch = content.match(scoreRegex);
      let priorityScore = 50; // Default
      
      if (scoreMatch) {
        const extracted = parseInt(scoreMatch[1], 10);
        priorityScore = isNaN(extracted) ? 50 : Math.min(100, Math.max(1, extracted));
      }
      
      // Extract reason
      let priorityReason = '';
      const reasonRegex = /(?:priority\s+reason|reason\s+for\s+priority|reasoning):?\s+(.+?)(?=\n\n|$)/i;
      const reasonMatch = content.match(reasonRegex);
      
      if (reasonMatch) {
        priorityReason = reasonMatch[1].trim();
      } else {
        // Look for the sentence after priority score
        const sentenceRegex = new RegExp(`priority\s+(?:score|rating|level)?:?\s*${priorityScore}\s*\.?\s+(.+?)(?=\n|$)`, 'i');
        const sentenceMatch = content.match(sentenceRegex);
        
        if (sentenceMatch) {
          priorityReason = sentenceMatch[1].trim();
        } else {
          priorityReason = 'Based on overall assessment of request details';
        }
      }
      
      return { priorityScore, priorityReason };
    } catch (error) {
      console.error('Error extracting priority info:', error);
      return { priorityScore: 50, priorityReason: 'Based on AI analysis' };
    }
  }

  private parseVendorRecommendations(content: string, vendorOptions: any[]): {
    recommendedVendors: string[];
    reasonings: Record<string, string>;
  } {
    try {
      const vendorNames = vendorOptions.map(v => v.companyName || v.name || '').filter(Boolean);
      const reasonings: Record<string, string> = {};
      const recommendedVendors: string[] = [];
      
      // Extract vendor names mentioned in the content
      for (const vendor of vendorNames) {
        if (content.includes(vendor)) {
          recommendedVendors.push(vendor);
          
          // Try to extract reasoning for this vendor
          const reasonRegex = new RegExp(`${vendor}[^\n.]*?:[^\n.]*?([^\n.]+)`, 'i');
          const reasonMatch = content.match(reasonRegex);
          
          if (reasonMatch) {
            reasonings[vendor] = reasonMatch[1].trim();
          } else {
            // Try to find the sentence containing the vendor name
            const sentences = content.split(/[.\n]/);
            const relevantSentence = sentences.find(s => s.includes(vendor));
            
            if (relevantSentence) {
              reasonings[vendor] = relevantSentence.trim();
            } else {
              reasonings[vendor] = 'Recommended based on requirements match';
            }
          }
        }
      }
      
      // Limit to top 3
      const topVendors = recommendedVendors.slice(0, 3);
      const topReasonings: Record<string, string> = {};
      
      for (const vendor of topVendors) {
        topReasonings[vendor] = reasonings[vendor];
      }
      
      return {
        recommendedVendors: topVendors,
        reasonings: topReasonings
      };
    } catch (error) {
      console.error('Error parsing vendor recommendations:', error);
      return { recommendedVendors: [], reasonings: {} };
    }
  }

  private parseAttachmentValidation(content: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    try {
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // Check for explicit invalidity statements
      const isInvalid = /\b(?:invalid|incomplete|missing|inadequate|insufficient|problem|issue|error)\b/i.test(content);
      
      // Extract issues
      const issuesMatch = content.match(/(?:issues|problems|concerns):\s*(.+?)(?=\n\n|$)/i);
      if (issuesMatch) {
        const issuesText = issuesMatch[1];
        const issuesList = issuesText.split(/\n-|\n\d+\./).filter(Boolean).map(i => i.trim());
        issues.push(...issuesList);
      }
      
      // Extract suggestions
      const suggestionsMatch = content.match(/(?:suggestions|recommendations|improvements):\s*(.+?)(?=\n\n|$)/i);
      if (suggestionsMatch) {
        const suggestionsText = suggestionsMatch[1];
        const suggestionsList = suggestionsText.split(/\n-|\n\d+\./).filter(Boolean).map(s => s.trim());
        suggestions.push(...suggestionsList);
      }
      
      return {
        isValid: !isInvalid && issues.length === 0,
        issues: issues.length > 0 ? issues : [],
        suggestions: suggestions.length > 0 ? suggestions : []
      };
    } catch (error) {
      console.error('Error parsing attachment validation:', error);
      return { isValid: true, issues: [], suggestions: [] };
    }
  }
}

export const claudeAIService = new ClaudeAIService();
