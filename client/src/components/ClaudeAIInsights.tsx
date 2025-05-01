import { useState, useEffect } from 'react';
import { useClaudeAI } from '@/hooks/use-claude-ai';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, BarChart, Building, FileCheck, FileText } from 'lucide-react';

interface ClaudeAIInsightsProps {
  requestData: any;
  vendorOptions?: any[];
  attachmentData?: any;
  showExecutiveSummary?: boolean;
}

/**
 * Component for displaying Claude AI-generated insights about a purchase request
 */
export function ClaudeAIInsights({
  requestData,
  vendorOptions = [],
  attachmentData,
  showExecutiveSummary = false,
}: ClaudeAIInsightsProps) {
  const {
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
  } = useClaudeAI();
  
  // State for storing analysis results
  const [analysis, setAnalysis] = useState<{
    optimizationSuggestions: string[];
    costSavings: string;
    priorityScore: number;
    priorityReason: string;
  } | null>(null);
  
  // State for storing vendor recommendations
  const [vendorRecommendations, setVendorRecommendations] = useState<{
    recommendedVendors: string[];
    reasonings: Record<string, string>;
  } | null>(null);
  
  // State for storing attachment validation
  const [attachmentValidation, setAttachmentValidation] = useState<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } | null>(null);
  
  // State for storing executive summary
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  
  // Handler for analyzing request
  const handleAnalyzeRequest = async () => {
    if (!requestData) return;
    
    const result = await analyzeRequest(requestData);
    setAnalysis(result);
  };
  
  // Handler for getting vendor recommendations
  const handleRecommendVendors = async () => {
    if (!requestData || !vendorOptions || vendorOptions.length === 0) return;
    
    const result = await recommendVendors(requestData, vendorOptions);
    setVendorRecommendations(result);
  };
  
  // Handler for validating attachments
  const handleValidateAttachments = async () => {
    if (!attachmentData) return;
    
    const result = await validateAttachments(attachmentData);
    setAttachmentValidation(result);
  };
  
  // Handler for generating executive summary
  const handleGenerateExecutiveSummary = async () => {
    if (!requestData) return;
    
    const summary = await generateExecutiveSummary(requestData);
    setExecutiveSummary(summary);
  };
  
  // Function to render the request analysis section
  const renderRequestAnalysis = () => {
    if (requestAnalysisStatus === 'loading') {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Analyzing request...</span>
        </div>
      );
    }
    
    if (requestAnalysisStatus === 'error') {
      return (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {requestAnalysisError || 'Failed to analyze request'}
          </AlertDescription>
        </Alert>
      );
    }
    
    if (analysis) {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium">Priority Score</h4>
            <div className="mt-1 flex items-center">
              <div className="relative h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div 
                  className="absolute h-4 rounded-full bg-primary" 
                  style={{ width: `${analysis.priorityScore}%` }}
                />
              </div>
              <span className="ml-2 text-sm font-medium">{analysis.priorityScore}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {analysis.priorityReason}
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium">Potential Cost Savings</h4>
            <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
              {analysis.costSavings}
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium">Optimization Suggestions</h4>
            <ul className="mt-2 space-y-2">
              {analysis.optimizationSuggestions.map((suggestion, index) => (
                <li key={index} className="rounded-md bg-gray-50 p-2 text-sm dark:bg-gray-800">
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <BarChart className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-center text-sm text-gray-500">
          AI analysis can provide optimization suggestions, cost savings estimates, and
          priority recommendations for this request.
        </p>
        <Button onClick={handleAnalyzeRequest} className="mt-4">
          Analyze Request
        </Button>
      </div>
    );
  };
  
  // Function to render the vendor recommendations section
  const renderVendorRecommendations = () => {
    if (vendorRecommendationStatus === 'loading') {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Finding vendor recommendations...</span>
        </div>
      );
    }
    
    if (vendorRecommendationStatus === 'error') {
      return (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {vendorRecommendationError || 'Failed to get vendor recommendations'}
          </AlertDescription>
        </Alert>
      );
    }
    
    if (vendorRecommendations) {
      return (
        <div className="space-y-4">
          {vendorRecommendations.recommendedVendors.length > 0 ? (
            vendorRecommendations.recommendedVendors.map((vendor, index) => (
              <div key={index} className="rounded-md border p-4">
                <h4 className="font-medium">{vendor}</h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {vendorRecommendations.reasonings[vendor] || 'Recommended based on request details'}
                </p>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-gray-500">
              No vendor recommendations found. Try adjusting your request or adding more vendors.
            </p>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <Building className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-center text-sm text-gray-500">
          AI can recommend the most suitable vendors for this purchase request based on your requirements.
        </p>
        <Button 
          onClick={handleRecommendVendors} 
          className="mt-4"
          disabled={!vendorOptions || vendorOptions.length === 0}
        >
          Get Vendor Recommendations
        </Button>
        {(!vendorOptions || vendorOptions.length === 0) && (
          <p className="mt-2 text-xs text-gray-500">
            No vendor options available for analysis
          </p>
        )}
      </div>
    );
  };
  
  // Function to render the attachment validation section
  const renderAttachmentValidation = () => {
    if (attachmentValidationStatus === 'loading') {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Validating attachments...</span>
        </div>
      );
    }
    
    if (attachmentValidationStatus === 'error') {
      return (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {attachmentValidationError || 'Failed to validate attachments'}
          </AlertDescription>
        </Alert>
      );
    }
    
    if (attachmentValidation) {
      return (
        <div className="space-y-4">
          <div className="flex items-center">
            <Badge variant={attachmentValidation.isValid ? 'default' : 'destructive'}>
              {attachmentValidation.isValid ? 'Valid' : 'Issues Found'}
            </Badge>
          </div>
          
          {attachmentValidation.issues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium">Issues</h4>
              <ul className="mt-2 space-y-2">
                {attachmentValidation.issues.map((issue, index) => (
                  <li key={index} className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {attachmentValidation.suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium">Suggestions</h4>
              <ul className="mt-2 space-y-2">
                {attachmentValidation.suggestions.map((suggestion, index) => (
                  <li key={index} className="rounded-md bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <FileCheck className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-center text-sm text-gray-500">
          AI can validate your attachments for completeness and identify any potential issues.
        </p>
        <Button 
          onClick={handleValidateAttachments} 
          className="mt-4"
          disabled={!attachmentData}
        >
          Validate Attachments
        </Button>
        {!attachmentData && (
          <p className="mt-2 text-xs text-gray-500">
            No attachments available for validation
          </p>
        )}
      </div>
    );
  };
  
  // Function to render the executive summary section
  const renderExecutiveSummary = () => {
    if (executiveSummaryStatus === 'loading') {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Generating executive summary...</span>
        </div>
      );
    }
    
    if (executiveSummaryStatus === 'error') {
      return (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {executiveSummaryError || 'Failed to generate executive summary'}
          </AlertDescription>
        </Alert>
      );
    }
    
    if (executiveSummary) {
      return (
        <div className="space-y-4">
          <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-sm leading-relaxed">{executiveSummary}</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <FileText className="h-12 w-12 text-gray-400" />
        <p className="mt-2 text-center text-sm text-gray-500">
          AI can generate a concise executive summary for this purchase request,
          highlighting key business impacts and justifications.
        </p>
        <Button onClick={handleGenerateExecutiveSummary} className="mt-4">
          Generate Executive Summary
        </Button>
      </div>
    );
  };

  return (
    <Card className="bg-white dark:bg-gray-900">
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
        <CardDescription>
          Smart analysis and recommendations for this purchase request powered by Claude AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="analysis">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>
          <TabsContent value="analysis" className="min-h-[300px]">
            {renderRequestAnalysis()}
          </TabsContent>
          <TabsContent value="vendors" className="min-h-[300px]">
            {renderVendorRecommendations()}
          </TabsContent>
          <TabsContent value="attachments" className="min-h-[300px]">
            {renderAttachmentValidation()}
          </TabsContent>
        </Tabs>
        
        {showExecutiveSummary && (
          <>
            <Separator className="my-6" />
            <div>
              <h3 className="text-lg font-medium mb-4">Executive Summary</h3>
              {renderExecutiveSummary()}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between bg-gray-50 px-6 py-4 dark:bg-gray-800">
        <div className="flex items-center text-xs text-gray-500">
          <span>Powered by Claude AI</span>
        </div>
      </CardFooter>
    </Card>
  );
}
