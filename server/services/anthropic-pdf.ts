import Anthropic from '@anthropic-ai/sdk';
import { Request } from '../types';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generatePDFLayout(request: Request) {
  const prompt = `
As a document formatting expert, analyze and generate the optimal A4 PDF layout for a purchase request document with the following requirements:

1. Header:
- Company name: "EVENTS & ENTERTAINMENT ENTERPRISES"
- Subtitle: "PURCHASE REQUEST"
- Must be centered and prominent at the top
- Use high contrast colors for readability

2. Layout Specifications:
- A4 size (210mm × 297mm)
- Margins: 20mm on all sides
- Header height: 40mm
- Footer height: 20mm
- Content area: Remaining space between header and footer
- Ensure all content fits on a single page

3. Content Sections:
- Request Details (2 columns):
  * Left: Request Number, Purpose Type
  * Right: Date, Status
- Title and Description
- Items Table with columns:
  * Item Name
  * Description
  * Quantity (right-aligned)
  * Unit Cost (right-aligned)
  * Total Cost (right-aligned)
- Total Amount (right-aligned)
- Requester Information

4. Content Structure for this purchase request:
${JSON.stringify(request, null, 2)}

Please provide the exact CSS and HTML structure that will:
1. Ensure professional A4 paper size formatting
2. Maintain proper spacing and alignment
3. Handle print media queries correctly
4. Support A4 paper size specifications
5. Include proper table formatting for the items section

Format your response as a JSON object with:
1. 'styles': CSS rules including print media queries
2. 'layout': Complete HTML structure with proper semantic tags
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Access the response content correctly
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Anthropic');
    }

    // Parse and return the layout
    const result = JSON.parse(content.text);
    return result;
  } catch (error) {
    console.error('Anthropic PDF layout generation error:', error);
    throw error;
  }
}