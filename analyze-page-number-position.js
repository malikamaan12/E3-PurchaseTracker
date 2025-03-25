/**
 * PDF Page Number Position Analysis and Fix
 * 
 * This script analyzes the page number positioning implementation
 * in our PDF generation code and identifies potential issues.
 * 
 * It uses Anthropic Claude to analyze the code flow and suggest fixes.
 */

import { Anthropic } from '@anthropic-ai/sdk';

async function analyzePdfPositioningIssue() {
  console.log("Analyzing PDF page number positioning issue...");
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "key-not-set"
  });
  
  // First, collect the analysis context
  const analysisContext = {
    issue: "PDF page number position is stuck in the middle regardless of setting",
    dbSchema: "Page number position is stored in database as 'page_number_position' with valid enum values",
    validationSchema: "We validate the position using z.enum with 6 valid positions",
    uiComponent: "User can select from a dropdown with 6 valid positions",
    pdfGenerator: "Both pdfGenerator.ts and enhancedPdfGenerator.ts implement the 6 positions",
    flowTrace: [
      "UI selects position → PDFSettingsPanel → handleChange → PDFSettingsWithPreview",
      "PDFSettingsWithPreview → pdfService.savePdfSettings → API call to server",
      "server/services/PdfService.ts → savePdfSettings → database",
      "PDF generation reads from database → applies position",
      "Debug logs show the correct position being selected and saved"
    ],
    currentBehavior: "Despite selecting different positions, the page number always renders in the middle"
  };
  
  // Prepare a detailed prompt that focuses on the specific issue
  const analysisPrompt = `
I need help diagnosing and fixing a PDF page number positioning issue in our application.

## Issue Description
The page number in generated PDFs is always positioned in the middle of the page, regardless of the position setting selected by the user.

## Current Implementation
1. We have a dropdown in PDFSettingsPanel.tsx allowing selection of 6 positions:
   - top-left, top-center, top-right
   - bottom-left, bottom-center, bottom-right

2. The position is stored in the database table 'pdf_settings' with column 'page_number_position'
   - Default value: 'bottom-right'
   - Database schema and validation are correct

3. The PDF generator implementation:
   - enhancedPdfGenerator.ts has a switch statement for the 6 positions
   - The code should position the page number based on the selected position
   - Our debug logs show the correct position value is being passed to the generator

## Debug Findings
- Position value correctly selected in UI
- Position value correctly saved to database
- Position value correctly loaded when generating PDF
- Position value appears in debug logs with correct value
- Switch statement in the PDF generator reads the position
- Despite this, the page number always appears in the middle position

## Analysis Context
${JSON.stringify(analysisContext, null, 2)}

## Code Snippets
In enhancedPdfGenerator.ts:
\`\`\`
// Add page numbers based on position setting
if (pdfSettings?.pageNumbering !== false) {
  doc.setFontSize(8);
  doc.setTextColor(textDisplay[0] * 255, textDisplay[1] * 255, textDisplay[2] * 255);
  
  const pageNumberText = \`Page \${currentPage} of \${totalPages}\`;
  const position = pdfSettings?.pageNumberPosition || 'bottom-right';
  
  // Enhanced debug log for page number position
  console.log('PDF Page Number Position Settings (Enhanced Generator):', {
    position,
    pageNumbering: pdfSettings?.pageNumbering,
    rawSettings: pdfSettings,
    isPositionValid: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(position)
  });
  
  // Position based on the setting
  switch (position) {
    case 'top-left':
      doc.text(pageNumberText, margin, 10);
      break;
    case 'top-center':
      doc.text(pageNumberText, pageWidth / 2, 10, { align: 'center' });
      break;
    case 'top-right':
      doc.text(pageNumberText, pageWidth - margin, 10, { align: 'right' });
      break;
    case 'bottom-left':
      doc.text(pageNumberText, margin, footerY + 6);
      break;
    case 'bottom-center':
      doc.text(pageNumberText, pageWidth / 2, footerY + 6, { align: 'center' });
      break;
    case 'bottom-right':
    default:
      doc.text(pageNumberText, pageWidth - margin, footerY + 6, { align: 'right' });
      break;
  }
}
\`\`\`

## Questions
1. What could cause the page number to always appear in the middle despite the code handling different positions?
2. Are there any potential overrides happening elsewhere in the code?
3. Could there be other rendering code that's overriding this positioning?
4. What fixes would you recommend to ensure the page number position respects the user's selection?

Please analyze this issue thoroughly and suggest a fix.
`;

  try {
    console.log("Sending analysis request to Anthropic Claude...");
    
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: analysisPrompt
        }
      ]
    });
    
    console.log("\nAnalysis Results:");
    console.log("=================\n");
    console.log(response.content[0].text);
    
    // Extract potential fixes
    const fixes = extractPotentialFixes(response.content[0].text);
    console.log("\nRecommended Fixes:");
    console.log("=================\n");
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix}`);
    });
    
    console.log("\nNext steps:");
    console.log("1. Review the analysis and recommendations");
    console.log("2. Apply the suggested fixes to enhancedPdfGenerator.ts and pdfGenerator.ts");
    console.log("3. Test with different page number position settings");
    
    return {
      analysis: response.content[0].text,
      fixes: fixes,
      success: true
    };
  } catch (error) {
    console.error("Error analyzing PDF positioning issue:", error);
    
    // Provide offline analysis as fallback
    return {
      analysis: offlineAnalysis(),
      fixes: offlineFixes(),
      success: false,
      error: error.message
    };
  }
}

function extractPotentialFixes(analysisText) {
  // In a real implementation, we'd parse the analysis text to extract fixes
  // For this demonstration, we'll return some common fixes
  return [
    "Check if there's a default style or header/footer definition that's overriding page numbers",
    "Ensure pdfSettings object is fully populated with all properties when passed to generators",
    "Add a strict type check before the switch statement to ensure position is a valid enum value",
    "Verify that footerY is correctly calculated for bottom positions",
    "Check for multiple page number renderings in the code that might be overwriting each other",
    "Ensure jsPDF is not performing automatic page numbering separately from our custom code",
    "Verify the page number is not being overridden in addHeaderAndFooter or other wrapper functions"
  ];
}

function offlineAnalysis() {
  return `
## PDF Page Number Position Analysis (Offline)

Based on the code and issue description, here are the most likely causes:

1. **Multiple Rendering Conflicts**: There might be multiple sections of code rendering page numbers, with later code overriding earlier positioning.

2. **PDF Library Default Behavior**: The jsPDF library might have default page numbering enabled that's overriding custom positioning.

3. **CSS/Style Override**: There could be a style or template setting that's forcing center alignment regardless of position setting.

4. **Incorrect Parameter Passing**: The position setting might not be correctly passed through the entire rendering pipeline.

5. **Type Conversion Issues**: The position value might be getting converted to an unexpected format somewhere in the process.

The most common pattern for this issue is having multiple rendering functions that all add page numbers, with only the last one being visible in the final PDF.
  `;
}

function offlineFixes() {
  return [
    "Search for all instances of page number rendering in the codebase",
    "Ensure only one code path is responsible for rendering page numbers",
    "Add a flag to track if page numbers have already been rendered",
    "Verify jsPDF configuration doesn't have automatic page numbering enabled",
    "Check if any template or footer functions are adding additional page numbers"
  ];
}

// Run the analysis
analyzePdfPositioningIssue()
  .then(() => {
    console.log("Analysis complete");
  })
  .catch(error => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });

export { analyzePdfPositioningIssue };