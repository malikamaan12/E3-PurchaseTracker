import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeExportIssue() {
  console.log('Analyzing export issue with Claude...');
  
  // Gather context for analysis
  const clientValidation = `
  // Client-side validation (in DownloadOptions.tsx):
  if (request?.id) {
    // Make sure we have a clean integer
    const idStr = String(request.id).trim();
    const parsedId = parseInt(idStr, 10);
    
    // Only use if it's a valid positive integer that exactly matches the input
    if (!isNaN(parsedId) && parsedId > 0 && String(parsedId) === idStr) {
      requestId = parsedId;
      console.log(\`Valid request ID for Excel export: \${requestId}\`);
    } else {
      console.warn(\`Invalid request ID format for Excel: \${idStr}, parsed as: \${parsedId}\`);
    }
  }
  `;
  
  const serverValidation = `
  // Server-side validation in GET /api/requests/export:
  if (req.query.id && req.query.id !== 'undefined' && req.query.id !== 'null') {
    // Use more helpful logging
    console.log(\`[GET /api/requests/export] Parsing ID parameter: "\${req.query.id}" (type: \${typeof req.query.id})\`);
    
    // Convert to string and trim whitespace (handles undefined/null conversion safely)
    const idString = String(req.query.id).trim();
    
    // Special case for diagnostic ID or test ID
    if (idString === '999999') {
      requestId = 999999;
      console.log(\`[GET /api/requests/export] Using special diagnostic ID: \${requestId}\`);
    } 
    // Support other special IDs if needed in the future
    else if (idString === '000000') {
      requestId = 0; // Special case for system-wide export
      console.log(\`[GET /api/requests/export] Using system-wide export ID: \${requestId}\`);
    }
    else {
      // Try to parse as integer with more flexible validation
      try {
        const idValue = parseInt(idString, 10);
        
        // Only set requestId if it's a valid positive number
        if (!isNaN(idValue) && idValue > 0) {
          requestId = idValue;
          console.log(\`[GET /api/requests/export] Valid request ID: \${requestId}\`);
        } else {
          console.log(\`[GET /api/requests/export] Invalid request ID format: "\${idString}", parsed as: \${idValue}\`);
          throw new ValidationError('Invalid request ID', { id: 'Must be a positive number' });
        }
      } catch (parseError) {
        console.log(\`[GET /api/requests/export] Error parsing ID: "\${idString}", error:\`, parseError);
        throw new ValidationError('Invalid request ID', { id: 'Must be a valid number' });
      }
    }
  } else {
    // If no ID provided or it's 'undefined'/'null', we'll export all requests
    console.log('[GET /api/requests/export] No valid ID parameter provided, exporting all requests');
    requestId = null;
  }
  `;
  
  const exportAuditUtils = `
  export function validateResourceId(resourceId: number | string | null | undefined): number | null {
    if (resourceId === null || resourceId === undefined) {
      console.warn('Export validation: Resource ID is null or undefined');
      return null;
    }
  
    // Handle special diagnostic ID
    if (resourceId === DIAGNOSTIC_ID || resourceId === \`\${DIAGNOSTIC_ID}\`) {
      console.log('Export validation: Using diagnostic ID');
      return DIAGNOSTIC_ID;
    }
  
    // Convert to number if string
    const parsedId = typeof resourceId === 'string' ? parseInt(resourceId.trim(), 10) : resourceId;
    
    // Check if valid number
    if (isNaN(Number(parsedId))) {
      console.warn(\`Export validation: Invalid resource ID '\${resourceId}' is not a number\`);
      return null;
    }
    
    // Check if positive number (including special IDs)
    if (Number(parsedId) <= 0 && !SPECIAL_IDS.includes(Number(parsedId))) {
      console.warn(\`Export validation: Resource ID must be positive (got \${parsedId})\`);
      return null;
    }
    
    return Number(parsedId);
  }
  `;
  
  const errorLogs = `
  Console logs when error occurs:
  ["Valid request ID for Excel export: 168"]
  ["Direct Excel export URL: /api/requests/export?id=168&format=xlsx for request ID: 168"]
  ["Tracking excel view for request ID: 168"]
  ["Logging Excel export for resource ID: 168"]
  ["Logging export audit: excel for ID 168"]
  
  Server error:
  ValidationError: Invalid request ID
  details: { id: 'Must be a number' }
  GET /api/requests/export 400 in 233ms
  `;
  
  const message = `
You are an expert in JavaScript and TypeScript development. Please analyze this issue with our export functionality:

We're having a problem with our Excel and CSV exports failing with "Invalid request ID" errors despite the IDs passing validation tests on the client side.

When a user clicks to export a request to Excel with ID 168, the client performs validation that passes, but the server-side validation fails with "Invalid request ID" and "Must be a number" error.

Here's the client-side validation:
${clientValidation}

Here's the server-side validation:
${serverValidation}

Here's our export utility validation:
${exportAuditUtils}

Here are the console and error logs:
${errorLogs}

Based on this information:
1. What is causing the inconsistency between client and server validation?
2. What specifically is wrong with the ID validation on the server side?
3. Can you provide a precise fix for the code to make exports work correctly?

I need a detailed technical analysis and specific code changes needed to fix the issue.
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.1,
    });
    
    console.log('\n\nClaude Analysis:');
    console.log('==========================================');
    console.log(response.content[0].text);
    
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
  }
}

// Run the analysis
analyzeExportIssue();