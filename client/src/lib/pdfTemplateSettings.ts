/**
 * PDF Template Settings
 * 
 * Utility functions and types for managing PDF template settings
 */

import axios from 'axios';

/**
 * PDF Template Settings interface
 */
export interface PdfTemplateSettings {
  id?: number;
  headerTitle: string;
  headerSubtitle?: string;
  headerColor: string;
  footerText?: string;
  footerColor: string;
  pageNumbering: boolean;
  watermarkOpacity: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  fontSize?: number;
  headerHeight?: number;
  footerHeight?: number;
  templateConfig?: string | TemplateConfig;
}

/**
 * Template Configuration interface
 */
export interface TemplateConfig {
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

/**
 * Fetch PDF settings from the server
 */
export async function fetchPdfSettings(): Promise<PdfTemplateSettings> {
  try {
    const response = await axios.get('/api/pdf/print-settings');
    
    // If no settings are found, return defaults
    if (!response.data || !response.data.settings) {
      return getDefaultSettings();
    }
    
    // Parse the templateConfig if it's a string
    const settings = response.data.settings;
    if (settings.templateConfig && typeof settings.templateConfig === 'string') {
      try {
        settings.templateConfig = JSON.parse(settings.templateConfig);
      } catch (e) {
        console.error('Failed to parse template config', e);
        settings.templateConfig = getDefaultTemplateConfig();
      }
    }
    
    return settings;
  } catch (error) {
    console.error('Failed to fetch PDF settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Save PDF settings to the server
 */
export async function savePdfSettings(settings: PdfTemplateSettings): Promise<PdfTemplateSettings> {
  try {
    // Ensure templateConfig is properly formatted
    const dataToSave = {
      ...settings,
      templateConfig: typeof settings.templateConfig === 'object' 
        ? JSON.stringify(settings.templateConfig)
        : settings.templateConfig
    };
    
    const response = await axios.post('/api/pdf/settings', dataToSave);
    return response.data.settings;
  } catch (error) {
    console.error('Failed to save PDF settings:', error);
    throw error;
  }
}

/**
 * Get default PDF settings
 */
export function getDefaultSettings(): PdfTemplateSettings {
  return {
    headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
    headerSubtitle: 'PURCHASE REQUEST',
    headerColor: '#6F2AE6',
    footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
    footerColor: '#6F2AE6',
    pageNumbering: true,
    watermarkOpacity: 10,
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 25,
    fontSize: 11,
    headerHeight: 40,
    footerHeight: 20,
    templateConfig: JSON.stringify(getDefaultTemplateConfig())
  };
}

/**
 * Get default template configuration
 */
export function getDefaultTemplateConfig(): TemplateConfig {
  return {
    name: 'Standard',
    type: 'purchase_request',
    layout: 'portrait',
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: true,
    securityLevel: 'internal',
    headerColor: [111/255, 42/255, 230/255],
    accentColor: [31/255, 211/255, 219/255],
    watermarkOpacity: 0.08,
    watermarkText: 'INTERNAL USE',
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true,
    customFields: {
      showVendorDetails: true,
      showRequestDate: true,
      showDepartment: true,
      showRequesterId: true
    }
  };
}

/**
 * Convert hex color to RGB array
 */
export function hexToRgb(hex: string): [number, number, number] {
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  return [r, g, b];
}

/**
 * Convert RGB array to hex color
 */
export function rgbToHex(rgb: [number, number, number]): string {
  // Convert normalized values back to 0-255 range
  const r = Math.round(rgb[0] * 255);
  const g = Math.round(rgb[1] * 255);
  const b = Math.round(rgb[2] * 255);
  
  // Convert to hex and ensure two digits
  const toHex = (c: number) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Apply security level settings to template config
 */
export function applySecuritySettings(config: TemplateConfig, securityLevel: string): TemplateConfig {
  const newConfig = { ...config, securityLevel };
  
  switch (securityLevel) {
    case 'public':
      newConfig.showWatermark = false;
      newConfig.watermarkText = '';
      break;
      
    case 'internal':
      newConfig.showWatermark = true;
      newConfig.watermarkText = 'INTERNAL USE';
      newConfig.watermarkOpacity = 0.08;
      break;
      
    case 'confidential':
      newConfig.showWatermark = true;
      newConfig.watermarkText = 'CONFIDENTIAL';
      newConfig.watermarkOpacity = 0.12;
      break;
      
    default:
      break;
  }
  
  return newConfig;
}