/**
 * PDF Service Analysis Script
 * 
 * This script analyzes the PDF generation workflow and uses Anthropic Claude
 * to suggest improvements for the PDF generation process.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Analyze the PDF service and generation workflow
 */
async function analyzePdfService() {
  try {
    console.log('Starting PDF service analysis...');
    
    // Load the new PDF service code
    const serverServicePath = path.join(__dirname, 'server/services/PdfService.ts');
    const clientServicePath = path.join(__dirname, 'client/src/services/pdfService.ts');
    const analysisServicePath = path.join(__dirname, 'client/src/services/pdfAnalysisService.ts');
    
    const serverServiceCode = await fs.readFile(serverServicePath, 'utf8');
    const clientServiceCode = await fs.readFile(clientServicePath, 'utf8');
    const analysisServiceCode = await fs.readFile(analysisServicePath, 'utf8');
    
    console.log('Sending code to Anthropic for analysis...');
    
    // Use Anthropic to analyze the code
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `I've created a centralized PDF service for an enterprise vendor management system. Please analyze these services and suggest any improvements or issues to address:

1. Server-side PDF Service (handles database interactions and API endpoints):
\`\`\`typescript
${serverServiceCode}
\`\`\`

2. Client-side PDF Service (handles PDF generation and download):
\`\`\`typescript
${clientServiceCode}
\`\`\`

3. PDF Analysis Service (uses Anthropic for AI-powered analysis):
\`\`\`typescript
${analysisServiceCode}
\`\`\`

Key requirements:
- Maintain proper error handling and audit logging
- Ensure the PDF generation is consistent
- Make good use of Anthropic for error analysis
- Keep the code maintainable and well-structured
- Avoid duplication of logic

Please analyze the architecture and suggest improvements focused on code quality, error handling, and effective AI integration.
`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic API');
    }

    console.log('Analysis complete. Writing results to file...');
    
    // Write the analysis to a file
    const analysisFilePath = path.join(__dirname, 'pdf-service-analysis.txt');
    await fs.writeFile(analysisFilePath, content.text);
    
    console.log(`Analysis saved to ${analysisFilePath}`);
    
    // Extract key improvement suggestions
    const suggestions = [];
    const suggestionMatches = content.text.match(/(?:Improvement|Suggestion)(?:s)?[:\s]*([\s\S]*?)(?:\n\n|$)/gi);
    
    if (suggestionMatches) {
      for (const match of suggestionMatches) {
        const text = match.replace(/(?:Improvement|Suggestion)(?:s)?[:\s]*/i, '').trim();
        suggestions.push(text);
      }
    }
    
    return {
      analysisPath: analysisFilePath,
      suggestions
    };
  } catch (error) {
    console.error('Error analyzing PDF service:', error);
    throw error;
  }
}

// Run the analysis immediately
analyzePdfService()
  .then(result => {
    console.log(`Analysis complete. Check ${result.analysisPath} for detailed results.`);
    
    if (result.suggestions.length > 0) {
      console.log('\nKey improvement suggestions:');
      result.suggestions.forEach((suggestion, index) => {
        console.log(`${index + 1}. ${suggestion}`);
      });
    }
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });

export { analyzePdfService };