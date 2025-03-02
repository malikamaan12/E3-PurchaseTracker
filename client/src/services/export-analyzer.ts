import Anthropic from '@anthropic-ai/sdk';

// Use the Anthropic client for browser environment
let anthropic: Anthropic | null = null;

// Lazy initialization of the Anthropic client
function getAnthropicClient(): Anthropic | null {
  if (anthropic) return anthropic;
  
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('Anthropic API key is not set in environment variables');
    return null;
  }
  
  try {
    anthropic = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true
    });
    return anthropic;
  } catch (error) {
    console.error('Failed to initialize Anthropic client:', error);
    return null;
  }
}

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
    // Get the client (lazy initialization)
    const client = getAnthropicClient();
    if (!client) {
      throw new Error('Anthropic client unavailable - API key might be missing');
    }

    // Format the error for analysis
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack?.split('\n').slice(0, 5).join('\n') || '') : '',
      timestamp: new Date().toISOString(),
      ...context
    };

    console.log('Analyzing export error with Claude:', 
      JSON.stringify({
        message: errorInfo.message,
        operation: context.operation || 'unknown',
        timestamp: errorInfo.timestamp
      })
    );

    // Get analysis from Claude
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `Analyze this export functionality error in our enterprise vendor management system. 
        The system should export purchase requests as PDF or ZIP but is encountering issues.

        Error Details:
        ${JSON.stringify(errorInfo, null, 2)}

        Additional Technical Context:
        - The system uses fetch API to get data from server endpoints
        - Client uses exportRequestToPDF/exportRequestAsZip for file generation
        - Server routes: /api/requests/:id/pdf, /api/requests/:id/zip, /api/requests/export/bulk
        - Common issues include: missing data, incorrect query parameters, missing auth, file format issues

        Please provide a detailed analysis in this exact JSON format (no explanation or additional text):
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
    } else if (content.text.includes('```')) {
      const matches = content.text.match(/```(?:json)?([\s\S]*?)```/);
      if (matches && matches[1]) {
        jsonStr = matches[1].trim();
      }
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
    
    try {
      const result = JSON.parse(cleanedJsonStr);
      console.log('Successfully analyzed export issue with AI');
      return result;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw response:', jsonStr);
      throw new Error('Invalid response format from AI analysis');
    }
  } catch (analysisError) {
    console.error('Error analyzing export issue with AI:', analysisError);
    
    // Generate a context-aware fallback analysis
    const errorMessage = error instanceof Error ? error.message : String(error);
    const operation = context.operation || 'export';
    
    // Determine likely issue type based on error message
    let issueType: 'api' | 'permissions' | 'data_structure' | 'file_generation' | 'client_side' | 'network' | 'other' = 'other';
    let description = 'Export operation failed';
    let components = ['exportUtils'];
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    
    if (errorMessage.includes('permission') || errorMessage.includes('unauthoriz')) {
      issueType = 'permissions';
      description = 'Permission or authorization issue when accessing export endpoint';
      severity = 'high';
    } else if (errorMessage.includes('format') || errorMessage.includes('invalid') || errorMessage.includes('data')) {
      issueType = 'data_structure';
      description = 'Data format or structure issue in the export process';
      severity = 'medium';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('cors')) {
      issueType = 'network';
      description = 'Network error when trying to retrieve data for export';
      severity = 'high';
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      issueType = 'api';
      description = 'API endpoint not found or incorrectly specified';
      severity = 'high';
    } else if (errorMessage.includes('generate') || errorMessage.includes('pdf') || errorMessage.includes('zip')) {
      issueType = 'file_generation';
      description = 'Error generating the export file';
      severity = 'medium';
    }
    
    // Add component-specific data
    if (operation === 'pdf_export') {
      components.push('pdfGenerator');
    } else if (operation === 'zip_export') {
      components.push('jszip');
    } else if (operation === 'bulk_export') {
      components.push('bulkExportButton');
    }
    
    // Return a tailored fallback analysis
    return {
      issue: {
        type: issueType,
        description: description,
        severity: severity
      },
      technicalAnalysis: {
        components: components,
        rootCause: `Export error: ${errorMessage}`,
        affectedFiles: [
          'client/src/lib/exportUtils.ts', 
          'client/src/lib/pdfGenerator.ts',
          'client/src/components/DownloadOptions.tsx',
          'client/src/components/BulkExportButton.tsx'
        ]
      },
      fixes: {
        immediate: [
          'Check browser console for detailed error logs',
          'Verify the export endpoint URL and parameters',
          'Check if user has correct permissions for export',
          'Verify the request data format'
        ],
        preventive: [
          'Add better error logging for export functionality',
          'Implement fallback export methods',
          'Add retry mechanism for network failures',
          'Create more robust parameter validation'
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