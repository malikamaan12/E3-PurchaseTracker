/**
 * Utility for analyzing UI design and providing color optimization recommendations
 * Uses Claude AI to generate intelligent UI color scheme suggestions
 */

import { anthropicClient, MODEL, executeWithRetry, DEFAULT_MAX_TOKENS } from './anthropic-config';

/**
 * Response structure for UI analysis
 */
export interface UiAnalysisResult {
  recommendedColors: {
    light: {
      primary: string;
      background: string;
      text: string;
      border: string;
      card: string;
      accent: string;
    },
    dark: {
      primary: string;
      background: string;
      text: string;
      border: string;
      card: string;
      accent: string;
    }
  };
  accessibilityScore: number;
  textVisibilityScore: number;
  colorHarmonyScore: number;
  recommendations: string[];
}

/**
 * Analyze a screenshot and current color scheme to provide UI improvement recommendations
 * @param base64Image Base64-encoded screenshot of the application
 * @param currentColorScheme Current color scheme information
 */
export async function analyzeUiColors(
  base64Image: string,
  currentColorScheme: any
): Promise<UiAnalysisResult> {
  try {
    // Prepare the system prompt
    const systemPrompt = `You are a UI/UX design expert specialized in color theory and accessibility. 
    Analyze the provided screenshot and current color scheme to provide specific recommendations 
    for improving color harmony, text visibility, and overall user experience. 
    Focus particularly on ensuring text is visible against backgrounds in all color modes.`;

    // Prepare the user prompt with the screenshot and current color scheme
    const response = await executeWithRetry(() =>
      anthropicClient.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this UI screenshot and the current color scheme:\n${JSON.stringify(currentColorScheme, null, 2)}\n\nProvide recommendations for improving color harmony, text visibility (especially in dark mode), and overall user experience. Format your response as JSON with the following structure:\n{\n  "recommendedColors": {\n    "light": { /* color values */ },\n    "dark": { /* color values */ }\n  },\n  "accessibilityScore": number (0-100),\n  "textVisibilityScore": number (0-100),\n  "colorHarmonyScore": number (0-100),\n  "recommendations": [string, string, ...]\n}`
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }
        ]
      })
    );

    // Parse the response to extract the JSON data
    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/m);
      if (jsonMatch) {
        const jsonResponse = JSON.parse(jsonMatch[0]);
        return jsonResponse as UiAnalysisResult;
      }
    } catch (parseError) {
      console.error('Error parsing UI analysis response:', parseError);
    }

    // If JSON parsing fails, return a default response with the message
    return {
      recommendedColors: {
        light: {
          primary: '#4A6FFF',
          background: '#F8FAFC',
          text: '#18181B',
          border: '#E2E8F0',
          card: '#FFFFFF',
          accent: '#36BFFA'
        },
        dark: {
          primary: '#4A6FFF',
          background: '#0F172A',
          text: '#FFFFFF',
          border: '#334155',
          card: '#1E293B',
          accent: '#36BFFA'
        }
      },
      accessibilityScore: 85,
      textVisibilityScore: 90,
      colorHarmonyScore: 88,
      recommendations: [
        'The AI analysis could not be properly formatted. Please try again.'
      ]
    };
  } catch (error) {
    console.error('Error analyzing UI with Claude:', error);
    throw error;
  }
}

/**
 * Generate a color palette based on base colors that ensures text visibility
 * @param baseColors Base colors to derive a palette from
 */
export async function generateAccessibleColorPalette(
  baseColors: { primary: string; secondary: string; background: string }
): Promise<any> {
  try {
    const prompt = `Generate a complete accessible color palette based on these base colors: 
    Primary: ${baseColors.primary}, Secondary: ${baseColors.secondary}, Background: ${baseColors.background}.
    
    The palette should ensure all text is visible with at least WCAG AA compliance (4.5:1 contrast for normal text).
    Include colors for: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, and input.
    For each color, provide light and dark mode variants.
    
    Return the result in a valid JSON object that can be parsed.`;
    
    const response = await executeWithRetry(() =>
      anthropicClient.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS * 2,
        messages: [{ role: 'user', content: prompt }]
      })
    );

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/m);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing color palette response:', parseError);
    }

    return null;
  } catch (error) {
    console.error('Error generating color palette:', error);
    throw error;
  }
}