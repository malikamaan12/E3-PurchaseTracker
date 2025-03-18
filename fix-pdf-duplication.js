import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzePdfIssueAndFixCode() {
  try {
    console.log('Starting PDF duplication issue analysis...');
    
    // Load the current PDF generator code
    const pdfFilePath = path.join(__dirname, 'client/src/lib/purchaseRequestPdf.ts');
    const currentCode = fs.readFileSync(pdfFilePath, 'utf8');
    
    console.log('Sending code to Anthropic for analysis...');
    
    // Use Anthropic to analyze the code and suggest fixes
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `I need help fixing a PDF generation code that has duplicate fields. The problem is that the requester, department, status, and priority fields appear twice in the generated PDF:

1. First in the header's requester info box (around lines 227-288)
2. Then again in the basic info table (around lines 465-516)

I need to modify the code to avoid this duplication. Please analyze the code and suggest specific changes to fix the issue. Focus on removing the four duplicated fields (requester, department, status, priority) from the basic info table while keeping them in the header info box.

Here's the current code:

\`\`\`typescript
${currentCode}
\`\`\`

Please provide me with the specific code changes needed to fix this duplication issue. Return your response in a structured way with:
1. A clear explanation of what's causing the duplication
2. The exact changes needed to fix the issue (which lines to modify or remove)
3. The new version of the addBasicInfoTable function with duplications removed
`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic API');
    }

    console.log('Analysis complete. Writing results to file...');
    
    // Write the analysis to a file
    const analysisFilePath = path.join(__dirname, 'pdf-duplication-analysis.txt');
    fs.writeFileSync(analysisFilePath, content.text);
    
    console.log(`Analysis saved to ${analysisFilePath}`);
    console.log('Now extracting the modified function to apply fixes...');
    
    // Extract the modified addBasicInfoTable function from the analysis
    let modifiedFunction = '';
    const matches = content.text.match(/```typescript\s*function addBasicInfoTable[\s\S]*?```/);
    
    if (matches && matches[0]) {
      modifiedFunction = matches[0]
        .replace(/```typescript/, '')
        .replace(/```$/, '')
        .trim();
      
      console.log('Successfully extracted modified function. Ready to apply fix.');
    } else {
      console.log('Could not extract modified function. Please check the analysis file.');
    }
    
    return {
      analysisPath: analysisFilePath,
      modifiedFunction: modifiedFunction
    };
  } catch (error) {
    console.error('Error analyzing PDF issue:', error);
    throw error;
  }
}

// Run the analysis immediately
analyzePdfIssueAndFixCode()
  .then(result => {
    console.log(`Analysis complete. Check ${result.analysisPath} for detailed results.`);
    if (result.modifiedFunction) {
      console.log('\nModified function:');
      console.log(result.modifiedFunction);
    }
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });

export { analyzePdfIssueAndFixCode };