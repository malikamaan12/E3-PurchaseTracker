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
    const headerHeight = 35; 
    
    // Get margin from the settings or use default
    const margin = request?.pdfSettings?.marginLeft || 15;
    
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
    if (request.pdfSettings) {
      // Override default settings with settings from request
      settings = {
        ...settings,
        logo: request.pdfSettings.logo,
        headerImage: request.pdfSettings.headerImage,
        headerTitle: request.pdfSettings.headerTitle || settings.headerTitle,
        headerSubtitle: request.pdfSettings.headerSubtitle || settings.headerSubtitle,
        headerColor: request.pdfSettings.headerColor || settings.headerColor,
        showHeaderText: request.pdfSettings.showHeaderText !== false,
        showHeaderImage: request.pdfSettings.showHeaderImage !== false,
        showLogo: request.pdfSettings.showLogo !== false
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
            showHeaderText: apiSettings.showHeaderText !== false,
            showHeaderImage: apiSettings.showHeaderImage !== false,
            showLogo: apiSettings.showLogo !== false
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
    
    // Handle logo if enabled
    if (settings.showLogo) {
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
        
        // Draw the E3 logo on the left side
        doc.addImage(img, 'PNG', margin, 10, 20, 20);
      } catch (logoError) {
        console.error('Error adding E3 logo to PDF:', logoError);
        
        // Create a simple text placeholder if logo fails to load
        doc.setFontSize(16);
        doc.setTextColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2]);
        doc.text("E3", margin + 5, 20);
      }
    }
    
    // Add header text if enabled
    if (settings.showHeaderText) {
      // Add company header with appropriate branding colors
      doc.setFontSize(14);
      doc.setTextColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2]);
      doc.text(settings.headerTitle, pageWidth/2, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(settings.headerSubtitle, pageWidth/2, 22, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text("PURCHASE REQUEST", pageWidth/2, 29, { align: 'center' });
    }
    
    // Add the colored gradient bar (matching E3 brand)
    // Create a gradient bar effect manually since PDF doesn't support CSS gradients
    doc.setFillColor(headerColorRgb[0], headerColorRgb[1], headerColorRgb[2]); // Primary color
    doc.rect(margin, 33, pageWidth / 2 - margin, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(pageWidth / 2, 33, pageWidth / 2 - margin, 3, 'F');
    
    // Add subtle border line
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, 38, pageWidth - margin, 38);
    
    // Add header image if enabled and available
    if (settings.showHeaderImage && settings.headerImage) {
      try {
        const headerImg = new Image();
        headerImg.src = settings.headerImage;
        await new Promise((resolve) => {
          headerImg.onload = resolve;
          headerImg.onerror = resolve;
        });
        
        // Calculate appropriate dimensions to maintain aspect ratio
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = 30; // Maximum height for header image
        
        let imgWidth = headerImg.width;
        let imgHeight = headerImg.height;
        
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
        
        // Position image centered horizontally under the colored bar
        const xPos = (pageWidth - imgWidth) / 2;
        doc.addImage(headerImg, 'PNG', xPos, 40, imgWidth, imgHeight);
        
        // Adjust return position based on image height
        return 45 + imgHeight;
      } catch (imgError) {
        console.error('Error adding header image:', imgError);
      }
    }
  } catch (error) {
    console.error("Error rendering PDF header:", error);
    // Continue rendering
  }

  // Add request number and date with error handling
  try {
    const pageWidth = doc.internal.pageSize.width;
    const margin = request?.pdfSettings?.marginLeft || 15;
    
    // Add request info after header
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Purchase Request #${request?.requestNumber?.replace('PR-', '') || '12345'}`, margin, 45);
    
    // Add requester and date on the next row
    doc.setFontSize(9);
    doc.text(`Requester:`, margin, 52);
    doc.text(`${request?.requester?.username || 'John Smith'}`, margin + 30, 52);
    
    doc.text(`Department:`, pageWidth / 2, 52);
    doc.text(`${request?.requester?.department || 'Engineering'}`, pageWidth / 2 + 30, 52);
    
    doc.text(`Date:`, margin, 59);
    let dateText = 'N/A';
    if (request?.createdAt) {
      try {
        dateText = new Date(request.createdAt).toLocaleDateString();
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
      }
    }
    doc.text(dateText, margin + 30, 59);
    
    doc.text(`Status:`, pageWidth / 2, 59);
    doc.text(`${request?.status?.charAt(0).toUpperCase() + request?.status?.slice(1) || 'Pending'}`, pageWidth / 2 + 30, 59);
    
    return 65; // Return position after all header elements
  } catch (error) {
    console.error('Error adding request details:', error);
    return 40; // Return default header height
  }
}

async function addFooter(doc: jsPDF, currentPage: number, totalPages: number, request?: any): Promise<void> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Get margin from settings or use default
    const margin = request?.pdfSettings?.marginLeft || 15;
    const footerHeight = 20;
    
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
        showFooterText: request.pdfSettings.showFooterText !== false,
        showFooterImage: request.pdfSettings.showFooterImage === true,
        showContactInfo: request.pdfSettings.showContactInfo !== false,
        pageNumbering: request.pdfSettings.pageNumbering !== false,
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
            showFooterText: apiSettings.showFooterText !== false,
            showFooterImage: apiSettings.showFooterImage === true,
            showContactInfo: apiSettings.showContactInfo !== false,
            pageNumbering: apiSettings.pageNumbering !== false,
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
    
    // Draw gradient bar at the bottom (similar to header)
    // Add a line above the footer
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);
    
    // Add the colored gradient bar
    doc.setFillColor(footerColorRgb[0], footerColorRgb[1], footerColorRgb[2]); // Primary color 
    doc.rect(margin, pageHeight - footerHeight + 2, pageWidth/3, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(margin + pageWidth/3, pageHeight - footerHeight + 2, pageWidth/3, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(margin + 2*pageWidth/3, pageHeight - footerHeight + 2, pageWidth/3 - margin, 3, 'F');
    
    // Add footer image if enabled and available
    if (settings.showFooterImage && settings.footerImage) {
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
        doc.addImage(footerImg, 'PNG', xPos, pageHeight - footerHeight + 3, imgWidth, imgHeight);
      } catch (imgError) {
        console.error('Error adding footer image:', imgError);
      }
    }
    
    // Add contact information in the footer
    const { contactInfo } = settings;
    doc.setFontSize(7);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Add icons and contact info - only if showContactInfo is enabled 
    // Type assertion to avoid TypeScript errors
    const showContactInfo = 'showContactInfo' in settings ? settings.showContactInfo : true;
    if (showContactInfo !== false && contactInfo) {
      // Left side - Phone and email
      if (contactInfo.phone) {
        doc.text(`☎ ${contactInfo.phone}`, margin, pageHeight - footerHeight + 10);
      }
      
      if (contactInfo.email) {
        doc.text(`✉ ${contactInfo.email}`, margin, pageHeight - footerHeight + 14);
      }
      
      if (contactInfo.website) {
        doc.text(`🌐 ${contactInfo.website}`, margin, pageHeight - footerHeight + 18);
      }
      
      // Right side - Address
      if (contactInfo.address) {
        doc.text(`📍 ${contactInfo.address}`, pageWidth / 2, pageHeight - footerHeight + 14);
      }
    }
    
    // Add footer text if enabled
    if (settings.showFooterText) {
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(settings.footerText, margin, pageHeight - 5);
    }
    
    // Add page numbers if enabled
    if (settings.pageNumbering) {
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }
  } catch (error) {
    console.error('Error rendering PDF footer:', error);
    // Default footer as fallback
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text("ALL RIGHTS RESERVED BY E3", margin, pageHeight - 5);
    doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
}

function addSection(doc: jsPDF, title: string, yPos: number): number {
  const margin = 15;
  doc.setFillColor(247, 248, 250);
  doc.rect(margin, yPos, doc.internal.pageSize.width - (2 * margin), 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 54, 93);
  doc.text(title, margin + 2, yPos + 4.5);

  return yPos + 8;
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
      // Document section visibility
      if (request.pdfSettings.hasOwnProperty('showBasicInfo')) 
        templateConfig.showBasicInfo = request.pdfSettings.showBasicInfo;
      if (request.pdfSettings.hasOwnProperty('showRequesterDetails')) 
        templateConfig.showRequesterDetails = request.pdfSettings.showRequesterDetails;
      if (request.pdfSettings.hasOwnProperty('showDateOfRequest')) 
        templateConfig.showDateOfRequest = request.pdfSettings.showDateOfRequest;
      if (request.pdfSettings.hasOwnProperty('showPurposeInfo')) 
        templateConfig.showPurposeInfo = request.pdfSettings.showPurposeInfo;
      if (request.pdfSettings.hasOwnProperty('showVendorDetails')) 
        templateConfig.showVendorDetails = request.pdfSettings.showVendorDetails;
      if (request.pdfSettings.hasOwnProperty('showItems')) 
        templateConfig.showItems = request.pdfSettings.showItems;
      if (request.pdfSettings.hasOwnProperty('showApprovals')) 
        templateConfig.showApprovals = request.pdfSettings.showApprovals;
      if (request.pdfSettings.hasOwnProperty('showAttachments')) 
        templateConfig.showAttachments = request.pdfSettings.showAttachments;
      if (request.pdfSettings.hasOwnProperty('showAuditInfo')) 
        templateConfig.showAuditInfo = request.pdfSettings.showAuditInfo;
      if (request.pdfSettings.hasOwnProperty('showSignatures')) 
        templateConfig.showSignatures = request.pdfSettings.showSignatures;
        
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
    if (templateConfig.showBasicInfo !== false) {
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
    if (templateConfig.showRequesterDetails !== false) {
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
    if (templateConfig.showDateOfRequest !== false) {
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
    if (templateConfig.showPurposeInfo !== false) {
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
    if (templateConfig.showVendorDetails !== false) {
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
    if (templateConfig.showItems !== false) {
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
          fillColor: [247, 248, 250],
          textColor: [26, 54, 93],
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 2
        },
        footStyles: {
          fillColor: [247, 248, 250],
          textColor: [26, 54, 93],
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 15 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 }
        },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    // Attached Documents Section if available
    if (templateConfig.showAttachments !== false && request.attachments?.length > 0) {
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
          fillColor: [247, 248, 250],
          textColor: [26, 54, 93],
          fontSize: 9,
          fontStyle: 'bold',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 30 },
          2: { cellWidth: 20 }
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Approvals Section
    if (templateConfig.showApprovals !== false && (type === 'approver' || type === 'admin' || request.approvals?.length > 0)) {
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
            fillColor: [247, 248, 250],
            textColor: [26, 54, 93],
            fontSize: 9,
            fontStyle: 'bold',
            cellPadding: 2
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak'
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
    if (templateConfig.showAuditInfo !== false && (type === 'admin' || request.pdfSettings?.showAuditInfo)) {
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
          cellPadding: 2,
          textColor: [80, 80, 80]
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 25 },
          2: { fontStyle: 'bold', cellWidth: 25 }
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 5;
    }
    
    // Digital Signatures Section
    if (templateConfig.showSignatures !== false) {
      yPos = addSection(doc, "Digital Signatures", yPos);
      
      // Create signature boxes for key roles
      const signatureHeight = 20;
      const signatureWidth = (doc.internal.pageSize.width - (margin * 2)) / 2 - 5;
      
      // Function to draw a signature box
      const drawSignatureBox = (label: string, x: number, y: number, width: number, height: number) => {
        // Draw a light border
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, width, height);
        
        // Add label
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(label, x + 2, y + 4);
        
        // Add signature line
        doc.setDrawColor(180, 180, 180);
        doc.line(x + 5, y + height - 5, x + width - 5, y + height - 5);
        
        // Add 'Date:' text
        doc.text('Date:', x + width - 25, y + height - 8);
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