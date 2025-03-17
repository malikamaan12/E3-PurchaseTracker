import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';

// Constants for template types and layouts
export const PDF_TEMPLATE_TYPES = {
  STANDARD: 'standard',
  COMPACT: 'compact',
  DETAILED: 'detailed',
  EXECUTIVE: 'executive',
  COMPREHENSIVE: 'comprehensive',
};

export const PDF_LAYOUT_TYPES = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
};

export const SECURITY_LEVELS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  RESTRICTED: 'restricted',
  CONFIDENTIAL: 'confidential',
};

// Template configuration interface
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

// Default template configurations
export const DEFAULT_TEMPLATES: Record<string, PdfTemplateConfig> = {
  [PDF_TEMPLATE_TYPES.STANDARD]: {
    name: 'Standard',
    type: PDF_TEMPLATE_TYPES.STANDARD,
    layout: PDF_LAYOUT_TYPES.PORTRAIT,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: false,
    securityLevel: SECURITY_LEVELS.PUBLIC,
    headerColor: [111, 42, 230],
    accentColor: [31, 211, 219],
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true,
  },
  [PDF_TEMPLATE_TYPES.COMPACT]: {
    name: 'Compact',
    type: PDF_TEMPLATE_TYPES.COMPACT,
    layout: PDF_LAYOUT_TYPES.PORTRAIT,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: false,
    securityLevel: SECURITY_LEVELS.PUBLIC,
    headerColor: [0, 102, 204],
    accentColor: [102, 204, 0],
    showApprovalFlow: false,
    showSignatureLines: false,
    showAttachments: false,
    showTotalsTable: true,
  },
  [PDF_TEMPLATE_TYPES.DETAILED]: {
    name: 'Detailed',
    type: PDF_TEMPLATE_TYPES.DETAILED,
    layout: PDF_LAYOUT_TYPES.PORTRAIT,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: false,
    securityLevel: SECURITY_LEVELS.INTERNAL,
    headerColor: [128, 0, 128],
    accentColor: [255, 153, 0],
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true,
  },
  [PDF_TEMPLATE_TYPES.EXECUTIVE]: {
    name: 'Executive',
    type: PDF_TEMPLATE_TYPES.EXECUTIVE,
    layout: PDF_LAYOUT_TYPES.LANDSCAPE,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: true,
    securityLevel: SECURITY_LEVELS.RESTRICTED,
    watermarkText: 'EXECUTIVE SUMMARY',
    watermarkOpacity: 0.08,
    headerColor: [0, 0, 0],
    accentColor: [128, 128, 128],
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: false,
    showTotalsTable: true,
  },
  [PDF_TEMPLATE_TYPES.COMPREHENSIVE]: {
    name: 'Comprehensive',
    type: PDF_TEMPLATE_TYPES.COMPREHENSIVE,
    layout: PDF_LAYOUT_TYPES.PORTRAIT,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: true,
    securityLevel: SECURITY_LEVELS.CONFIDENTIAL,
    watermarkText: 'CONFIDENTIAL',
    watermarkOpacity: 0.15,
    headerColor: [153, 0, 0],
    accentColor: [51, 51, 51],
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true,
  },
};

// Function to convert a color object to a hex value
export function colorToHex(color: [number, number, number]): string {
  return `#${color.map(c => {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

// Function to convert hex to RGB color array
export function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse the hex values
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  
  return [r, g, b];
}

// Save template configuration to backend
export async function saveTemplateConfig(config: PdfTemplateConfig): Promise<PdfTemplateConfig> {
  try {
    const response = await axios.post('/api/pdf/settings', config);
    return response.data;
  } catch (error) {
    console.error('Error saving template configuration:', error);
    throw error;
  }
}

// Get template configuration from backend
export async function getTemplateConfig(): Promise<PdfTemplateConfig> {
  try {
    const response = await axios.get('/api/pdf/print-settings');
    return response.data;
  } catch (error) {
    console.error('Error fetching template configuration:', error);
    // Return default if not found
    return DEFAULT_TEMPLATES[PDF_TEMPLATE_TYPES.STANDARD];
  }
}

// Using Anthropic to analyze and fix template issues
export async function analyzeTemplateIssue(
  template: Partial<PdfTemplateConfig>,
  errorMessage: string
): Promise<{
  analysis: string;
  fixedTemplate: Partial<PdfTemplateConfig>;
  recommendations: string[];
}> {
  try {
    // Check if ANTHROPIC_API_KEY is available in environment
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.warn('Anthropic API key not found. Using local analysis instead.');
      return performLocalAnalysis(template, errorMessage);
    }
    
    const anthropic = new Anthropic({
      apiKey,
    });
    
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2000,
      system: "You are an expert PDF template analyzer for a purchase request system. Your job is to analyze template configuration issues and provide fixes. Return a JSON object with 'analysis', 'fixedTemplate', and 'recommendations' fields.",
      messages: [
        {
          role: 'user',
          content: `
I'm having an issue with my PDF template configuration. Here's my current template:
${JSON.stringify(template, null, 2)}

And here's the error I'm getting:
${errorMessage}

Please analyze what might be wrong with my template configuration and suggest fixes.
Return your response as a JSON object with the following structure:
{
  "analysis": "Detailed explanation of the issue",
  "fixedTemplate": { /* Fixed template object */ },
  "recommendations": ["List", "of", "recommendations"]
}
          `
        }
      ]
    });
    
    // Parse the response JSON from the first content block
    let jsonResult;
    if (response.content && response.content.length > 0) {
      // Get the first content block - could be text or other block type
      const firstContent = response.content[0];
      // Extract the text regardless of block type
      let contentText = '';
      
      if ('text' in firstContent) {
        // It's a text block
        contentText = firstContent.text;
      } else {
        // Handle other types or convert to string
        contentText = JSON.stringify(firstContent);
      }
      
      // Find JSON object in the response text
      const jsonStartIndex = contentText.indexOf('{');
      const jsonEndIndex = contentText.lastIndexOf('}') + 1;
      
      if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
        const jsonString = contentText.substring(jsonStartIndex, jsonEndIndex);
        try {
          jsonResult = JSON.parse(jsonString);
        } catch (e) {
          console.error('Failed to parse JSON from Anthropic response:', e);
          // Fallback to a basic result
          jsonResult = {
            analysis: 'Failed to parse AI analysis result.',
            fixedTemplate: { ...template },
            recommendations: ['Try again with a clearer error message.']
          };
        }
      } else {
        console.warn('Could not find JSON in Anthropic response');
        jsonResult = {
          analysis: 'The AI did not return a structured analysis.',
          fixedTemplate: { ...template },
          recommendations: ['Check template structure manually.']
        };
      }
    } else {
      console.warn('Anthropic response had no content blocks');
      jsonResult = {
        analysis: 'The AI response was empty.',
        fixedTemplate: { ...template },
        recommendations: ['Try again later.']
      };
    }
    
    return jsonResult;
  } catch (error) {
    console.error('Error analyzing template with Anthropic:', error);
    // Fallback to local analysis if Anthropic fails
    return performLocalAnalysis(template, errorMessage);
  }
}

// Fallback local analysis when Anthropic is not available
function performLocalAnalysis(
  template: Partial<PdfTemplateConfig>,
  errorMessage: string
): Promise<{
  analysis: string;
  fixedTemplate: Partial<PdfTemplateConfig>;
  recommendations: string[];
}> {
  // Start with the current template
  const fixedTemplate = { ...template };
  const recommendations: string[] = [];
  let analysis = 'Performing local analysis without AI assistance.';
  
  // Common problems and fixes
  if (!fixedTemplate.type) {
    fixedTemplate.type = PDF_TEMPLATE_TYPES.STANDARD;
    recommendations.push('Set a valid template type (standard, compact, detailed, etc.)');
  }
  
  if (!fixedTemplate.layout) {
    fixedTemplate.layout = PDF_LAYOUT_TYPES.PORTRAIT;
    recommendations.push('Set a valid layout (portrait or landscape)');
  }
  
  if (fixedTemplate.headerColor && !Array.isArray(fixedTemplate.headerColor)) {
    fixedTemplate.headerColor = [111, 42, 230]; // Default purple
    recommendations.push('Header color should be an RGB array [r, g, b]');
  }
  
  if (fixedTemplate.accentColor && !Array.isArray(fixedTemplate.accentColor)) {
    fixedTemplate.accentColor = [31, 211, 219]; // Default teal
    recommendations.push('Accent color should be an RGB array [r, g, b]');
  }
  
  if (fixedTemplate.securityLevel === SECURITY_LEVELS.CONFIDENTIAL || 
      fixedTemplate.securityLevel === SECURITY_LEVELS.RESTRICTED) {
    if (!fixedTemplate.watermarkText) {
      fixedTemplate.watermarkText = fixedTemplate.securityLevel.toUpperCase();
      recommendations.push(`Added watermark text for ${fixedTemplate.securityLevel} security level`);
    }
    
    if (!fixedTemplate.watermarkOpacity && fixedTemplate.watermarkOpacity !== 0) {
      fixedTemplate.watermarkOpacity = fixedTemplate.securityLevel === SECURITY_LEVELS.CONFIDENTIAL ? 0.15 : 0.12;
      recommendations.push('Set appropriate watermark opacity based on security level');
    }
    
    fixedTemplate.showWatermark = true;
  }
  
  // Check for misconfigured boolean flags
  const booleanFields = [
    'showHeader', 'showFooter', 'showLogo', 'showWatermark',
    'showApprovalFlow', 'showSignatureLines', 'showAttachments', 'showTotalsTable'
  ];
  
  booleanFields.forEach(field => {
    if (fixedTemplate[field as keyof PdfTemplateConfig] === undefined) {
      // @ts-ignore
      fixedTemplate[field] = DEFAULT_TEMPLATES[PDF_TEMPLATE_TYPES.STANDARD][field];
      recommendations.push(`Set ${field} to default value`);
    }
  });
  
  // Check if error message suggests specific issues
  if (errorMessage.includes('color')) {
    analysis += ' The error appears to be related to color configuration.';
    
    if (!fixedTemplate.headerColor) {
      fixedTemplate.headerColor = [111, 42, 230];
      recommendations.push('Added default header color');
    }
    
    if (!fixedTemplate.accentColor) {
      fixedTemplate.accentColor = [31, 211, 219];
      recommendations.push('Added default accent color');
    }
  }
  
  if (errorMessage.includes('watermark') || errorMessage.includes('security')) {
    analysis += ' The error appears to be related to watermark or security level configuration.';
    
    if (!fixedTemplate.securityLevel) {
      fixedTemplate.securityLevel = SECURITY_LEVELS.PUBLIC;
      recommendations.push('Set default security level to PUBLIC');
    }
  }
  
  return Promise.resolve({
    analysis,
    fixedTemplate,
    recommendations
  });
}

export default {
  PDF_TEMPLATE_TYPES,
  PDF_LAYOUT_TYPES,
  SECURITY_LEVELS,
  DEFAULT_TEMPLATES,
  colorToHex,
  hexToRgb,
  saveTemplateConfig,
  getTemplateConfig,
  analyzeTemplateIssue,
};