import { analyzeText, analyzeImage } from './anthropic-analyzer';

/**
 * Analyzes vendor profile information to provide insights
 * @param vendorInfo Object containing vendor details to analyze
 * @returns Analysis results with insights about the vendor
 */
export async function analyzeVendorProfile(vendorInfo: {
  companyName: string;
  industry?: string;
  description?: string;
  performance?: any[];
  history?: string;
  contactInfo?: any;
}): Promise<any> {
  try {
    const prompt = `
      Analyze this vendor information and provide insights about their potential as a business partner:
      
      Company Name: ${vendorInfo.companyName}
      Industry: ${vendorInfo.industry || 'Not specified'}
      Description: ${vendorInfo.description || 'Not provided'}
      Performance History: ${vendorInfo.performance ? JSON.stringify(vendorInfo.performance) : 'No performance data available'}
      Company History: ${vendorInfo.history || 'Not provided'}
      
      Please provide the following in your analysis:
      1. Overall assessment of the vendor's potential
      2. Strengths and opportunities
      3. Potential risks or concerns
      4. Recommendations for engagement strategy
    `;
    
    return await analyzeText(prompt);
  } catch (error) {
    console.error('Error analyzing vendor profile:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred during vendor analysis');
  }
}

/**
 * Analyzes vendor performance data to identify trends and insights
 * @param performanceData Array of performance data points
 * @returns Analysis results with insights and recommendations
 */
export async function analyzeVendorPerformance(performanceData: any[]): Promise<any> {
  try {
    if (!performanceData || performanceData.length === 0) {
      throw new Error('No performance data provided for analysis');
    }
    
    const prompt = `
      Analyze this vendor performance data and provide insights and recommendations:
      
      ${JSON.stringify(performanceData)}
      
      Please provide the following in your analysis:
      1. Key performance trends
      2. Areas of strength
      3. Areas that need improvement
      4. Recommendations for vendor management
      5. Risk assessment based on this data
    `;
    
    return await analyzeText(prompt);
  } catch (error) {
    console.error('Error analyzing vendor performance:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred during performance analysis');
  }
}

/**
 * Analyzes a vendor document (via its image) to extract key information
 * @param documentPath Path to the document image
 * @param documentType Type of document (e.g., 'invoice', 'contract', 'certificate')
 * @returns Analysis results with extracted information and insights
 */
export async function analyzeVendorDocument(documentPath: string, documentType: string): Promise<any> {
  try {
    const prompt = `
      This is a vendor ${documentType} document. Please carefully analyze it and extract:
      
      1. All key information visible in the document
      2. Any dates, amounts, terms, or conditions
      3. Potential compliance issues or concerns
      4. Overall assessment of this document
      
      Present the information in a structured format that would be useful for vendor management.
    `;
    
    return await analyzeImage(documentPath, prompt);
  } catch (error) {
    console.error('Error analyzing vendor document:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred during document analysis');
  }
}
