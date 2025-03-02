import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  // Allow direct browser usage - for production, consider using a backend proxy
  dangerouslyAllowBrowser: true
});

export async function analyzeFormStateIssue(formCode: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Please analyze this React form code and identify any state management issues, particularly focusing on form control and filter state synchronization issues. Here's the code:\n\n${formCode}\n\nProvide specific recommendations for fixing state management and form control issues.`
      }]
    });

    // Safely access the content text
    const content = response.content[0];
    return typeof content === 'object' && 'text' in content ? content.text : 'No analysis available';

  } catch (error) {
    console.error('Error analyzing form state:', error);
    throw error;
  }
}

export async function analyzeDraftSubmission(formData: any, validationErrors: string[]): Promise<{
  fixedData: any;
  analysisMessage: string;
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `I'm having validation issues when submitting a draft purchase request for approval. 
        Here's my form data:
        ${JSON.stringify(formData, null, 2)}
        
        And these are the validation errors I'm getting:
        ${JSON.stringify(validationErrors, null, 2)}
        
        Please analyze what might be wrong with my draft request data and suggest fixes to prepare it for submission.
        Format your response as JSON with two properties: 
        1. "fixedData": A corrected version of the form data
        2. "analysisMessage": A brief explanation of what was fixed
        `
      }]
    });

    // Safely access the content text
    const content = response.content[0];
    const analysisText = typeof content === 'object' && 'text' in content ? content.text : '{}';
    
    // Extract the JSON part from the response
    let jsonStr = analysisText;
    if (analysisText.includes('```json')) {
      jsonStr = analysisText.split('```json')[1].split('```')[0].trim();
    } else if (analysisText.includes('{')) {
      jsonStr = analysisText.substring(analysisText.indexOf('{'), analysisText.lastIndexOf('}') + 1);
    }
    
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Error parsing AI response as JSON:', e);
      return {
        fixedData: formData,
        analysisMessage: "Failed to parse AI analysis. Using original data."
      };
    }
  } catch (error) {
    console.error('Error analyzing draft submission:', error);
    return {
      fixedData: formData,
      analysisMessage: "Error connecting to AI service. Using original data."
    };
  }
}

export async function analyzeValidationContext(
  formData: any, 
  validationErrors: string[], 
  action: 'draft' | 'submit'
): Promise<{
  shouldProceed: boolean;
  fixedData?: any;
  message: string;
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `I'm working with a purchase requisition system. I'm trying to ${action === 'draft' ? 'save a draft' : 'submit for approval'} but encountering validation issues.
        
        Here's my form data:
        ${JSON.stringify(formData, null, 2)}
        
        These are the validation errors I'm getting:
        ${JSON.stringify(validationErrors, null, 2)}
        
        Please analyze this situation and determine:
        1. If these are critical errors that should block the ${action} operation
        2. If there are simple fixes that can be applied automatically to the data
        3. Whether we should proceed with the ${action} operation
        
        Format your response as JSON with these properties:
        - "shouldProceed": boolean indicating if the operation should continue
        - "fixedData": (optional) The corrected form data if fixable
        - "message": Brief explanation of the analysis and recommendation
        `
      }]
    });

    // Extract and parse the JSON response
    const content = response.content[0];
    const analysisText = typeof content === 'object' && 'text' in content ? content.text : '{}';
    
    // Extract the JSON part
    let jsonStr = analysisText;
    if (analysisText.includes('```json')) {
      jsonStr = analysisText.split('```json')[1].split('```')[0].trim();
    } else if (analysisText.includes('{')) {
      jsonStr = analysisText.substring(analysisText.indexOf('{'), analysisText.lastIndexOf('}') + 1);
    }
    
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Error parsing AI response as JSON:', e);
      return {
        shouldProceed: false,
        message: `Unable to analyze the validation errors. Please review the form manually before ${action === 'draft' ? 'saving' : 'submitting'}.`
      };
    }
  } catch (error) {
    console.error('Error analyzing validation context:', error);
    return {
      shouldProceed: false,
      message: "Error connecting to AI service. Please try again later."
    };
  }
}