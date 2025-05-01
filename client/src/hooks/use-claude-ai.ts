import { useState } from 'react';

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

interface RequestAnalysisResult {
  optimizationSuggestions: string[];
  costSavings: string;
  priorityScore: number;
  priorityReason: string;
}

interface VendorRecommendation {
  recommendedVendors: string[];
  reasonings: Record<string, string>;
}

interface AttachmentValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

interface ExecutiveSummaryResponse {
  summary: string;
}

interface UseClaudeAIReturn {
  // Request analysis
  analyzeRequest: (requestDetails: any) => Promise<RequestAnalysisResult>;
  requestAnalysisStatus: RequestStatus;
  requestAnalysisError: string | null;
  
  // Vendor recommendations
  recommendVendors: (requestDetails: any, vendorOptions: any[]) => Promise<VendorRecommendation>;
  vendorRecommendationStatus: RequestStatus;
  vendorRecommendationError: string | null;
  
  // Attachment validation
  validateAttachments: (attachmentData: any) => Promise<AttachmentValidation>;
  attachmentValidationStatus: RequestStatus;
  attachmentValidationError: string | null;
  
  // Executive summary
  generateExecutiveSummary: (requestData: any) => Promise<string>;
  executiveSummaryStatus: RequestStatus;
  executiveSummaryError: string | null;
}

/**
 * Hook for interacting with Claude AI endpoints
 * Provides methods for request analysis, vendor recommendations,
 * attachment validation, and executive summary generation
 */
export function useClaudeAI(): UseClaudeAIReturn {
  // Request analysis state
  const [requestAnalysisStatus, setRequestAnalysisStatus] = useState<RequestStatus>('idle');
  const [requestAnalysisError, setRequestAnalysisError] = useState<string | null>(null);
  
  // Vendor recommendation state
  const [vendorRecommendationStatus, setVendorRecommendationStatus] = useState<RequestStatus>('idle');
  const [vendorRecommendationError, setVendorRecommendationError] = useState<string | null>(null);
  
  // Attachment validation state
  const [attachmentValidationStatus, setAttachmentValidationStatus] = useState<RequestStatus>('idle');
  const [attachmentValidationError, setAttachmentValidationError] = useState<string | null>(null);
  
  // Executive summary state
  const [executiveSummaryStatus, setExecutiveSummaryStatus] = useState<RequestStatus>('idle');
  const [executiveSummaryError, setExecutiveSummaryError] = useState<string | null>(null);

  /**
   * Analyze purchase request details using Claude AI
   * @param requestDetails - Purchase request data to analyze
   */
  const analyzeRequest = async (requestDetails: any): Promise<RequestAnalysisResult> => {
    try {
      setRequestAnalysisStatus('loading');
      setRequestAnalysisError(null);
      
      const response = await fetch('/api/claude-ai/analyze-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestDetails }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze request');
      }
      
      const data = await response.json();
      setRequestAnalysisStatus('success');
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRequestAnalysisError(errorMessage);
      setRequestAnalysisStatus('error');
      return {
        optimizationSuggestions: [],
        costSavings: 'Unknown',
        priorityScore: 50,
        priorityReason: 'Unable to analyze at this time',
      };
    }
  };

  /**
   * Get vendor recommendations based on request details
   * @param requestDetails - Purchase request data
   * @param vendorOptions - Available vendor options
   */
  const recommendVendors = async (
    requestDetails: any,
    vendorOptions: any[]
  ): Promise<VendorRecommendation> => {
    try {
      setVendorRecommendationStatus('loading');
      setVendorRecommendationError(null);
      
      const response = await fetch('/api/claude-ai/recommend-vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestDetails, vendorOptions }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get vendor recommendations');
      }
      
      const data = await response.json();
      setVendorRecommendationStatus('success');
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setVendorRecommendationError(errorMessage);
      setVendorRecommendationStatus('error');
      return {
        recommendedVendors: [],
        reasonings: {},
      };
    }
  };

  /**
   * Validate attachments using Claude AI
   * @param attachmentData - Document data and metadata
   */
  const validateAttachments = async (attachmentData: any): Promise<AttachmentValidation> => {
    try {
      setAttachmentValidationStatus('loading');
      setAttachmentValidationError(null);
      
      const response = await fetch('/api/claude-ai/validate-attachments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attachmentData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to validate attachments');
      }
      
      const data = await response.json();
      setAttachmentValidationStatus('success');
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAttachmentValidationError(errorMessage);
      setAttachmentValidationStatus('error');
      return {
        isValid: true,
        issues: [],
        suggestions: ['Unable to validate attachments at this time'],
      };
    }
  };

  /**
   * Generate executive summary for purchase request
   * @param requestData - Full purchase request data
   */
  const generateExecutiveSummary = async (requestData: any): Promise<string> => {
    try {
      setExecutiveSummaryStatus('loading');
      setExecutiveSummaryError(null);
      
      const response = await fetch('/api/claude-ai/executive-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate executive summary');
      }
      
      const data: ExecutiveSummaryResponse = await response.json();
      setExecutiveSummaryStatus('success');
      return data.summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExecutiveSummaryError(errorMessage);
      setExecutiveSummaryStatus('error');
      return 'Unable to generate executive summary at this time';
    }
  };

  return {
    // Request analysis
    analyzeRequest,
    requestAnalysisStatus,
    requestAnalysisError,
    
    // Vendor recommendations
    recommendVendors,
    vendorRecommendationStatus,
    vendorRecommendationError,
    
    // Attachment validation
    validateAttachments,
    attachmentValidationStatus,
    attachmentValidationError,
    
    // Executive summary
    generateExecutiveSummary,
    executiveSummaryStatus,
    executiveSummaryError,
  };
}
