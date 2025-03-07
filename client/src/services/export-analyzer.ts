import Anthropic from '@anthropic-ai/sdk';

// Use the Anthropic client for browser environment
let anthropic: Anthropic | null = null;

/**
 * Specialized function to analyze and fix CSV/Excel export issues
 * This uses Claude to analyze the byte patterns and recommend encoding-specific fixes
 */
export async function analyzeAndFixCSVExportIssue(
  errorContext: {
    format: 'csv' | 'excel' | 'xlsx';
    sampleData?: string;
    errorMessage?: string;
    exportType?: string;
  }
): Promise<{
  fixedEncoding: string;
  recommendations: string[];
  fixedCode?: string;
}> {
  try {
    const client = getAnthropicClient();
    if (!client) {
      throw new Error('Anthropic client unavailable - API key might be missing');
    }
    
    const format = errorContext.format;
    
    // Create a detailed prompt specific to the CSV/Excel encoding issues
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `You are a specialized CSV/Excel encoding expert. Our enterprise application has persistent issues with ${format.toUpperCase()} exports. 
        When users try to download ${format.toUpperCase()} files, they encounter encoding issues, incorrect formatting, or corruption.
        
        Format: ${format}
        Error: ${errorContext.errorMessage || 'Unknown encoding/formatting issue'}
        Export Type: ${errorContext.exportType || 'General data export'}
        
        ${errorContext.sampleData ? `Sample Data: ${errorContext.sampleData.substring(0, 500)}...` : ''}
        
        Technical Context:
        - We use Blob object with appropriate MIME types to create downloadable files
        - We're currently using BOM for UTF-8 encoding (Uint8Array([0xEF, 0xBB, 0xBF]))
        - For Excel exports, we use xlsx library (SheetJS)
        - We have several export types: basic, items, approvals, all
        - We wrap CSV values in quotes and escape internal quotes with double quotes
        
        Please provide a comprehensive analysis and solution in this exact JSON format:
        {
          "diagnosis": "Detailed explanation of what's likely causing the encoding/format issues",
          "fixedEncoding": "The correct encoding/approach to use (e.g., 'UTF-8 with BOM', 'UTF-16LE', etc.)",
          "recommendations": [
            "List of specific recommendations to fix the issues"
          ],
          "fixedCode": "If applicable, a code snippet showing the correct implementation"
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
      console.log('Successfully analyzed CSV/Excel export issue with AI');
      return {
        fixedEncoding: result.fixedEncoding,
        recommendations: result.recommendations,
        fixedCode: result.fixedCode
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw response:', jsonStr);
      throw new Error('Invalid response format from AI analysis');
    }
  } catch (error) {
    console.error('Error analyzing CSV/Excel export issue with AI:', error);
    return {
      fixedEncoding: 'UTF-8 with BOM',
      recommendations: [
        "Ensure all CSV strings are properly wrapped in quotes", 
        "Add UTF-8 BOM header (0xEF, 0xBB, 0xBF) to the CSV data",
        "Set the correct MIME type for downloads: text/csv;charset=utf-8",
        "For Excel, ensure column widths are properly set for better display",
        "Consider using the FileSaver.js library for more reliable file downloads"
      ]
    };
  }
}

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
 * Analyzes vendor-related export functionality issues
 * @param vendor The vendor data that was being exported
 * @param exportType The type of export being performed (pdf, zip, etc)
 * @param error The error that occurred
 * @returns Analysis with possible fixes
 */
export async function analyzeVendorExportIssue(
  vendor: Record<string, any>,
  exportType: 'pdf' | 'zip' | 'csv' | 'json',
  error: Error | unknown
): Promise<ExportAnalysisResult> {
  // Extract key vendor details for the analysis
  const vendorContext = {
    id: vendor.id,
    name: vendor.companyName || vendor.name,
    hasAttachments: Boolean(vendor.attachments?.length),
    dataFields: Object.keys(vendor).length,
    hasNullFields: Object.values(vendor).some(val => val === null),
    exportType
  };
  
  // Call the main analyzer with vendor export specific context
  return analyzeExportIssue(error, {
    operation: 'vendor_export',
    vendor: vendorContext,
    component: 'VendorExport',
    exportType
  });
}

/**
 * Diagnoses common export errors without calling AI API
 * Use this for faster, less-detailed diagnostics when AI analysis isn't required
 * 
 * @param error The error that occurred
 * @param context Optional context about the export operation
 * @returns A simple diagnostic result
 */
export function quickDiagnoseExportError(
  error: Error | unknown,
  context: {
    operation?: string;
    component?: string;
    entityType?: 'request' | 'vendor' | 'user' | 'report';
    dataSize?: number;
  } = {}
): {
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  possibleFixes: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const operation = context.operation || 'export';
  const component = context.component || 'unknown';
  
  // Default response
  let result = {
    message: `Failed to ${operation} data`,
    severity: 'medium' as const,
    possibleFixes: [
      'Try again later',
      'Check your network connection',
      'Verify that you have permission to export this data'
    ]
  };
  
  // Network errors
  if (
    errorMessage.includes('network') || 
    errorMessage.includes('connection') ||
    errorMessage.includes('offline') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('CORS')
  ) {
    result = {
      message: 'Network error while preparing export data',
      severity: 'medium',
      possibleFixes: [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact IT if the problem persists'
      ]
    };
  }
  
  // Authentication/permission errors
  else if (
    errorMessage.includes('authentication') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('permission') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403')
  ) {
    result = {
      message: 'You don\'t have permission to export this data',
      severity: 'medium',
      possibleFixes: [
        'Log out and log back in',
        'Contact your administrator for appropriate permissions',
        'Try exporting a smaller dataset if applicable'
      ]
    };
  }
  
  // Data format errors
  else if (
    errorMessage.includes('format') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('malformed') ||
    errorMessage.includes('parse') ||
    errorMessage.includes('schema')
  ) {
    result = {
      message: 'The data format is invalid or incompatible with the export format',
      severity: 'medium',
      possibleFixes: [
        'Try exporting in a different format',
        'Check if the data contains special characters or invalid values',
        'Contact support if the issue persists'
      ]
    };
  }
  
  // Size/resource errors
  else if (
    errorMessage.includes('size') ||
    errorMessage.includes('memory') ||
    errorMessage.includes('large') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('exceeded')
  ) {
    result = {
      message: 'The export data is too large to process',
      severity: 'medium',
      possibleFixes: [
        'Try exporting a smaller subset of data',
        'Use filters to reduce the dataset size',
        'Try a different export format (CSV instead of PDF)'
      ]
    };
  }
  
  // Not found errors
  else if (
    errorMessage.includes('not found') ||
    errorMessage.includes('404') ||
    errorMessage.includes('missing')
  ) {
    result = {
      message: 'The requested data could not be found',
      severity: 'medium',
      possibleFixes: [
        'Check if the data has been deleted or moved',
        'Refresh the page to update the data',
        'Try navigating back to the main page and try again'
      ]
    };
  }
  
  // File generation errors
  else if (
    errorMessage.includes('generate') ||
    errorMessage.includes('creation') ||
    errorMessage.includes('render') ||
    errorMessage.includes('write')
  ) {
    result = {
      message: 'Failed to generate the export file',
      severity: 'medium',
      possibleFixes: [
        'Try a different export format',
        'Check if your browser allows file downloads',
        'Try using a different browser'
      ]
    };
  }

  // Add context-specific suggestions
  if (context.dataSize && context.dataSize > 100) {
    result.possibleFixes.push('Try exporting smaller batches of data');
  }
  
  if (context.entityType === 'vendor') {
    result.possibleFixes.push('Verify that the vendor data is complete');
  }
  
  return result;
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