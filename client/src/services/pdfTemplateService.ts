import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';

export const PDF_TEMPLATE_TYPES = {
  STANDARD: 'standard',
  EXECUTIVE: 'executive',
  COMPACT: 'compact',
  DETAILED: 'detailed',
  MINIMAL: 'minimal'
};

export const PDF_LAYOUT_TYPES = {
  CLASSIC: 'classic',
  MODERN: 'modern',
  BENTO: 'bento',
  COMPACT: 'compact',
  FULL_PAGE: 'full-page'
};

export const SECURITY_LEVELS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  RESTRICTED: 'restricted',
  CONFIDENTIAL: 'confidential'
};

export interface PdfTemplateConfig {
  id?: number;
  name: string;
  type: string;
  layout: string;
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
  showWatermark: boolean;
  securityLevel: string;
  headerColor?: [number, number, number];
  accentColor?: [number, number, number];
  watermarkOpacity?: number;
  watermarkText?: string;
  showApprovalFlow?: boolean;
  showSignatureLines?: boolean;
  showAttachments?: boolean;
  showTotalsTable?: boolean;
  customFields?: Record<string, boolean>;
}

export const DEFAULT_TEMPLATES: Record<string, PdfTemplateConfig> = {
  [PDF_TEMPLATE_TYPES.STANDARD]: {
    name: 'Standard',
    type: PDF_TEMPLATE_TYPES.STANDARD,
    layout: PDF_LAYOUT_TYPES.CLASSIC,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: false,
    securityLevel: SECURITY_LEVELS.PUBLIC,
    headerColor: [26, 54, 93], // #1a365d
    accentColor: [79, 70, 229], // #4F46E5
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true
  },
  [PDF_TEMPLATE_TYPES.EXECUTIVE]: {
    name: 'Executive',
    type: PDF_TEMPLATE_TYPES.EXECUTIVE,
    layout: PDF_LAYOUT_TYPES.MODERN,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: true,
    securityLevel: SECURITY_LEVELS.CONFIDENTIAL,
    headerColor: [23, 37, 84], // #172554
    accentColor: [79, 70, 229], // #4F46E5
    watermarkOpacity: 0.15,
    watermarkText: 'CONFIDENTIAL',
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true
  },
  [PDF_TEMPLATE_TYPES.COMPACT]: {
    name: 'Compact',
    type: PDF_TEMPLATE_TYPES.COMPACT,
    layout: PDF_LAYOUT_TYPES.COMPACT,
    showHeader: true,
    showFooter: true,
    showLogo: false,
    showWatermark: false,
    securityLevel: SECURITY_LEVELS.PUBLIC,
    headerColor: [30, 41, 59], // #1e293b
    accentColor: [3, 105, 161], // #0369a1
    showApprovalFlow: false,
    showSignatureLines: false,
    showAttachments: false,
    showTotalsTable: true
  },
  [PDF_TEMPLATE_TYPES.DETAILED]: {
    name: 'Detailed',
    type: PDF_TEMPLATE_TYPES.DETAILED,
    layout: PDF_LAYOUT_TYPES.FULL_PAGE,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: true,
    securityLevel: SECURITY_LEVELS.RESTRICTED,
    headerColor: [127, 29, 29], // #7f1d1d
    accentColor: [157, 23, 77], // #9d174d
    watermarkOpacity: 0.12,
    watermarkText: 'RESTRICTED',
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true,
    customFields: {
      showComments: true,
      showHistory: true,
      showMetadata: true
    }
  },
  [PDF_TEMPLATE_TYPES.MINIMAL]: {
    name: 'Minimal',
    type: PDF_TEMPLATE_TYPES.MINIMAL,
    layout: PDF_LAYOUT_TYPES.BENTO,
    showHeader: false,
    showFooter: true,
    showLogo: false,
    showWatermark: true,
    securityLevel: SECURITY_LEVELS.INTERNAL,
    headerColor: [17, 24, 39], // #111827
    accentColor: [2, 132, 199], // #0284c7
    watermarkOpacity: 0.08,
    watermarkText: 'INTERNAL',
    showApprovalFlow: false,
    showSignatureLines: false,
    showAttachments: false,
    showTotalsTable: true
  }
};

export function colorToHex(color: [number, number, number]): string {
  return `#${color.map(c => {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!hex) return [0, 0, 0];
  
  // Remove the hash at the start if it exists
  hex = hex.replace(/^#/, '');
  
  // Parse the RGB components
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Return as RGB tuple
  return [r, g, b];
}

export async function saveTemplateConfig(config: PdfTemplateConfig): Promise<PdfTemplateConfig> {
  try {
    const response = await axios.post('/api/pdf/settings', {
      templateConfig: config,
      type: 'template'
    }, {
      withCredentials: true
    });
    
    return response.data;
  } catch (error) {
    console.error('Error saving template configuration:', error);
    throw error;
  }
}

export async function getTemplateConfig(): Promise<PdfTemplateConfig> {
  try {
    const response = await axios.get('/api/pdf/print-settings', {
      params: { type: 'template' },
      withCredentials: true
    });
    
    if (response.data && response.data.templateConfig) {
      return response.data.templateConfig;
    }
    
    // Return default template if none exists
    return DEFAULT_TEMPLATES[PDF_TEMPLATE_TYPES.STANDARD];
  } catch (error) {
    console.error('Error fetching template configuration:', error);
    return DEFAULT_TEMPLATES[PDF_TEMPLATE_TYPES.STANDARD];
  }
}

export interface TemplateAnalysisResult {
  analysis: string;
  recommendations: string[];
  fixedTemplate?: PdfTemplateConfig;
}

export async function analyzeTemplateIssue(
  templateConfig: PdfTemplateConfig,
  errorMessage: string
): Promise<TemplateAnalysisResult> {
  try {
    // Try to use Anthropic Claude API for analysis if available
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (anthropicApiKey) {
      try {
        const anthropic = new Anthropic({
          apiKey: anthropicApiKey
        });
        
        const message = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          system: "You're an expert in PDF template configuration and generation issues. Analyze the provided template configuration and error message, then provide a concise explanation of the issue and practical recommendations to fix it.",
          messages: [
            {
              role: 'user',
              content: `
                I'm having an issue with a PDF template configuration. Here's the configuration:
                ${JSON.stringify(templateConfig, null, 2)}
                
                And here's the error message:
                ${errorMessage}
                
                Please analyze what might be causing this issue and provide specific recommendations to fix it.
                Format your response with two sections:
                1. Brief analysis of the problem
                2. A bulleted list of specific recommendations to fix the issue
                
                Also, provide a fixed version of the configuration if possible.
              `
            }
          ]
        });
        
        // Type-safe content access
        let responseText = '';
        for (const item of message.content) {
          if ('type' in item && item.type === 'text' && 'text' in item) {
            responseText = item.text;
            break;
          }
        }
        
        if (!responseText) {
          throw new Error('No text response from Claude API');
        }
        
        // Extract analysis, recommendations, and fixed template with simpler regex
        const analysisMatch = responseText.match(/(?:Analysis|Problem):([^]*?)(?=Recommendations:|$)/i);
        const recommendationsMatch = responseText.match(/Recommendations:([^]*?)(?=Fixed Template:|$)/i);
        const fixedTemplateMatch = responseText.match(/Fixed Template:([^]*?)(?=$)/i);
        
        const analysis = analysisMatch ? analysisMatch[1].trim() : 'Could not determine the issue.';
        
        let recommendations: string[] = [];
        if (recommendationsMatch) {
          const recText = recommendationsMatch[1].trim();
          recommendations = recText
            .split(/[\r\n]+[-•*]\s*/)
            .filter(Boolean)
            .map((r: string) => r.trim());
          
          // Remove empty first item if present
          if (recommendations.length > 0 && recommendations[0] === '') {
            recommendations.shift();
          }
        }
        
        let fixedTemplate: PdfTemplateConfig | undefined = undefined;
        if (fixedTemplateMatch) {
          try {
            // Try to extract JSON from the response
            const jsonRegex = /```json([^]*?)```|{[^]*?}/;
            const jsonMatch = fixedTemplateMatch[1].match(jsonRegex);
            if (jsonMatch) {
              const jsonText = jsonMatch[1] ? jsonMatch[1].trim() : jsonMatch[0].trim();
              fixedTemplate = JSON.parse(jsonText) as PdfTemplateConfig;
            }
          } catch (parseError) {
            console.error('Failed to parse fixed template JSON:', parseError);
          }
        }
        
        return {
          analysis,
          recommendations,
          fixedTemplate
        };
      } catch (anthropicError) {
        console.error('Error using Anthropic API:', anthropicError);
        // Fall back to local analysis
        return performLocalAnalysis(templateConfig, errorMessage);
      }
    }
    
    // Fallback to local analysis if Anthropic API is not available
    return performLocalAnalysis(templateConfig, errorMessage);
  } catch (error) {
    console.error('Error analyzing template issue:', error);
    return performLocalAnalysis(templateConfig, errorMessage);
  }
}

function performLocalAnalysis(
  templateConfig: PdfTemplateConfig,
  errorMessage: string
): TemplateAnalysisResult {
  let analysis = 'There was an issue with your PDF template configuration.';
  const recommendations: string[] = [];
  
  // Check for common issues
  if (!templateConfig.name) {
    analysis = 'The template is missing a name property.';
    recommendations.push('Add a name to your template configuration.');
  } else if (!templateConfig.layout) {
    analysis = 'The template is missing a layout property.';
    recommendations.push('Specify a layout type for your template.');
  } else if (templateConfig.showWatermark && !templateConfig.watermarkText) {
    analysis = 'Watermark is enabled but no watermark text is specified.';
    recommendations.push('Add watermark text or disable the watermark feature.');
  } else if (templateConfig.showWatermark && (!templateConfig.watermarkOpacity || templateConfig.watermarkOpacity <= 0)) {
    analysis = 'Watermark is enabled but opacity is set to 0 or undefined.';
    recommendations.push('Set watermark opacity to a value greater than 0 (recommended: 0.1-0.2).');
  } else if (errorMessage.includes('header') || errorMessage.includes('Header')) {
    analysis = 'There appears to be an issue with the header configuration.';
    recommendations.push('Check header color format (should be RGB array).');
    recommendations.push('Ensure headerColor is properly defined if showHeader is true.');
  } else {
    analysis = `Unknown issue: ${errorMessage}`;
    recommendations.push('Try using a different template.');
    recommendations.push('Check server logs for more detailed error information.');
  }
  
  // Create a fixed template based on identified issues
  const fixedTemplate: PdfTemplateConfig = {
    ...templateConfig,
    name: templateConfig.name || 'Fixed Template',
    layout: templateConfig.layout || PDF_LAYOUT_TYPES.CLASSIC,
    securityLevel: templateConfig.securityLevel || SECURITY_LEVELS.PUBLIC,
    headerColor: Array.isArray(templateConfig.headerColor) ? templateConfig.headerColor : [26, 54, 93],
    accentColor: Array.isArray(templateConfig.accentColor) ? templateConfig.accentColor : [79, 70, 229]
  };
  
  if (templateConfig.showWatermark && !templateConfig.watermarkText) {
    fixedTemplate.watermarkText = templateConfig.securityLevel.toUpperCase();
  }
  
  if (templateConfig.showWatermark && (!templateConfig.watermarkOpacity || templateConfig.watermarkOpacity <= 0)) {
    fixedTemplate.watermarkOpacity = 0.1;
  }
  
  return {
    analysis,
    recommendations,
    fixedTemplate
  };
}

/**
 * Apply security settings to a template configuration
 * based on specified security level
 * @param templateConfig Base template configuration
 * @param securityLevel Security classification level
 * @returns Updated template configuration with security settings
 */
export function applySecuritySettings(
  templateConfig: PdfTemplateConfig,
  securityLevel: string = SECURITY_LEVELS.INTERNAL
): PdfTemplateConfig {
  // Start with a copy of the original template
  const updatedConfig = { ...templateConfig };
  
  // Update security level
  updatedConfig.securityLevel = securityLevel;
  
  // Apply watermark settings based on security level
  switch (securityLevel) {
    case SECURITY_LEVELS.CONFIDENTIAL:
      updatedConfig.showWatermark = true;
      updatedConfig.watermarkText = 'CONFIDENTIAL';
      updatedConfig.watermarkOpacity = 0.15;
      break;
      
    case SECURITY_LEVELS.RESTRICTED:
      updatedConfig.showWatermark = true;
      updatedConfig.watermarkText = 'RESTRICTED';
      updatedConfig.watermarkOpacity = 0.12;
      break;
      
    case SECURITY_LEVELS.INTERNAL:
      updatedConfig.showWatermark = true;
      updatedConfig.watermarkText = 'INTERNAL USE';
      updatedConfig.watermarkOpacity = 0.08;
      break;
      
    case SECURITY_LEVELS.PUBLIC:
    default:
      updatedConfig.showWatermark = false;
      updatedConfig.watermarkText = undefined;
      updatedConfig.watermarkOpacity = 0;
      break;
  }
  
  return updatedConfig;
}

/**
 * Get appropriate template based on document type and security requirements
 * @param templateType The type of template to use
 * @param securityLevel Security classification level
 * @returns The appropriate template configuration
 */
export function getTemplateByTypeAndSecurity(
  templateType: string = PDF_TEMPLATE_TYPES.STANDARD,
  securityLevel: string = SECURITY_LEVELS.INTERNAL
): PdfTemplateConfig {
  // Get the base template by type or default to standard
  const baseTemplate = DEFAULT_TEMPLATES[templateType] || DEFAULT_TEMPLATES[PDF_TEMPLATE_TYPES.STANDARD];
  
  // Apply security settings
  return applySecuritySettings(baseTemplate, securityLevel);
}

// Export a default object with all the functions
const pdfTemplateService = {
  saveTemplateConfig,
  getTemplateConfig,
  analyzeTemplateIssue,
  colorToHex,
  hexToRgb,
  applySecuritySettings,
  getTemplateByTypeAndSecurity
};

export default pdfTemplateService;