import Anthropic from '@anthropic-ai/sdk';

// Use the Anthropic client for browser environment
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

/**
 * Analyzes export functionality issues using Anthropic's Claude AI
 * @param error The error object or message
 * @param context Additional context information
 * @returns Analysis of the export issue with recommended fixes
 */
export async function analyzeExportIssue(
  error: Error | unknown, 
  context: Record<string, any> = {}
): Promise<ExportAnalysisResult> {
  try {
    // Format the error for analysis
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...context
    };

    // Get analysis from Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analyze this export functionality error in our enterprise vendor management system. 
        The system should export purchase requests as PDF or ZIP but is encountering issues.

        Error Details:
        ${JSON.stringify(errorInfo, null, 2)}

        Please provide a detailed analysis in this exact JSON format:
        {
          "issue": {
            "type": "api" | "permissions" | "data_structure" | "file_generation" | "client_side" | "network" | "other",
            "description": "Clear description of the root issue",
            "severity": "critical" | "high" | "medium" | "low"
          },
          "technicalAnalysis": {
            "components": ["List of affected components/libraries"],
            "rootCause": "Technical explanation of the root cause",
            "affectedFiles": ["Likely affected files in the system"]
          },
          "fixes": {
            "immediate": ["List of immediate fixes that can be applied"],
            "preventive": ["List of preventive measures for the future"]
          },
          "codeSnippet": "Suggested code fix if applicable (otherwise empty string)"
        }`
      }]
    });

    // Extract and parse the analysis
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic API');
    }

    // Extract the JSON part from the response
    let jsonStr = content.text;
    if (content.text.includes('```json')) {
      jsonStr = content.text.split('```json')[1].split('```')[0].trim();
    } else if (content.text.includes('{') && content.text.includes('}')) {
      const startPos = content.text.indexOf('{');
      const endPos = content.text.lastIndexOf('}') + 1;
      if (startPos < endPos) {
        jsonStr = content.text.substring(startPos, endPos);
      }
    }
    
    // Clean up and parse the JSON
    const cleanedJsonStr = jsonStr
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
    
    return JSON.parse(cleanedJsonStr);
  } catch (analysisError) {
    console.error('Error analyzing export issue with AI:', analysisError);
    // Return a fallback analysis
    return {
      issue: {
        type: 'other',
        description: 'Error analysis failed - AI service unavailable',
        severity: 'medium'
      },
      technicalAnalysis: {
        components: ['exportUtils', 'pdfGenerator', 'anthropic-client'],
        rootCause: 'Unable to perform AI analysis of the error',
        affectedFiles: ['client/src/lib/exportUtils.ts', 'client/src/lib/pdfGenerator.ts']
      },
      fixes: {
        immediate: [
          'Check browser console for detailed error logs',
          'Verify export-related endpoints on the server',
          'Check if all required data is being passed correctly'
        ],
        preventive: [
          'Add better error logging for export functionality',
          'Create fallback export mechanisms'
        ]
      },
      codeSnippet: ''
    };
  }
}

/**
 * Analyzes bulk export functionality issues
 * @param filters The filters used for the export
 * @param error The error that occurred
 * @returns Analysis with possible fixes
 */
export async function analyzeBulkExportIssue(
  filters: Record<string, any>,
  error: Error | unknown
): Promise<ExportAnalysisResult> {
  // Call the main analyzer with bulk export specific context
  return analyzeExportIssue(error, { 
    operation: 'bulk_export',
    filters,
    component: 'BulkExportButton' 
  });
}

/**
 * Result of export functionality analysis
 */
export interface ExportAnalysisResult {
  issue: {
    type: 'api' | 'permissions' | 'data_structure' | 'file_generation' | 'client_side' | 'network' | 'other';
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
  technicalAnalysis: {
    components: string[];
    rootCause: string;
    affectedFiles: string[];
  };
  fixes: {
    immediate: string[];
    preventive: string[];
  };
  codeSnippet: string;
}