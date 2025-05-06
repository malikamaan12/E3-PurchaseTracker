import { analyzeText, analyzeImage } from './anthropic-client';

// Test function for anthropic text analysis
export async function testTextAnalysis(text: string) {
  try {
    console.log('Testing Anthropic text analysis...');
    const result = await analyzeText(text, {
      maxTokens: 1500,
      temperature: 0.5,
      system: "You're a helpful assistant analyzing business text. Be concise.",
    });
    
    console.log('Anthropic text analysis result:');
    console.log(result);
    return { success: true, result };
  } catch (error) {
    console.error('Anthropic text analysis failed:', error);
    return { success: false, error };
  }
}

// Test function for anthropic image analysis
export async function testImageAnalysis(base64Image: string, prompt: string) {
  try {
    console.log('Testing Anthropic image analysis...');
    const result = await analyzeImage(base64Image, prompt, {
      maxTokens: 1500,
      temperature: 0.5,
    });
    
    console.log('Anthropic image analysis result:');
    console.log(result);
    return { success: true, result };
  } catch (error) {
    console.error('Anthropic image analysis failed:', error);
    return { success: false, error };
  }
}

// Test function for analyzing vendor data
export async function testVendorAnalysis(vendorData: any) {
  try {
    console.log('Testing vendor analysis...');
    const prompt = `
    Analyze the following vendor performance data and provide actionable insights:
    
    Vendor Data:
    ${JSON.stringify(vendorData, null, 2)}
    
    Please provide:
    1. Overall performance rating on a scale of 1-10
    2. Key strengths and weaknesses
    3. Trend analysis (improving, declining, or stable)
    4. Recommendations for vendor management
    5. Risk assessment (low, medium, high)
    `;
    
    const result = await analyzeText(prompt, {
      maxTokens: 1500,
      temperature: 0.4,
      system: "You're a vendor management expert. Analyze vendor performance data and provide actionable insights.",
    });
    
    console.log('Vendor analysis result:');
    console.log(result);
    return { success: true, result };
  } catch (error) {
    console.error('Vendor analysis failed:', error);
    return { success: false, error };
  }
}