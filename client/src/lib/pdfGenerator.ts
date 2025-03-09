import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [26, 54, 93]; // #1a365d
  try {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : defaultColor;
  } catch (error) {
    console.error('Error converting hex to RGB:', error);
    return defaultColor;
  }
}

async function addHeader(doc: jsPDF, request: any): Promise<number> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    // Get header height from settings or use default
    let headerHeight = 35;
    if (request?.pdfSettings?.headerHeight) {
      // Convert px to points (assuming 72 points per inch, typical for PDF)
      headerHeight = Math.min(Math.max(request.pdfSettings.headerHeight / 2, 10), 100);
    }
    
    // Get margin from the settings or use default
    const margin = request?.pdfSettings?.marginLeft || 15;
    // Start position at top of page
    const startY = 0;
    
    // Prepare settings with default and override values
    let settings: {
      logo?: string | null;
      headerImage?: string | null;
      headerTitle: string;
      headerSubtitle: string;
      headerColor: string;
      showHeaderText: boolean;
      showHeaderImage: boolean;
      showLogo: boolean;
    } = {
      logo: null,
      headerImage: null,
      headerTitle: "EVENTS & ENTERTAINMENT",
      headerSubtitle: "ENTERPRISES",
      headerColor: "#6F2AE6", // E3 purple
      showHeaderText: true,
      showHeaderImage: true,
      showLogo: true
    };
    
    // Brand colors for E3 (purple to teal gradient)
    const primaryColor = [111, 42, 230]; // E3 purple #6F2AE6
    const accentColor = [31, 211, 219]; // E3 teal #1FD3DB
    
    // First check if settings were passed directly in the request object
    if (request?.pdfSettings) {
      // Override default settings with settings from request
      settings = {
        ...settings,
        logo: request.pdfSettings.logo,
        headerImage: request.pdfSettings.headerImage,
        headerTitle: request.pdfSettings.headerTitle || settings.headerTitle,
        headerSubtitle: request.pdfSettings.headerSubtitle || settings.headerSubtitle,
        headerColor: request.pdfSettings.headerColor || settings.headerColor,
        // Fix visibility issues by checking for explicit boolean values
        showHeaderText: request.pdfSettings.hasOwnProperty('showHeaderText') 
          ? Boolean(request.pdfSettings.showHeaderText) 
          : settings.showHeaderText,
        showHeaderImage: request.pdfSettings.hasOwnProperty('showHeaderImage') 
          ? Boolean(request.pdfSettings.showHeaderImage) 
          : settings.showHeaderImage,
        showLogo: request.pdfSettings.hasOwnProperty('showLogo') 
          ? Boolean(request.pdfSettings.showLogo) 
          : settings.showLogo
      };
    } else {
      // Otherwise fetch from API
      try {
        const response = await fetch('/api/pdf/print-settings');
        if (response.ok) {
          const apiSettings = await response.json();
          settings = {
            ...settings,
            logo: apiSettings.logo,
            headerImage: apiSettings.headerImage,
            headerTitle: apiSettings.headerTitle || settings.headerTitle,
            headerSubtitle: apiSettings.headerSubtitle || settings.headerSubtitle,
            headerColor: apiSettings.headerColor || settings.headerColor,
            // Fix visibility issues by checking for explicit boolean values
            showHeaderText: apiSettings.hasOwnProperty('showHeaderText') 
              ? Boolean(apiSettings.showHeaderText) 
              : settings.showHeaderText,
            showHeaderImage: apiSettings.hasOwnProperty('showHeaderImage') 
              ? Boolean(apiSettings.showHeaderImage) 
              : settings.showHeaderImage,
            showLogo: apiSettings.hasOwnProperty('showLogo') 
              ? Boolean(apiSettings.showLogo) 
              : settings.showLogo
          };
        }
      } catch (settingsError) {
        console.error('Error fetching PDF settings:', settingsError);
      }
    }
    
    // Convert header color from hex to RGB
    let headerColorRgb = primaryColor;
    if (settings.headerColor && settings.headerColor.startsWith("#")) {
      try {
        headerColorRgb = hexToRgb(settings.headerColor);
      } catch (e) {
        console.error('Error converting header color:', e);
      }
    }
    
    // Draw the background for the entire header area at the very top
    doc.setFillColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2], 0.1); // Very light background
    doc.rect(0, startY, pageWidth, headerHeight, 'F');
    
    // Handle logo if explicitly enabled - now positioned at top
    if (settings.showLogo === true) {
      // E3 Logo on left side
      let e3Logo: string = '/uploads/logos/e3-logo.png'; // Default logo path
      
      // Use custom logo if available
      if (settings.logo) {
        e3Logo = settings.logo;
      }
      
      try {
        const img = new Image();
        img.src = e3Logo;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails to load
        });
        
        // Draw the E3 logo on the left side at the top
        const logoSize = Math.min(headerHeight * 0.6, 20);
        const logoY = startY + 5;
        doc.addImage(img, 'PNG', margin, logoY, logoSize, logoSize);
      } catch (logoError) {
        console.error('Error adding E3 logo to PDF:', logoError);
        
        // Create a simple text placeholder if logo fails to load
        doc.setFontSize(16);
        doc.setTextColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2]);
        doc.text("E3", margin + 5, startY + 10);
      }
    }
    
    // Add header text if explicitly enabled - positioned in header area
    if (settings.showHeaderText === true) {
      // Calculate position for header text to appear in the center of header area
      const headerTextY = 15; // Positioned at the top half of the header
      
      // Add company header with appropriate branding colors
      doc.setFontSize(14);
      doc.setTextColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2]);
      doc.text(settings.headerTitle, pageWidth/2, headerTextY, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(settings.headerSubtitle, pageWidth/2, headerTextY + 7, { align: 'center' });
      
      // Add PURCHASE REQUEST text clearly labeled
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0); // Black for visibility
      doc.text("PURCHASE REQUEST", pageWidth/2, headerTextY + 16, { align: 'center' });
    }
    
    // Always add the colored gradient bar (matching E3 brand)
    // Create a gradient bar effect manually at the bottom of the header area
    const gradientY = headerHeight - 3;
    doc.setFillColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2]); // Primary color
    doc.rect(margin, gradientY, pageWidth / 2 - margin, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(pageWidth / 2, gradientY, pageWidth / 2 - margin, 3, 'F');
    
    // Add subtle border line
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, headerHeight + 2, pageWidth - margin, headerHeight + 2);
    
    // Return position for content to start after the header
    return headerHeight + 30;
  } catch (error) {
    console.error("Error rendering PDF header:", error);
    // Continue rendering
    return 40; // Default position in case of error
  }

  // Add request number and date with error handling
  try {
    const pageWidth = doc.internal.pageSize.width;
    const margin = request?.pdfSettings?.marginLeft || 15;
    
    // Get header height from settings or use default
    let headerHeight = 35;
    if (request?.pdfSettings?.headerHeight) {
      // Convert px to points (assuming 72 points per inch, typical for PDF)
      headerHeight = Math.min(Math.max(request.pdfSettings.headerHeight / 2, 10), 100);
    }
    
    // Starting position for request details
    const yPosition = headerHeight + 10; 
    
    // Add request info after header
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Purchase Request #${request?.requestNumber?.replace('PR-', '') || '12345'}`, margin, yPosition);
    
    // Add requester and date on the next row
    doc.setFontSize(9);
    doc.text(`Requester:`, margin, yPosition + 7);
    doc.text(`${request?.requester?.username || 'John Smith'}`, margin + 30, yPosition + 7);
    
    doc.text(`Department:`, pageWidth / 2, yPosition + 7);
    doc.text(`${request?.requester?.department || 'Engineering'}`, pageWidth / 2 + 30, yPosition + 7);
    
    doc.text(`Date:`, margin, yPosition + 14);
    let dateText = 'N/A';
    if (request?.createdAt) {
      try {
        dateText = new Date(request.createdAt).toLocaleDateString();
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
      }
    }
    doc.text(dateText, margin + 30, yPosition + 14);
    
    doc.text(`Status:`, pageWidth / 2, yPosition + 14);
    doc.text(`${request?.status?.charAt(0).toUpperCase() + request?.status?.slice(1) || 'Pending'}`, pageWidth / 2 + 30, yPosition + 14);
    
    // Add a horizontal separator line to create visual distinction
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, yPosition + 18, pageWidth - margin, yPosition + 18);
    
    return yPosition + 25; // Return position after all header elements with additional spacing
  } catch (error) {
    console.error('Error adding request details:', error);
    
    // Get header height from settings or use default in error case
    let headerHeight = 35;
    if (request?.pdfSettings?.headerHeight) {
      headerHeight = Math.min(Math.max(request.pdfSettings.headerHeight / 2, 10), 100);
    }
    return headerHeight + 30; // Return default position after header in case of error
  }
}

async function addFooter(doc: jsPDF, currentPage: number, totalPages: number, request?: any): Promise<void> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Get margin from settings or use default
    const margin = request?.pdfSettings?.marginLeft || 15;
    
    // Get footer height from settings or use default
    let footerHeight = 20;
    if (request?.pdfSettings?.footerHeight) {
      // Convert px to points (assuming 72 points per inch, typical for PDF)
      footerHeight = Math.min(Math.max(request.pdfSettings.footerHeight / 2, 10), 100);
    }
    
    // Position footer exactly at the bottom of the page (subtract 0.1 to avoid cutting off)
    const footerY = pageHeight - footerHeight - 0.1;
    
    // E3 brand colors (matching header)
    const primaryColor = [111, 42, 230]; // E3 purple #6F2AE6
    const accentColor = [31, 211, 219]; // E3 teal #1FD3DB
    const textColor = [50, 50, 50]; // Dark gray for text
    
    // Prepare settings with default and override values
    let settings: {
      footerText: string;
      footerColor: string;
      pageNumbering: boolean;
      footerImage?: string | null;
      showFooterText: boolean;
      showFooterImage: boolean;
      showContactInfo?: boolean;
      contactInfo: {
        phone?: string;
        email?: string;
        website?: string;
        address?: string;
      }
    } = {
      footerText: "ALL RIGHTS RESERVED BY E3",
      footerColor: "#6F2AE6", // E3 purple
      pageNumbering: true,
      footerImage: null,
      showFooterText: true,
      showFooterImage: false,
      contactInfo: {
        phone: "+974 44332340 / 55255417",
        email: "info@e3corp.com",
        website: "www.e3corp.com",
        address: "Floor 36, Office 3602, Palm Tower B, Marina 41, Port Area, P.O.Box 55821, Doha"
      }
    };
    
    // First check if settings were passed directly in the request object
    if (request?.pdfSettings) {
      // Override default settings with settings from request
      settings = {
        ...settings,
        footerText: request.pdfSettings.footerText || settings.footerText,
        footerColor: request.pdfSettings.footerColor || settings.footerColor,
        footerImage: request.pdfSettings.footerImage,
        // Fix visibility issues by checking for explicit boolean values
        showFooterText: request.pdfSettings.hasOwnProperty('showFooterText')
          ? Boolean(request.pdfSettings.showFooterText)
          : settings.showFooterText,
        showFooterImage: request.pdfSettings.hasOwnProperty('showFooterImage')
          ? Boolean(request.pdfSettings.showFooterImage)
          : settings.showFooterImage,
        showContactInfo: request.pdfSettings.hasOwnProperty('showContactInfo')
          ? Boolean(request.pdfSettings.showContactInfo)
          : settings.showContactInfo,
        pageNumbering: request.pdfSettings.hasOwnProperty('pageNumbering')
          ? Boolean(request.pdfSettings.pageNumbering)
          : settings.pageNumbering,
        contactInfo: { 
          ...settings.contactInfo, 
          ...(request.pdfSettings.contactInfo || {}) 
        }
      };
    } else {
      // Otherwise fetch from API
      try {
        const response = await fetch('/api/pdf/print-settings');
        if (response.ok) {
          const apiSettings = await response.json();
          settings = {
            ...settings,
            footerText: apiSettings.footerText || settings.footerText,
            footerColor: apiSettings.footerColor || settings.footerColor,
            footerImage: apiSettings.footerImage,
            // Fix visibility issues by checking for explicit boolean values
            showFooterText: apiSettings.hasOwnProperty('showFooterText')
              ? Boolean(apiSettings.showFooterText)
              : settings.showFooterText,
            showFooterImage: apiSettings.hasOwnProperty('showFooterImage')
              ? Boolean(apiSettings.showFooterImage)
              : settings.showFooterImage,
            showContactInfo: apiSettings.hasOwnProperty('showContactInfo')
              ? Boolean(apiSettings.showContactInfo)
              : settings.showContactInfo,
            pageNumbering: apiSettings.hasOwnProperty('pageNumbering')
              ? Boolean(apiSettings.pageNumbering)
              : settings.pageNumbering,
            contactInfo: { 
              ...settings.contactInfo, 
              ...(apiSettings.contactInfo || {}) 
            }
          };
        }
      } catch (settingsError) {
        console.error('Error fetching PDF settings for footer:', settingsError);
      }
    }
    
    // Convert footer color from hex to RGB if available
    let footerColorRgb = primaryColor;
    if (settings.footerColor && settings.footerColor.startsWith("#")) {
      try {
        footerColorRgb = hexToRgb(settings.footerColor);
      } catch (e) {
        console.error('Error converting footer color:', e);
      }
    }
    
    // Create footer background for the entire footer area
    doc.setFillColor(footerColorRgb[0], footerColorRgb[1], footerColorRgb[2], 0.05); // Very light background
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');
    
    // Draw a line above the footer
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    // Add the colored gradient bar
    doc.setFillColor(footerColorRgb[0], footerColorRgb[1], footerColorRgb[2]); // Primary color 
    doc.rect(margin, footerY + 2, pageWidth/3, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(margin + pageWidth/3, footerY + 2, pageWidth/3, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(margin + 2*pageWidth/3, footerY + 2, pageWidth/3 - margin, 3, 'F');
    
    // Add footer image if explicitly enabled and available
    if (settings.showFooterImage === true && settings.footerImage) {
      try {
        const footerImg = new Image();
        footerImg.src = settings.footerImage;
        await new Promise((resolve) => {
          footerImg.onload = resolve;
          footerImg.onerror = resolve;
        });
        
        // Calculate appropriate dimensions to maintain aspect ratio
        const maxWidth = pageWidth / 3;
        const maxHeight = footerHeight - 5;
        
        let imgWidth = footerImg.width;
        let imgHeight = footerImg.height;
        
        // Scale down if needed while maintaining aspect ratio
        if (imgWidth > maxWidth) {
          const ratio = maxWidth / imgWidth;
          imgWidth = maxWidth;
          imgHeight = imgHeight * ratio;
        }
        
        if (imgHeight > maxHeight) {
          const ratio = maxHeight / imgHeight;
          imgHeight = maxHeight;
          imgWidth = imgWidth * ratio;
        }
        
        // Position image to the right side of the footer
        const xPos = pageWidth - margin - imgWidth;
        doc.addImage(footerImg, 'PNG', xPos, footerY + 3, imgWidth, imgHeight);
      } catch (imgError) {
        console.error('Error adding footer image:', imgError);
      }
    }
    
    // Add contact information in the footer
    const { contactInfo } = settings;
    doc.setFontSize(7);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Add icons and contact info - only if showContactInfo is explicitly enabled
    // Strict boolean check to fix visibility issues
    if (settings.showContactInfo === true && contactInfo) {
      // Left side - Phone and email
      if (contactInfo.phone) {
        doc.text(`☎ ${contactInfo.phone}`, margin, footerY + 10);
      }
      
      if (contactInfo.email) {
        doc.text(`✉ ${contactInfo.email}`, margin, footerY + 14);
      }
      
      if (contactInfo.website) {
        doc.text(`🌐 ${contactInfo.website}`, margin, footerY + 18);
      }
      
      // Right side - Address
      if (contactInfo.address) {
        doc.text(`📍 ${contactInfo.address}`, pageWidth / 2, footerY + 14);
      }
    }
    
    // Add footer text at the very bottom of the page
    if (settings.showFooterText === true) {
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(settings.footerText, margin, pageHeight - 4);
    }
    
    // Add page numbers at the very bottom of the page
    if (settings.pageNumbering === true) {
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
    }
    
    // Remove black line at bottom - no need for a bottom border
    // This prevents the black section appearing at bottom of page
    
  } catch (error) {
    console.error('Error rendering PDF footer:', error);
    // Default footer as fallback
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text("ALL RIGHTS RESERVED BY E3", margin, pageHeight - 4);
    doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
  }
}

function addSection(doc: jsPDF, title: string, yPos: number): number {
  const margin = 15;
  const pageWidth = doc.internal.pageSize.width;
  
  // Create a subtle gradient-like background for section titles
  doc.setFillColor(230, 236, 245); // Matching our table headers
  // Draw rounded rectangle for section header with rounded corners
  const radius = 2;
  const sectionHeight = 8;
  const width = pageWidth - (2 * margin);
  
  // Draw rounded rectangle for a more modern look
  doc.roundedRect(margin, yPos, width, sectionHeight, radius, radius, 'F');
  
  // Add subtle border with a gradient effect
  doc.setDrawColor(200, 210, 240); // Light blue border
  doc.setLineWidth(0.2);
  
  // Draw a highlight accent on left side
  doc.setFillColor(40, 70, 120); // Darker blue that matches our table styling
  doc.rect(margin, yPos, 3, sectionHeight, 'F');
  
  // Add title text with proper styling
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 70, 120); // Match our table headers
  doc.text(title, margin + 6, yPos + 5.5); // Position text vertically centered
  
  return yPos + 12; // Increased spacing after section for better readability
}

/**
 * Generates a detailed PDF for a purchase request
 * @param request The purchase request data
 * @param type The type of PDF to generate (user, approver, admin)
 * @returns jsPDF document
 */
// Handle different layout templates
// Define supported table styles
type TableStyle = 'striped' | 'grid' | 'plain';

interface TemplateConfig {
  orientation: 'portrait' | 'landscape';
  unit: 'mm' | 'pt' | 'in' | 'cm';
  format: 'a4' | 'letter' | 'legal';
  margins: { top: number; right: number; bottom: number; left: number };
  tableStyle: TableStyle;
  showBasicInfo: boolean;
  showRequesterDetails: boolean;
  showDateOfRequest: boolean;
  showPurposeInfo: boolean;
  showVendorDetails: boolean;
  showItems: boolean;
  showApprovals: boolean;
  showAttachments: boolean;
  showAuditInfo: boolean;
  showSignatures: boolean;
  fontFamily: string;
}

function getTemplateConfig(templateId: string = 'standard'): TemplateConfig {
  // Default configuration
  const defaultConfig: TemplateConfig = {
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    tableStyle: 'striped' as 'striped' | 'grid' | 'plain', // Cast to fix LSP errors
    showBasicInfo: true,
    showRequesterDetails: true,
    showDateOfRequest: true,
    showPurposeInfo: true,
    showVendorDetails: true,
    showItems: true,
    showApprovals: true,
    showAttachments: true,
    showAuditInfo: true,
    showSignatures: true,
    fontFamily: 'helvetica'
  };
  
  // Template-specific configurations
  switch (templateId) {
    case 'compact':
      return {
        ...defaultConfig,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        tableStyle: 'plain' // Changed from 'minimal' to valid 'plain'
      };
    case 'detailed':
      return {
        ...defaultConfig,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        tableStyle: 'grid'
      };
    case 'minimal':
      return {
        ...defaultConfig,
        margins: { top: 15, right: 15, bottom: 15, left: 15 },
        tableStyle: 'plain',
        showAuditInfo: false
      };
    default:
      return defaultConfig;
  }
}

export async function generateRequestPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user') {
  try {
    // Get template configuration
    const templateId = request?.pdfSettings?.templateMode || 'standard';
    let templateConfig = getTemplateConfig(templateId);
    
    // Override template config with settings from request if available
    if (request?.pdfSettings) {
      // Document section visibility - use strict boolean checks
      if (request.pdfSettings.hasOwnProperty('showBasicInfo')) 
        templateConfig.showBasicInfo = Boolean(request.pdfSettings.showBasicInfo);
      if (request.pdfSettings.hasOwnProperty('showRequesterDetails')) 
        templateConfig.showRequesterDetails = Boolean(request.pdfSettings.showRequesterDetails);
      if (request.pdfSettings.hasOwnProperty('showDateOfRequest')) 
        templateConfig.showDateOfRequest = Boolean(request.pdfSettings.showDateOfRequest);
      if (request.pdfSettings.hasOwnProperty('showPurposeInfo')) 
        templateConfig.showPurposeInfo = Boolean(request.pdfSettings.showPurposeInfo);
      if (request.pdfSettings.hasOwnProperty('showVendorDetails')) 
        templateConfig.showVendorDetails = Boolean(request.pdfSettings.showVendorDetails);
      if (request.pdfSettings.hasOwnProperty('showItems')) 
        templateConfig.showItems = Boolean(request.pdfSettings.showItems);
      if (request.pdfSettings.hasOwnProperty('showApprovals')) 
        templateConfig.showApprovals = Boolean(request.pdfSettings.showApprovals);
      if (request.pdfSettings.hasOwnProperty('showAttachments')) 
        templateConfig.showAttachments = Boolean(request.pdfSettings.showAttachments);
      if (request.pdfSettings.hasOwnProperty('showAuditInfo')) 
        templateConfig.showAuditInfo = Boolean(request.pdfSettings.showAuditInfo);
      if (request.pdfSettings.hasOwnProperty('showSignatures')) 
        templateConfig.showSignatures = Boolean(request.pdfSettings.showSignatures);
        
      // Document appearance
      if (request.pdfSettings.orientation) 
        templateConfig.orientation = request.pdfSettings.orientation;
      if (request.pdfSettings.tableStyle) 
        templateConfig.tableStyle = request.pdfSettings.tableStyle;
      if (request.pdfSettings.fontFamily) 
        templateConfig.fontFamily = request.pdfSettings.fontFamily;
      
      // Margins
      if (request.pdfSettings.marginTop || request.pdfSettings.marginTop === 0)
        templateConfig.margins.top = request.pdfSettings.marginTop;
      if (request.pdfSettings.marginRight || request.pdfSettings.marginRight === 0)
        templateConfig.margins.right = request.pdfSettings.marginRight;
      if (request.pdfSettings.marginBottom || request.pdfSettings.marginBottom === 0)
        templateConfig.margins.bottom = request.pdfSettings.marginBottom;
      if (request.pdfSettings.marginLeft || request.pdfSettings.marginLeft === 0)
        templateConfig.margins.left = request.pdfSettings.marginLeft;
    }
    
    // Create PDF with template configuration
    const doc = new jsPDF({
      orientation: templateConfig.orientation,
      unit: templateConfig.unit,
      format: templateConfig.format,
    });

    // Use margins from template configuration
    const margin = templateConfig.margins.left;
    
    // Set font family from template configuration
    doc.setFont(templateConfig.fontFamily);
    
    let yPos = await addHeader(doc, request);

    // Type casting for jspdf-autotable styles to avoid TypeScript errors
    const boldStyle = { fontStyle: 'bold' as 'bold', cellWidth: 25 };
    
    // Basic Information Section
    if (templateConfig.showBasicInfo === true) {
      yPos = addSection(doc, "Basic Information", yPos);
      
      const basicInfo = [
        [
          { content: 'Title:', styles: boldStyle },
          { content: request.title || 'N/A', colSpan: 3 }
        ],
        [
          { content: 'Status:', styles: boldStyle },
          { content: request.status?.toUpperCase() || 'N/A', cellWidth: 35 },
          { content: 'Priority:', styles: boldStyle },
          { content: request.priority?.toUpperCase() || 'N/A' }
        ],
      ];

      autoTable(doc, {
        startY: yPos,
        body: basicInfo,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 2;

      // Description Section (separate to allow more space)
      const description = [
        [
          { content: 'Description:', styles: boldStyle },
          { content: request.description || 'N/A' }
        ]
      ];

      autoTable(doc, {
        startY: yPos,
        body: description,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', minCellHeight: 10 },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Requester Details Section
    if (templateConfig.showRequesterDetails === true) {
      yPos = addSection(doc, "Requester Details", yPos);
      
      const requesterInfo = [
        [
          { content: 'Name:', styles: boldStyle },
          { content: request.requester?.username || 'N/A', cellWidth: 35 },
          { content: 'Department:', styles: boldStyle },
          { content: request.requester?.department || 'N/A' }
        ],
        [
          { content: 'Email:', styles: boldStyle },
          { content: request.requester?.email || 'N/A', cellWidth: 35 },
          { content: 'Contact:', styles: boldStyle },
          { content: request.requester?.contactNumber || 'N/A' }
        ]
      ];

      autoTable(doc, {
        startY: yPos,
        body: requesterInfo,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Date of Request Section
    if (templateConfig.showDateOfRequest === true) {
      let createdDate = 'N/A';
      let updatedDate = 'N/A';
      
      try {
        createdDate = request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A';
        updatedDate = request.updatedAt ? new Date(request.updatedAt).toLocaleDateString() : 'N/A';
      } catch (error) {
        console.error('Error formatting dates:', error);
        createdDate = 'Date error';
        updatedDate = 'Date error';
      }
      
      yPos = addSection(doc, "Date Information", yPos);
      
      autoTable(doc, {
        startY: yPos,
        body: [
          [
            { content: 'Created On:', styles: boldStyle },
            createdDate,
            { content: 'Last Updated:', styles: boldStyle },
            updatedDate
          ]
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    // Purpose Information Section
    if (templateConfig.showPurposeInfo === true) {
      yPos = addSection(doc, "Purpose Information", yPos);
      
      const purposeType = request.purposeType || 'N/A';
      const subPurpose = request.subPurpose?.name || 'N/A';
      
      autoTable(doc, {
        startY: yPos,
        body: [
          [
            { content: 'Purpose Type:', styles: boldStyle },
            purposeType,
            { content: 'Sub-purpose:', styles: boldStyle },
            subPurpose
          ]
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    // Vendor Information Section
    if (templateConfig.showVendorDetails === true) {
      yPos = addSection(doc, "Vendor Information", yPos);
      
      // Safely extract vendor information - handle field name differences in data structure
      const vendor = request.vendor || {};
      const vendorName = vendor.name || vendor.companyName || 'N/A';
      const contactPerson = vendor.contactPerson || 'N/A';
      const vendorEmail = vendor.email || 'N/A';
      const vendorPhone = vendor.phone || vendor.contactNumber || 'N/A';
      
      autoTable(doc, {
        startY: yPos,
        body: [
          [
            { content: 'Vendor Name:', styles: boldStyle },
            vendorName,
            { content: 'Contact Person:', styles: boldStyle },
            contactPerson
          ],
          [
            { content: 'Email:', styles: boldStyle },
            vendorEmail,
            { content: 'Phone:', styles: boldStyle },
            vendorPhone
          ]
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    // Items Section
    if (templateConfig.showItems === true) {
      yPos = addSection(doc, "Items", yPos);
      
      // Safely parse items with error handling
      let items = [];
      try {
        if (Array.isArray(request.items)) {
          items = request.items;
        } else if (typeof request.items === 'string') {
          items = JSON.parse(request.items || '[]');
        } else if (request.items) {
          // If it's an object but not an array, wrap it
          items = [request.items];
        }
      } catch (error) {
        console.error('Error parsing items:', error);
        items = []; // Fallback to empty array on error
      }

      // Calculate totals with default values
      const itemsTotal = items.reduce((sum: number, item: any) => 
        sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)), 0
      );
      const freightAmount = Number(request.freightAmount || 0);
      const totalCost = itemsTotal + freightAmount;

      const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: request.currency || 'QAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']],
        body: items.map((item: any) => [
          item.name || 'N/A',
          item.description || 'N/A',
          item.quantity?.toString() || '0',
          formatCurrency(item.estimatedCost || 0),
          formatCurrency((item.quantity || 0) * (item.estimatedCost || 0))
        ]),
        foot: [
          ['', '', '', 'Items Total:', formatCurrency(itemsTotal)],
          ['', '', '', 'Freight:', formatCurrency(freightAmount)],
          ['', '', '', 'Total Cost:', formatCurrency(totalCost)]
        ],
        theme: templateConfig.tableStyle,
        headStyles: {
          fillColor: [230, 236, 245],  // Lighter blue for better contrast
          textColor: [26, 54, 93],     // Dark blue text
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 3               // Increased padding for better readability
        },
        footStyles: {
          fillColor: [235, 240, 250],  // Slightly different shade for footer
          textColor: [40, 40, 40],     // Darker text for emphasis
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 3
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,              // Matching padding for consistency
          overflow: 'linebreak',
          lineColor: [240, 240, 240]   // Lighter grid lines
        },
        alternateRowStyles: {
          fillColor: [248, 250, 253]   // Very light blue for alternate rows
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 15, halign: 'center' },  // Center-align quantity
          3: { cellWidth: 25, halign: 'right' },   // Right-align prices
          4: { cellWidth: 25, halign: 'right' }    // Right-align prices
        },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
          // Add subtle border to the "Total Cost" cell in the footer for emphasis
          if (data.section === 'foot' && data.row.index === 2 && data.column.index === 4) {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    // Attached Documents Section if available
    if (templateConfig.showAttachments === true && request.attachments?.length > 0) {
      yPos = addSection(doc, "Attached Documents", yPos);
      const attachments = request.attachments.map((file: any) => [
        file.fileName || file.name || 'N/A',
        file.fileType || file.type || 'N/A',
        file.fileSize || file.size ? `${((file.fileSize || file.size) / 1024 / 1024).toFixed(2)} MB` : 'N/A'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Document Name', 'Type', 'Size']],
        body: attachments,
        theme: 'striped',
        headStyles: {
          fillColor: [230, 236, 245],  // Match same style as items table
          textColor: [26, 54, 93],
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 3
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: 'linebreak',
          lineColor: [240, 240, 240]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 253]
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 30, halign: 'center' },  // Center-align type
          2: { cellWidth: 25, halign: 'right' }   // Right-align size
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Approvals Section
    if (templateConfig.showApprovals === true && (type === 'approver' || type === 'admin' || request.approvals?.length > 0)) {
      yPos = (doc as any).lastAutoTable?.finalY + 5 || yPos + 5;
      
      // Approvers Section
      yPos = addSection(doc, "Approval Information", yPos);
      
      // Get approvers data
      const approvals = Array.isArray(request.approvals) ? request.approvals : [];
      
      if (approvals.length > 0) {
        // Format approvals for the table
        const approvalRows = approvals.map((approval: any) => [
          approval.approver?.username || 'N/A',
          approval.department || 'N/A',
          approval.status?.toUpperCase() || 'PENDING',
          approval.processedAt ? new Date(approval.processedAt).toLocaleString() : 'Not processed',
          approval.comments || ''
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Approver', 'Department', 'Status', 'Date', 'Comments']],
          body: approvalRows,
          theme: 'striped',
          headStyles: {
            fillColor: [230, 236, 245],  // Match other tables
            textColor: [26, 54, 93],
            fontSize: 9,
            fontStyle: 'bold',
            cellPadding: 3
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 3,
            overflow: 'linebreak',
            lineColor: [240, 240, 240]
          },
          alternateRowStyles: {
            fillColor: [248, 250, 253]
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 30 },
            2: { cellWidth: 25, halign: 'center' },
            3: { cellWidth: 35 },
            4: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin }
        });
      } else {
        autoTable(doc, {
          startY: yPos,
          body: [['No approval information available']],
          theme: 'plain',
          styles: { 
            fontSize: 9, 
            cellPadding: 2, 
            fontStyle: 'italic',
            textColor: [100, 100, 100],
            halign: 'center'
          },
          margin: { left: margin, right: margin }
        });
      }
      
      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Audit Information Section
    if (templateConfig.showAuditInfo === true && (type === 'admin' || request.pdfSettings?.showAuditInfo === true)) {
      yPos = addSection(doc, "Audit Information", yPos);
      
      const auditInfo = [
        ['Created by:', request.requester?.username || 'N/A', 'Created at:', request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'],
        ['Last updated:', request.updatedAt ? new Date(request.updatedAt).toLocaleString() : 'N/A', 'Request ID:', request.id || 'N/A'],
        ['Process Duration:', request.processedAt && request.createdAt ? 
          `${Math.floor((new Date(request.processedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days` : 
          'Not completed', 
          'Approval rounds:', Array.isArray(request.approvals) ? request.approvals.length : 0]
      ];
      
      autoTable(doc, {
        startY: yPos,
        body: auditInfo,
        theme: 'plain',
        styles: { 
          fontSize: 8, 
          cellPadding: 3,
          textColor: [60, 60, 60],
          lineColor: [240, 240, 240]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 253]
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 25, textColor: [40, 70, 120] },
          2: { fontStyle: 'bold', cellWidth: 25, textColor: [40, 70, 120] }
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Digital Signatures Section
    if (templateConfig.showSignatures === true) {
      yPos = addSection(doc, "Digital Signatures", yPos);
      
      // Create signature boxes for key roles
      const signatureHeight = 20;
      const signatureWidth = (doc.internal.pageSize.width - (margin * 2)) / 2 - 5;
      
      // Function to draw a signature box
      const drawSignatureBox = (label: string, x: number, y: number, width: number, height: number) => {
        // Draw a light background fill
        doc.setFillColor(248, 250, 253); // Very light blue background
        doc.rect(x, y, width, height, 'F');
        
        // Draw a light border with rounded corners
        doc.setDrawColor(230, 236, 245); // Light blue border matching our tables
        doc.setLineWidth(0.3);
        
        // Draw rounded rectangle border
        const radius = 1.5;
        doc.roundedRect(x, y, width, height, radius, radius);
        
        // Add label with blue color to match tables
        doc.setFontSize(8);
        doc.setTextColor(40, 70, 120); // Matching the blue from audit table
        doc.setFont(undefined, 'bold');
        doc.text(label, x + 3, y + 5);
        doc.setFont(undefined, 'normal');
        
        // Add signature line
        doc.setDrawColor(200, 210, 230); // Lighter blue for signature line
        doc.setLineWidth(0.5);
        doc.line(x + 5, y + height - 7, x + width - 5, y + height - 7);
        
        // Add 'Date:' text
        doc.setFontSize(7);
        doc.setTextColor(90, 110, 140); // Slightly muted blue
        doc.text('Date:', x + width - 25, y + height - 9);
      };
      
      // Draw signature boxes for requester and approvers
      drawSignatureBox('Requester Signature', margin, yPos, signatureWidth, signatureHeight);
      drawSignatureBox('Final Approver Signature', margin + signatureWidth + 10, yPos, signatureWidth, signatureHeight);
      
      // Draw signature boxes for finance and management if needed
      if (type === 'admin' || request.purposeType === 'Finance') {
        drawSignatureBox('Finance Department', margin, yPos + signatureHeight + 10, signatureWidth, signatureHeight);
        drawSignatureBox('CEO Office / Management', margin + signatureWidth + 10, yPos + signatureHeight + 10, signatureWidth, signatureHeight);
        
        yPos += (signatureHeight * 2) + 15;
      } else {
        yPos += signatureHeight + 5;
      }
    }

    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      await addFooter(doc, i, pageCount, request);
    }

    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}