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
    // For drafts with no data, skip AI analysis and return original
    const hasFormData = formData && 
      (formData.title || 
       formData.description || 
       (formData.items && formData.items.length > 0 && formData.items.some(i => i.name || i.quantity > 0 || i.estimatedCost > 0)));
    
    if (!hasFormData) {
      console.log('Skipping AI analysis for empty draft');
      return {
        fixedData: formData,
        analysisMessage: "Draft saved with minimal data. Add more details before submitting."
      };
    }
    
    // Add retry logic for AI calls
    let retries = 2;
    let lastError = null;
    
    while (retries >= 0) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `I'm preparing a draft purchase request and want to check if it's valid or needs improvements before saving.
            
            Here's my draft form data:
            ${JSON.stringify(formData, null, 2)}
            
            These are any validation messages I've received (if any):
            ${JSON.stringify(validationErrors, null, 2)}
            
            Please analyze my draft and suggest improvements to make it more complete.
            For a draft, all fields are optional, but providing proper values will help when I submit it later.
            
            Format your response as JSON with two properties: 
            1. "fixedData": A corrected or improved version of the form data
            2. "analysisMessage": A brief explanation of what was fixed or improved
            
            Important: 
            - Don't invent data values that aren't in the original
            - For drafts, I can save incomplete information
            - Focus on data format issues and required structures
            `
          }]
        });

        // Safely access the content text
        const content = response.content[0];
        const analysisText = typeof content === 'object' && 'text' in content ? content.text : '{}';
        
        // Extract the JSON part from the response using multiple strategies
        let jsonStr = analysisText;
        if (analysisText.includes('```json')) {
          jsonStr = analysisText.split('```json')[1].split('```')[0].trim();
        } else if (analysisText.includes('{') && analysisText.includes('}')) {
          const startPos = analysisText.indexOf('{');
          const endPos = analysisText.lastIndexOf('}') + 1;
          if (startPos < endPos) {
            jsonStr = analysisText.substring(startPos, endPos);
          }
        }
        
        try {
          // Pre-process JSON string to handle potential issues
          const cleanedJsonStr = jsonStr
            .replace(/,\s*}/g, '}') // Remove trailing commas
            .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
            .replace(/\\'/g, "'"); // Fix escaped single quotes
          
          const parsedResponse = JSON.parse(cleanedJsonStr);
          
          // Ensure required structure
          if (!parsedResponse.fixedData) {
            console.warn('AI response missing fixedData, using original data');
            parsedResponse.fixedData = formData;
          }
          
          // Ensure draft status is preserved
          if (parsedResponse.fixedData) {
            parsedResponse.fixedData.status = 'draft';
          }
          
          return {
            fixedData: parsedResponse.fixedData,
            analysisMessage: parsedResponse.analysisMessage || "Draft data enhanced for better completion."
          };
        } catch (parseError) {
          console.error('Error parsing AI response as JSON:', parseError, 'Raw JSON:', jsonStr);
          
          if (retries > 0) {
            retries--;
            lastError = parseError;
            continue; // Try again
          }
          
          // Return original data if parsing failed after all retries
          return {
            fixedData: formData,
            analysisMessage: "Unable to analyze draft data. Your original draft was saved without changes."
          };
        }
      } catch (apiError) {
        console.error('API error during retry:', apiError);
        if (retries > 0) {
          retries--;
          lastError = apiError;
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        throw apiError; // Re-throw if all retries failed
      }
    }
    
    // We should never get here, but just in case
    throw lastError || new Error('Unknown error in draft analysis');
    
  } catch (error) {
    console.error('Error analyzing draft submission:', error);
    return {
      fixedData: formData,
      analysisMessage: "Error during analysis. Your draft was saved as-is."
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
    
    // Extract the JSON part using multiple strategies for robustness
    let jsonStr = analysisText;
    
    // Strategy 1: Try to extract from code blocks
    if (analysisText.includes('```json')) {
      jsonStr = analysisText.split('```json')[1].split('```')[0].trim();
    } 
    // Strategy 2: Try to extract using curly braces
    else if (analysisText.includes('{') && analysisText.includes('}')) {
      const startPos = analysisText.indexOf('{');
      const endPos = analysisText.lastIndexOf('}') + 1;
      if (startPos < endPos) {
        jsonStr = analysisText.substring(startPos, endPos);
      }
    }
    
    try {
      // Pre-process JSON string to handle potential issues
      const cleanedJsonStr = jsonStr
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      
      const parsedData = JSON.parse(cleanedJsonStr);
      
      // For draft operations, we should be more lenient
      if (action === 'draft' && !parsedData.shouldProceed) {
        console.log('Overriding AI recommendation for draft - allowing draft to save regardless');
        // Override to always allow draft saving (with original data if no fixedData was provided)
        return {
          shouldProceed: true,
          fixedData: parsedData.fixedData || formData,
          message: "You can save this draft despite validation issues. The system will store your progress."
        };
      }
      
      return parsedData;
    } catch (e) {
      console.error('Error parsing AI response as JSON:', e, 'Raw response:', jsonStr);
      
      // Special handling for drafts - always allow saving
      if (action === 'draft') {
        return {
          shouldProceed: true,
          fixedData: formData, // Use original data
          message: "Draft saved. Some validation issues exist but drafts can be saved with incomplete information."
        };
      }
      
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