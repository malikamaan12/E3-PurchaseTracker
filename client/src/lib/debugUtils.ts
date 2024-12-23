import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // Enable browser usage
});

export async function analyzeFormError(formData: any, error: any) {
  try {
    const message = await anthropic.messages.create({
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyze this form submission error and provide debugging suggestions:
          Form Data: ${JSON.stringify(formData, null, 2)}
          Error: ${JSON.stringify(error, null, 2)}

          Focus on:
          1. Data type mismatches
          2. Missing required fields
          3. Invalid field formats
          4. Validation rule violations

          Provide a clear, concise explanation of the issues and how to fix them.`
        }
      ],
      model: 'claude-3-5-sonnet-20241022',
    });

    // Extract and format the text response
    const analysis = message.content[0].text;
    return analysis ? analysis.trim() : "Unable to analyze the error";
  } catch (error) {
    console.error("Error analyzing form data:", error);
    return "Error analysis failed. Please check the console for details.";
  }
}