import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
          Error: ${JSON.stringify(error, null, 2)}`
        }
      ],
      model: 'claude-3-5-sonnet-20241022',
    });

    return message.content;
  } catch (error) {
    console.error("Error analyzing form data:", error);
    return null;
  }
}
