import { Anthropic } from '@anthropic-ai/sdk';
import { useToast } from '@/hooks/use-toast';

// Initialize Anthropic with safer defaults and environment checks
function getAnthropicInstance() {
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ANTHROPIC_API_KEY : null;
  if (!apiKey) {
    console.warn('Warning: VITE_ANTHROPIC_API_KEY is not set. AI-powered error analysis will be limited.');
    return null;
  }
  return new Anthropic({ apiKey });
}

const anthropic = getAnthropicInstance();

export async function analyzeFormError(formData: any, error: any) {
  try {
    console.error("Form submission error:", {
      formData,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });

    if (!anthropic) {
      return error instanceof Error ? error.message : "Unable to analyze error. Please check form inputs.";
    }

    // Prepare context for Claude
    const context = `
Form Data: ${JSON.stringify(formData, null, 2)}
Error: ${error instanceof Error ? error.message : JSON.stringify(error)}
Stack: ${error instanceof Error ? error.stack : 'No stack trace'}
    `;

    // Get analysis from Claude
    // the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this form submission error and provide specific debugging steps:
${context}
Focus on:
1. Data validation issues
2. Missing required fields
3. Type mismatches
4. API endpoint issues
Provide concise, actionable steps.`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : "Unable to analyze error. Please check form inputs.";
  } catch (analyzeError) {
    console.error("Error analysis failed:", analyzeError);
    return "Unable to analyze the error. Please check the form inputs and try again.";
  }
}

export async function debugFilePreview(files: any[], error?: any) {
  try {
    if (!anthropic) {
      return "File preview analysis unavailable. Please check file compatibility manually.";
    }

    const fileContext = files.map(file => ({
      name: file.fileName || file.name,
      type: file.fileType || file.type,
      size: file.size,
      url: file.fileUrl || file.preview
    }));

    console.log("File Preview Debug:", {
      files: fileContext,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });

    // Get analysis from Claude
    // the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this file preview issue:
Files: ${JSON.stringify(fileContext, null, 2)}
Error: ${error ? JSON.stringify(error) : 'No error provided'}
Focus on:
1. File type compatibility
2. File URL/preview generation
3. Component rendering issues
Provide specific debugging steps.`
      }]
    });

    const analysis = response.content[0].type === 'text' ? response.content[0].text :
      "Unable to analyze file preview issues. Please check file compatibility.";
    return analysis;
  } catch (debugError) {
    console.error("File preview debug failed:", debugError);
    return "Unable to analyze file preview issue. Please check file compatibility and component rendering.";
  }
}

export function useErrorHandler() {
  const { toast } = useToast();

  return async (error: any, context?: string) => {
    console.error(`Error in ${context || 'application'}:`, error);

    // Show direct error message if Anthropic is not available
    if (!anthropic) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      return;
    }

    try {
      // the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this error and provide user-friendly explanation:
Error: ${error instanceof Error ? error.message : JSON.stringify(error)}
Context: ${context || 'Not provided'}
Stack: ${error instanceof Error ? error.stack : 'No stack trace'}
Provide a clear, non-technical explanation and suggestion.`
        }]
      });

      const analysis = response.content[0].type === 'text' ? response.content[0].text :
        (error instanceof Error ? error.message : "An unexpected error occurred");

      toast({
        title: "Error",
        description: analysis,
        variant: "destructive",
      });
    } catch (analyzeError) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
}