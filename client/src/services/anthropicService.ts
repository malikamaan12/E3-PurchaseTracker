import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
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

    return response.content[0].text;
  } catch (error) {
    console.error('Error analyzing form state:', error);
    throw error;
  }
}
