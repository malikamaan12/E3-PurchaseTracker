/**
 * PDF Template Settings Utilities
 * 
 * This file provides utilities for working with PDF template settings,
 * focusing on fixing issues with:
 * - Header titles not displaying
 * - Watermark functionality
 * - Content/section visibility
 * - Settings saving
 * - Footer content
 */

import axios from 'axios';

/**
 * RGB color tuple type
 */
export type RGBColor = [number, number, number];

/**
 * PDF Template Configuration
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
  headerImage?: string;
  footerImage?: string;
  logo?: string;
  loginLogo?: string;
  headerHeight?: number;
  footerHeight?: number;
  templateConfig?: string | any;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Template Configuration
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
  headerColor?: RGBColor;
  accentColor?: RGBColor;
  watermarkOpacity?: number;
  watermarkText?: string;
  showApprovalFlow?: boolean;
  showSignatureLines?: boolean;
  showAttachments?: boolean;
  showTotalsTable?: boolean;
  customFields?: Record<string, boolean>;
}

/**
 * Convert hex color to RGB array
 */
export function hexToRgb(hex: string): RGBColor {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex value to RGB
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  
  // Normalize to 0-1 range for PDF libraries
  return [r/255, g/255, b/255];
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(rgb: RGBColor): string {
  // Convert normalized 0-1 values to 0-255 range
  const r = Math.round(rgb[0] * 255);
  const g = Math.round(rgb[1] * 255);
  const b = Math.round(rgb[2] * 255);
  
  // Convert to hex
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Ensure RGB color is valid
 */
export function ensureValidRgbColor(color: any): RGBColor {
  // Default color if invalid
  const defaultColor: RGBColor = [0.4, 0.16, 0.9]; // E3 purple in 0-1 range
  
  if (!color) return defaultColor;
  
  // If it's already a valid RGB array
  if (Array.isArray(color) && color.length === 3) {
    // Ensure values are in 0-1 range
    const validatedColor: RGBColor = [
      Math.min(Math.max(Number(color[0]), 0), 1),
      Math.min(Math.max(Number(color[1]), 0), 1),
      Math.min(Math.max(Number(color[2]), 0), 1)
    ];
    return validatedColor;
  }
  
  // If it's a hex string, convert to RGB
  if (typeof color === 'string' && color.startsWith('#')) {
    try {
      return hexToRgb(color);
    } catch (e) {
      console.error('Error converting hex to RGB:', e);
      return defaultColor;
    }
  }
  
  return defaultColor;
}

/**
 * Get default template configuration
 */
export function getDefaultTemplateConfig(): TemplateConfig {
  return {
    name: 'Standard Template',
    type: 'standard',
    layout: 'portrait',
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: true,
    securityLevel: 'internal',
    headerColor: [111/255, 42/255, 230/255], // E3 purple
    accentColor: [31/255, 211/255, 219/255], // E3 teal
    watermarkOpacity: 0.08,
    watermarkText: 'INTERNAL USE',
    showApprovalFlow: true,
    showSignatureLines: true,
    showAttachments: true,
    showTotalsTable: true,
    customFields: {}
  };
}

/**
 * Fetch PDF settings from the server
 */
export async function fetchPdfSettings(): Promise<PdfTemplateSettings> {
  try {
    const response = await axios.get('/api/pdf/print-settings');
    
    if (response.status === 200) {
      const settings = response.data;
      
      // Process templateConfig if it exists
      if (settings.templateConfig) {
        // If templateConfig is a string, parse it
        if (typeof settings.templateConfig === 'string') {
          try {
            settings.templateConfig = JSON.parse(settings.templateConfig);
          } catch (e) {
            console.error('Error parsing template config:', e);
            settings.templateConfig = getDefaultTemplateConfig();
          }
        }
      } else {
        // Set default template config if missing
        settings.templateConfig = getDefaultTemplateConfig();
      }
      
      return settings;
    }
    
    throw new Error('Failed to fetch PDF settings');
  } catch (error) {
    console.error('Error fetching PDF settings:', error);
    // Return default settings on error
    return {
      headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
      headerSubtitle: 'PURCHASE REQUEST',
      headerColor: '#6F2AE6', // Purple
      footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
      footerColor: '#6F2AE6',
      pageNumbering: true,
      watermarkOpacity: 10,
      templateConfig: getDefaultTemplateConfig()
    };
  }
}

/**
 * Save PDF settings to the server
 */
export async function savePdfSettings(settings: PdfTemplateSettings): Promise<PdfTemplateSettings> {
  try {
    // Ensure templateConfig is stringified if it's an object
    const settingsToSave = { ...settings };
    
    if (settingsToSave.templateConfig && typeof settingsToSave.templateConfig !== 'string') {
      settingsToSave.templateConfig = JSON.stringify(settingsToSave.templateConfig);
    }
    
    const response = await axios.post('/api/pdf/settings', settingsToSave);
    
    if (response.status === 200 || response.status === 201) {
      const savedSettings = response.data;
      
      // Process templateConfig if it exists
      if (savedSettings.templateConfig) {
        // If templateConfig is a string, parse it
        if (typeof savedSettings.templateConfig === 'string') {
          try {
            savedSettings.templateConfig = JSON.parse(savedSettings.templateConfig);
          } catch (e) {
            console.error('Error parsing saved template config:', e);
          }
        }
      }
      
      return savedSettings;
    }
    
    throw new Error('Failed to save PDF settings');
  } catch (error) {
    console.error('Error saving PDF settings:', error);
    throw error;
  }
}

/**
 * Save template configuration
 */
export async function saveTemplateConfig(config: TemplateConfig): Promise<TemplateConfig> {
  try {
    const response = await axios.post('/api/pdf/settings', {
      type: 'template',
      templateConfig: config
    });
    
    if (response.status === 200 || response.status === 201) {
      return response.data.templateConfig || config;
    }
    
    throw new Error('Failed to save template configuration');
  } catch (error) {
    console.error('Error saving template configuration:', error);
    throw error;
  }
}

/**
 * Apply watermark settings to PDF document
 */
export function applyWatermarkSettings(
  doc: any,
  settings: PdfTemplateSettings,
  text?: string
): void {
  try {
    // Extract template config
    const templateConfig = typeof settings.templateConfig === 'string'
      ? JSON.parse(settings.templateConfig)
      : settings.templateConfig || getDefaultTemplateConfig();
    
    // Check if watermark is enabled
    if (!templateConfig.showWatermark) {
      return;
    }
    
    const pageCount = doc.getNumberOfPages();
    
    // Get watermark text and opacity
    const watermarkText = text || templateConfig.watermarkText || 'CONFIDENTIAL';
    const opacity = (templateConfig.watermarkOpacity !== undefined)
      ? templateConfig.watermarkOpacity
      : (settings.watermarkOpacity ? settings.watermarkOpacity / 100 : 0.08);
    
    // Apply to all pages
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Save current state
      doc.saveGraphicsState();
      
      // Set watermark properties
      doc.setTextColor(0, 0, 0);
      doc.setGState(new doc.GState({ opacity }));
      doc.setFontSize(30);
      doc.setFont('helvetica', 'bold');
      
      // Rotate and position watermark
      doc.translate(pageWidth / 2, pageHeight / 2);
      doc.rotate(-45);
      doc.text(watermarkText, 0, 0, { align: 'center' });
      
      // Restore state
      doc.restoreGraphicsState();
    }
  } catch (error) {
    console.error('Error applying watermark settings:', error);
  }
}

/**
 * Apply header settings to PDF document
 */
export function applyHeaderSettings(
  doc: any,
  settings: PdfTemplateSettings
): number {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Extract template config
    const templateConfig = typeof settings.templateConfig === 'string'
      ? JSON.parse(settings.templateConfig)
      : settings.templateConfig || getDefaultTemplateConfig();
    
    // Check if header is enabled
    if (!templateConfig.showHeader) {
      return 20; // Return a safe starting position
    }
    
    // Default E3 colors
    const defaultPrimaryColor: RGBColor = [111/255, 42/255, 230/255]; // E3 purple
    const defaultAccentColor: RGBColor = [31/255, 211/255, 219/255]; // E3 teal
    
    // Get header colors from settings or use defaults
    const headerColor = settings.headerColor
      ? hexToRgb(settings.headerColor)
      : defaultPrimaryColor;
    
    // Get accent color from template or use default
    const accentColor = templateConfig.accentColor || defaultAccentColor;
    
    // Start position at top of page
    const startY = 15;
    
    // Get header height from settings or use default
    const headerHeight = settings.headerHeight || 30;
    
    // Get margins from settings or use default
    const margin = settings.marginLeft || 15;
    
    // Add header background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, headerHeight + 20, 'F');
    
    // Add header
    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2], 0.1);
    doc.roundedRect(margin, startY, pageWidth - (2 * margin), headerHeight, 2, 2, 'F');
    
    // Add company logo if available
    if (settings.logo) {
      try {
        // Load logo
        const img = new Image();
        img.src = settings.logo;
        
        // Calculate correct aspect ratio
        const imgWidth = 40;
        const imgHeight = 20;
        
        // Add the image
        doc.addImage(img, 'PNG', margin + 5, startY + 5, imgWidth, imgHeight);
      } catch (logoError) {
        console.error('Error adding logo:', logoError);
        
        // Draw a simple logo placeholder
        doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
        doc.roundedRect(margin + 5, startY + 5, 40, 20, 2, 2, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('E3', margin + 25, startY + 15, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
    }
    
    // Add header text
    const headerX = margin + 50;
    const headerY = startY + 15;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(headerColor[0] * 255, headerColor[1] * 255, headerColor[2] * 255);
    doc.text(settings.headerTitle, headerX, headerY);
    
    if (settings.headerSubtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(settings.headerSubtitle, headerX, headerY + 7);
    }
    
    // Add accent bar
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.roundedRect(margin, startY + headerHeight - 3, pageWidth - (2 * margin), 3, 1, 1, 'F');
    
    // Return position after header
    return startY + headerHeight + 10;
  } catch (error) {
    console.error('Error applying header settings:', error);
    return 20; // Return a safe starting position
  }
}

/**
 * Apply footer settings to PDF document
 */
export function applyFooterSettings(
  doc: any,
  settings: PdfTemplateSettings,
  currentPage: number,
  totalPages: number
): void {
  try {
    // Extract template config
    const templateConfig = typeof settings.templateConfig === 'string'
      ? JSON.parse(settings.templateConfig)
      : settings.templateConfig || getDefaultTemplateConfig();
    
    // Check if footer is enabled
    if (!templateConfig.showFooter) {
      return;
    }
    
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Default E3 colors
    const defaultPrimaryColor: RGBColor = [111/255, 42/255, 230/255]; // E3 purple
    
    // Get footer color from settings or use default
    const footerColor = settings.footerColor
      ? hexToRgb(settings.footerColor)
      : defaultPrimaryColor;
    
    // Get margins from settings or use default
    const margin = settings.marginLeft || 15;
    
    // Get footer height from settings or use default
    const footerHeight = settings.footerHeight || 15;
    
    // Footer position
    const footerY = pageHeight - footerHeight - 5;
    
    // Add footer background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, footerY - 2, pageWidth, footerHeight + 7, 'F');
    
    // Add footer text
    if (settings.footerText) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(settings.footerText, margin, footerY + 5);
    }
    
    // Add page numbers if enabled
    if (settings.pageNumbering) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, footerY + 5, { align: 'right' });
    }
    
    // Add footer line
    doc.setDrawColor(footerColor[0] * 255, footerColor[1] * 255, footerColor[2] * 255);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);
  } catch (error) {
    console.error('Error applying footer settings:', error);
  }
}

/**
 * Get section visibility from template config
 */
export function getSectionVisibility(
  settings: PdfTemplateSettings,
  sectionName: string
): boolean {
  try {
    // Extract template config
    const templateConfig = typeof settings.templateConfig === 'string'
      ? JSON.parse(settings.templateConfig)
      : settings.templateConfig || getDefaultTemplateConfig();
    
    const sectionKey = `show${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}`;
    
    // Check if section visibility is explicitly defined
    if (templateConfig[sectionKey] !== undefined) {
      return Boolean(templateConfig[sectionKey]);
    }
    
    // Default visibility for known sections
    const defaults: Record<string, boolean> = {
      Header: true,
      Footer: true,
      ApprovalFlow: true,
      SignatureLines: true,
      Attachments: true,
      TotalsTable: true,
      Watermark: true,
      Logo: true,
    };
    
    return defaults[sectionName] !== undefined ? defaults[sectionName] : true;
  } catch (error) {
    console.error(`Error getting visibility for section ${sectionName}:`, error);
    return true; // Default to showing the section on error
  }
}

/**
 * Format PDF settings for debugging
 */
export function debugPdfSettings(settings: PdfTemplateSettings): string {
  try {
    const debugInfo = {
      headerTitle: settings.headerTitle,
      headerSubtitle: settings.headerSubtitle,
      headerColor: settings.headerColor,
      footerText: settings.footerText,
      footerColor: settings.footerColor,
      pageNumbering: settings.pageNumbering,
      watermarkOpacity: settings.watermarkOpacity,
      hasLogo: Boolean(settings.logo),
      hasHeaderImage: Boolean(settings.headerImage),
      hasFooterImage: Boolean(settings.footerImage),
      templateConfig: typeof settings.templateConfig === 'string'
        ? JSON.parse(settings.templateConfig)
        : settings.templateConfig
    };
    
    return JSON.stringify(debugInfo, null, 2);
  } catch (error) {
    console.error('Error formatting PDF settings for debug:', error);
    return 'Error formatting settings for debug';
  }
}