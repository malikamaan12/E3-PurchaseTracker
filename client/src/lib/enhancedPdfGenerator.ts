import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { PurchaseRequestWithRelations } from '../types/requests';
import { applyPdfWatermark, applySecurityWatermark, generatePdfTrackingId, logPdfAuditEvent } from './pdfAuditUtils';

/**
 * RGB color tuple type with normalized values (0-1)
 * This is a strict tuple type that requires exactly 3 elements
 */
type RGBColor = [number, number, number]; // Must be exactly 3 values for RGB

// Ensure array is a valid RGBColor with fallback to default values
function ensureValidRGBColor(color: any, defaultColor: RGBColor): RGBColor {
  if (Array.isArray(color) && color.length === 3 &&
      typeof color[0] === 'number' && 
      typeof color[1] === 'number' && 
      typeof color[2] === 'number') {
    return [color[0], color[1], color[2]];
  }
  return defaultColor;
}

/**
 * Convert hex color to RGB array for PDF usage
 * @param hex Hexadecimal color code (e.g., '#RRGGBB' or 'RRGGBB')
 * @returns Normalized RGB values as [r, g, b] array with values between 0-1
 */
function hexToRgb(hex: string): RGBColor {
  // Default color (black) for error cases
  const defaultColor: RGBColor = [0, 0, 0];
  
  try {
    // Default to black if input is invalid
    if (!hex || typeof hex !== 'string') {
      console.warn('Invalid hex color input');
      return defaultColor;
    }
    
    // Remove the # if present
    const cleanHex = hex.replace(/^#/, '');
    
    // Validate hex format (3 or 6 characters)
    if (!/^([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
      console.warn(`Invalid hex color format: ${hex}`);
      return defaultColor;
    }
    
    // Handle both 3-char and 6-char hex
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substr(4, 2), 16);
    
    // Handle NaN values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn(`Color parsing error for hex: ${hex}`);
      return defaultColor;
    }
    
    // Convert 0-255 to 0-1 range for PDF and ensure we have a proper tuple
    const result: RGBColor = [r/255, g/255, b/255];
    return result;
  } catch (error) {
    console.error(`Error parsing hex color ${hex}:`, error);
    return defaultColor;
  }
}

/**
 * Add a header to the PDF with company logo and gradient
 */
async function addHeader(doc: jsPDF, request: PurchaseRequestWithRelations, pdfSettings: any): Promise<number> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Default E3 colors
    const primaryColor: RGBColor = [111/255, 42/255, 230/255]; // E3 purple #6F2AE6
    const accentColor: RGBColor = [31/255, 211/255, 219/255]; // E3 teal #1FD3DB
    
    // Get header colors from settings or use defaults
    const headerColor = pdfSettings?.headerColor ? 
      hexToRgb(pdfSettings.headerColor) : primaryColor;
    
    // Start position at top of page with adequate margin
    const startY = 15; // Increased from 10 to provide more top margin
    
    // Get header height from settings or use default
    const headerHeight = pdfSettings?.headerHeight || 25; // Reduced from 30 to 25
    
    // Get margins from settings or use default
    const margin = pdfSettings?.marginLeft || 15;
    
    // Add company logo if available
    if (pdfSettings?.headerImage) {
      try {
        // Load image
        const img = new Image();
        img.src = pdfSettings.headerImage;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          setTimeout(() => resolve(), 1000); // Add timeout as fallback
          img.onerror = () => {
            console.error('Error loading header image');
            resolve();
          };
        });
        
        // Calculate correct aspect ratio for header image
        const imgWidth = Math.min(pageWidth / 2 - margin * 2, 50); // Reduced from 60 to 50
        const imgHeight = headerHeight;
        
        // Add the image on left side with proper sizing
        doc.addImage(img, 'PNG', margin, startY, imgWidth, imgHeight);
        
        // Add a gradient bar on the right side for aesthetic balance
        // Use our helper to ensure a valid RGB color tuple
        const defaultTeal: RGBColor = [31/255, 211/255, 219/255]; // Default E3 teal
        const accentRGB: RGBColor = ensureValidRGBColor(accentColor, defaultTeal);
          
        doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2]);
        doc.roundedRect(
          pageWidth - margin - 60, // X position at right margin minus width
          startY,                   // Y position same as logo
          60,                      // Width of gradient bar
          10,                      // Height of gradient bar
          1,                       // Corner radius
          1,                       // Corner radius
          'F'                      // Fill style
        );
      } catch (error) {
        console.error('Error adding header image:', error);
        // Use our helper to ensure valid RGB colors with proper defaults
        const defaultPurple: RGBColor = [111/255, 42/255, 230/255]; // Default E3 purple
        const defaultTeal: RGBColor = [31/255, 211/255, 219/255]; // Default E3 teal
        
        // Safely validate colors using our helper function
        const safeHeaderColor: RGBColor = ensureValidRGBColor(headerColor, defaultPurple);
        const safeAccentColor: RGBColor = ensureValidRGBColor(accentColor, defaultTeal);
        
        renderDefaultHeader(doc, safeHeaderColor, safeAccentColor, margin, startY, pageWidth);
      }
    } else {
      // Fallback if no header image is set
      // Use our helper to ensure valid RGB colors with proper defaults
      const defaultPurple: RGBColor = [111/255, 42/255, 230/255]; // Default E3 purple
      const defaultTeal: RGBColor = [31/255, 211/255, 219/255]; // Default E3 teal
      
      // Safely validate colors using our helper function
      const safeHeaderColor: RGBColor = ensureValidRGBColor(headerColor, defaultPurple);
      const safeAccentColor: RGBColor = ensureValidRGBColor(accentColor, defaultTeal);
      
      renderDefaultHeader(doc, safeHeaderColor, safeAccentColor, margin, startY, pageWidth);
    }
    
    // Add "PURCHASE REQUEST" title - centered and with background
    // Increase spacing after header to prevent overlap
    const titleY = startY + headerHeight + 15; // Increased from +10 to +15
    
    // Add background box for title
    doc.setFillColor(0, 0, 0);
    doc.rect(0, titleY - 5, pageWidth, 10, 'F');
    
    // Add title text in white
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("PURCHASE REQUEST", pageWidth/2, titleY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    
    // Add request info table - increased spacing after title
    const yPos = titleY + 20; // Increased from +15 to +20
    
    // Format date safely
    const formatDate = (dateString: string | undefined): string => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString();
      } catch (e) {
        return 'N/A';
      }
    };
    
    // Create the request info table
    autoTable(doc, {
      startY: yPos,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
      body: [
        [
          'Purchase Request #' + (request.requestNumber || ''),
          '',
          'Status:',
          request.status?.toUpperCase() || 'N/A'
        ],
        [
          'Requester:',
          request.requester?.username || 'N/A',
          'Department:',
          request.requester?.department || 'N/A',
        ],
        [
          'Date:',
          formatDate(request.createdAt),
          'Priority:',
          request.priority?.toUpperCase() || 'N/A'
        ]
      ],
      didDrawCell: (data) => {
        // Add border around the entire table
        if (data.row.index === 0 && data.column.index === 0) {
          // Access table dimensions
          const x = data.cell.x;
          const y = data.cell.y - data.row.height;
          
          // Calculate dimensions
          let maxRight = 0;
          let maxBottom = 0;
          
          // Find max coordinates
          data.table.body.forEach((row: any) => {
            if (row.cells) {
              row.cells.forEach((cell: any) => {
                if (cell && typeof cell === 'object' && cell.x !== undefined && cell.width !== undefined) {
                  const cellRight = cell.x + cell.width;
                  const cellBottom = cell.y + cell.height;
                  
                  if (cellRight > maxRight) maxRight = cellRight;
                  if (cellBottom > maxBottom) maxBottom = cellBottom;
                }
              });
            }
          });
          
          const width = maxRight - x;
          const height = (maxBottom - y);
          
          // Draw table border
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.1);
          doc.rect(x, y, width, height);
        }
      }
    });
    
    // Return the Y position for the next section with increased spacing
    return (doc as any).lastAutoTable.finalY + 15; // Increased from +10 to +15
  } catch (error) {
    console.error('Error adding header:', error);
    return 100; // Return a safe default position
  }
}

/**
 * Render default header with logo and gradient when image is not available
 */
function renderDefaultHeader(
  doc: jsPDF, 
  headerColor: RGBColor, 
  accentColor: RGBColor, 
  margin: number, 
  startY: number, 
  pageWidth: number
): void {
  // Create stylized "E3" logo with rectangles and text
  // Purple box for 'E'
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.roundedRect(margin, startY, 15, 25, 2, 2, 'F');
  
  // Teal box connected to it
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(margin + 15, startY, 15, 10, 2, 2, 'F');
  
  // Draw fancy gradient on right side
  const gradientWidth = 60;
  const gradientX = pageWidth - margin - gradientWidth;
  
  // Purple to teal gradient effect (simulated with rectangles)
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.roundedRect(gradientX, startY, gradientWidth/2, 25, 2, 2, 'F');
  
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(gradientX + gradientWidth/2, startY, gradientWidth/2, 25, 2, 2, 'F');
  
  // Add "E3" text in white on the purple box
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("E3", margin + 6, startY + 15);
  
  // Add company name text
  doc.setFontSize(11);
  doc.setTextColor(70, 42, 230); // Use E3 purple for text
  doc.setFont('helvetica', 'bold');
  doc.text("EVENTS &", margin + 35, startY + 8);
  doc.text("ENTERTAINMENT", margin + 35, startY + 15);
  doc.text("ENTERPRISES", margin + 35, startY + 22);
  doc.setFont('helvetica', 'normal');
}

/**
 * Add a section title with styling
 */
function addSection(doc: jsPDF, title: string, yPos: number, margin = 15, customTextColor?: RGBColor): number {
  const pageWidth = doc.internal.pageSize.width;
  
  // Define E3 colors with proper typing
  const primaryColor: RGBColor = [111/255, 42/255, 230/255]; // E3 purple #6F2AE6
  
  // Check for page overflow before adding a section
  const pageHeight = doc.internal.pageSize.height;
  const safeMargin = 20; // Safe margin at bottom of page
  
  // If we're too close to the bottom of the page, start a new page
  if (yPos > pageHeight - 40) { // 40mm from bottom of page
    doc.addPage();
    yPos = 15; // Reset to top of page with margin
  }
  
  // Add dark background full width
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
  
  // Add the colored accent bar at the left
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, yPos, 4, 7, 'F');
  
  // Add title text in white
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 8, yPos + 5);
  
  // Reset text color for subsequent content - use custom color if provided
  if (customTextColor) {
    doc.setTextColor(customTextColor[0] * 255, customTextColor[1] * 255, customTextColor[2] * 255);
  } else {
    doc.setTextColor(0, 0, 0);
  }
  doc.setFont('helvetica', 'normal');
  
  // Return position after section title with increased padding
  return yPos + 15; // Increased from 12 to 15
}

/**
 * Add a footer to the PDF
 */
async function addFooter(doc: jsPDF, currentPage: number, totalPages: number, pdfSettings: any): Promise<void> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Get footer colors from settings or use defaults
    const primaryColor: RGBColor = [111/255, 42/255, 230/255]; // E3 purple
    const accentColor: RGBColor = [31/255, 211/255, 219/255]; // E3 teal
    
    // Parse footer color from settings using our helper for type safety
    let footerColor: RGBColor = primaryColor;
    if (pdfSettings?.footerColor && typeof pdfSettings.footerColor === 'string') {
      const parsedColor = hexToRgb(pdfSettings.footerColor);
      footerColor = ensureValidRGBColor(parsedColor, primaryColor);
    }
    
    // Get margins and footer height
    const margin = pdfSettings?.marginLeft || 15;
    const footerHeight = 10; // Keep footer height small and consistent
    const footerY = pageHeight - footerHeight - 10;
    
    // Add footer bar - thin line with color
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, footerY, pageWidth - (margin * 2), 0.5, 'F');
    
    // Add footer image if available
    if (pdfSettings?.footerImage) {
      try {
        const img = new Image();
        img.src = pdfSettings.footerImage;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          setTimeout(() => resolve(), 1000); // Add timeout as fallback
          img.onerror = () => {
            console.error('Error loading footer image');
            resolve();
          };
        });
        
        // Scale the footer image appropriately (bottom right corner)
        const imgWidth = 40; // Fixed width for consistency
        const imgHeight = 10; // Fixed height for consistency
        const imgX = pageWidth - margin - imgWidth;
        
        // Add the image properly scaled
        doc.addImage(
          img, 
          'PNG', 
          imgX, 
          footerY + 1, // position just below the line
          imgWidth, 
          imgHeight
        );
      } catch (error) {
        console.error('Error adding footer image:', error);
        renderDefaultFooter(doc, footerColor, accentColor, margin, footerY, pageWidth);
      }
    } else {
      // Fallback if no footer image is set
      renderDefaultFooter(doc, footerColor, accentColor, margin, footerY, pageWidth);
    }
    
    // Add company contact information (if provided)
    if (pdfSettings?.companyPhone || pdfSettings?.companyEmail || pdfSettings?.companyWebsite) {
      doc.setFontSize(7);
      doc.setTextColor(70, 70, 70);
      
      let contactText = '';
      if (pdfSettings?.companyPhone) {
        contactText += `Phone: ${pdfSettings.companyPhone}`;
      }
      if (pdfSettings?.companyEmail) {
        contactText += contactText ? ' | ' : '';
        contactText += `Email: ${pdfSettings.companyEmail}`;
      }
      if (pdfSettings?.companyWebsite) {
        contactText += contactText ? ' | ' : '';
        contactText += `Web: ${pdfSettings.companyWebsite}`;
      }
      
      if (contactText) {
        doc.text(contactText, margin, footerY + 6);
      }
    }
    
    // Add company address (if provided)
    if (pdfSettings?.companyAddress) {
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(pdfSettings.companyAddress, margin, footerY + 10);
    }
    
    // Add page numbers
    if (pdfSettings?.pageNumbering !== false) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, footerY + 6, { align: 'right' });
    }
    
    // Add footer text (e.g., "Designed by Team E3")
    if (pdfSettings?.footerText) {
      doc.setFontSize(8);
      doc.setTextColor(primaryColor[0] * 255, primaryColor[1] * 255, primaryColor[2] * 255);
      doc.setFont('helvetica', 'italic');
      doc.text(pdfSettings.footerText, pageWidth / 2, pageHeight - 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }
  } catch (error) {
    console.error('Error adding footer:', error);
  }
}

/**
 * Render default footer with company information
 */
function renderDefaultFooter(
  doc: jsPDF,
  footerColor: RGBColor,
  accentColor: RGBColor,
  margin: number,
  footerY: number,
  pageWidth: number
): void {
  // Add small E3 brand mark at bottom right
  const brandSize = 8;
  const brandX = pageWidth - margin - brandSize;
  const brandY = footerY + 2;
  
  // Purple box for brand
  doc.setFillColor(footerColor[0], footerColor[1], footerColor[2]);
  doc.roundedRect(brandX, brandY, brandSize, brandSize, 1, 1, 'F');
  
  // Add "E3" text in white
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("E3", brandX + brandSize/2, brandY + brandSize/2 + 2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
}

/**
 * Generate a professional PDF for the purchase request
 * @param request Purchase request data
 * @param type Type of PDF to generate
 * @returns jsPDF document
 */
export async function generateEnhancedPDF(
  request: PurchaseRequestWithRelations, 
  type: 'user' | 'approver' | 'admin' = 'user',
  customSettings?: any // Allow passing custom settings
): Promise<jsPDF> {
  try {
    // Default fallback settings in case API calls fail
    const defaultSettings = {
      headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
      headerSubtitle: 'PURCHASE REQUEST',
      headerColor: '#6F2AE6', // Purple
      footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
      footerColor: '#6F2AE6',
      pageNumbering: true,
      watermarkOpacity: 10,
      templateConfig: JSON.stringify({
        name: 'Standard Template',
        type: 'standard',
        layout: 'portrait',
        showHeader: true,
        showFooter: true,
        showLogo: true,
        showWatermark: true,
        securityLevel: 'internal',
        headerColor: [111, 42, 230],
        accentColor: [31, 211, 219],
        watermarkOpacity: 0.08,
        watermarkText: 'INTERNAL USE',
        showApprovalFlow: true,
        showSignatureLines: true,
        showAttachments: true,
        showTotalsTable: true
      })
    };
    
    // Use provided settings if passed, otherwise fetch from API
    let pdfSettings = customSettings || defaultSettings;
    
    // If no custom settings provided, fetch settings from API
    if (!customSettings) {
      try {
        // First try to fetch PDF settings from the API that includes request-specific settings
        const requestSettingsResponse = await fetch(`/api/requests/${request.id}/pdf?type=${type}&preview=true`);
        
        if (requestSettingsResponse.ok) {
          const data = await requestSettingsResponse.json();
          if (data && data.pdfSettings) {
            // Use settings from the enhanced endpoint
            pdfSettings = data.pdfSettings;
            console.log('Using PDF settings from enhanced endpoint');
          }
        }
        
        // If no settings from enhanced endpoint, fall back to general settings
        if (pdfSettings === defaultSettings) {
          const response = await fetch('/api/pdf/print-settings?type=template');
          if (response.ok) {
            const data = await response.json();
            if (data && Object.keys(data).length > 0) {
              pdfSettings = data;
              
              // Parse templateConfig if it exists as a string
              if (typeof pdfSettings.templateConfig === 'string') {
                try {
                  pdfSettings.templateConfig = JSON.parse(pdfSettings.templateConfig);
                  console.log('Parsed template configuration from string');
                } catch (parseError) {
                  console.error('Error parsing template configuration:', parseError);
                  // Use default template config
                  pdfSettings.templateConfig = JSON.parse(defaultSettings.templateConfig);
                }
              } else if (!pdfSettings.templateConfig) {
                // If templateConfig is missing, use default
                console.log('Using default template configuration');
                pdfSettings.templateConfig = JSON.parse(defaultSettings.templateConfig);
              }
              
              console.log('Using general PDF settings');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching PDF settings:', error);
        // Continue with default settings
      }
    }
    
    // Ensure templateConfig always exists
    if (!pdfSettings.templateConfig) {
      console.log('No template config found, using default');
      pdfSettings.templateConfig = JSON.parse(defaultSettings.templateConfig);
    }
    
    // Create new PDF document with settings from PDF settings if available
    const doc = new jsPDF({
      orientation: pdfSettings?.orientation || 'portrait',
      unit: pdfSettings?.unit || 'mm',
      format: pdfSettings?.format || 'a4',
      compress: true,
      // You can add more PDF configuration options here if needed
      putOnlyUsedFonts: true,
      floatPrecision: 16 // Better precision for graphics
    });
    
    // Add header
    let yPos = await addHeader(doc, request, pdfSettings);
    
    // Use settings from PDF settings if available
    const fontSize = pdfSettings?.fontSize || 9;
    const cellPadding = pdfSettings?.cellPadding || 3;
    const marginLeft = pdfSettings?.marginLeft || 15;
    const marginRight = pdfSettings?.marginRight || 15;
    
    // Get text color from settings or use default black
    const textColor: RGBColor = pdfSettings?.textColor ? hexToRgb(pdfSettings.textColor) : [0, 0, 0];
    
    // Add Request Information section
    yPos = addSection(doc, 'Request Information', yPos, 15, textColor);
    
    // Extract requester information directly from request
    const requesterName = request.requester?.username || 'N/A';
    const requesterDepartment = request.requester?.department || 'N/A';
    
    console.log("PDF generation - Requester details:", { 
      name: requesterName, 
      department: requesterDepartment,
      requesterId: request.requesterId
    });
    
    // Format dates
    const createdAtFormatted = request.createdAt 
      ? new Date(request.createdAt).toLocaleDateString() 
      : 'N/A';
    
    // Create a more optimized layout without duplicates
    autoTable(doc, {
      startY: yPos,
      theme: 'plain',
      styles: { 
        fontSize: fontSize, 
        cellPadding: cellPadding,
        textColor: [textColor[0], textColor[1], textColor[2]] 
      },
      margin: { left: marginLeft, right: marginRight },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
      body: [
        ['Request Number:', request.requestNumber || 'N/A'],
        ['Title:', request.title || 'N/A'],
        ['Status:', request.status?.toUpperCase() || 'N/A'],
        ['Requester:', `${requesterName} (${requesterDepartment})`],
        ['Created Date:', createdAtFormatted],
        ['Priority:', request.priority?.toUpperCase() || 'N/A'],
        ['Description:', request.description || 'N/A'],
        ['Purpose Type:', request.purposeType || 'N/A'],
        ['Sub-purpose:', request.subPurpose?.name || 'N/A']
      ]
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Add Vendor Information section
    yPos = addSection(doc, 'Vendor Information', yPos, 15, textColor);
    
    const vendor = request.vendor || {};
    autoTable(doc, {
      startY: yPos,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      body: [
        [
          'Vendor Name:',
          vendor.name || vendor.companyName || 'N/A',
          'Contact Person:',
          vendor.contactPerson || 'N/A'
        ],
        [
          'Email:',
          vendor.email || 'N/A',
          'Phone:',
          vendor.phone || vendor.contactNumber || 'N/A'
        ]
      ]
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Add Items section
    yPos = addSection(doc, 'Items', yPos, 15, textColor);
    
    // Safely parse items
    let items = [];
    try {
      if (Array.isArray(request.items)) {
        items = request.items;
      } else if (typeof request.items === 'string') {
        items = JSON.parse(request.items || '[]');
      }
    } catch (error) {
      console.error('Error parsing items:', error);
      items = [];
    }
    
    // Currency formatter
    const formatCurrency = (amount: number) => {
      return `${request.currency || 'QAR'} ${amount.toLocaleString()}`;
    };
    
    if (items.length > 0) {
      autoTable(doc, {
        startY: yPos,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [240/255, 240/255, 245/255], textColor: [0, 0, 0] },
        head: [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']],
        body: items.map((item: any) => [
          item.name || 'N/A',
          item.description || 'N/A',
          item.quantity || '0',
          formatCurrency(item.estimatedCost || 0),
          formatCurrency((item.quantity || 0) * (item.estimatedCost || 0))
        ])
      });
      
      yPos = (doc as any).lastAutoTable.finalY;
      
      // Calculate totals
      const itemsTotal = items.reduce((sum: number, item: any) => 
        sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)), 0);
      const freightAmount = Number(request.freightAmount || 0);
      const totalCost = itemsTotal + freightAmount;
      
      // Add totals section
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 15, right: 15 },
        columnStyles: { 3: { fontStyle: 'bold', halign: 'right' }, 4: { halign: 'right' } },
        body: [
          ['', '', '', 'Items Total:', formatCurrency(itemsTotal)],
          ['', '', '', 'Freight:', formatCurrency(freightAmount)],
          ['', '', '', 'Total Cost:', formatCurrency(totalCost)]
        ]
      });
    } else {
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 15, right: 15 },
        body: [['No items found']]
      });
    }
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Add Attached Documents section if available
    if (request.attachments && request.attachments.length > 0) {
      yPos = addSection(doc, 'Attached Documents', yPos, 15, textColor);
      
      autoTable(doc, {
        startY: yPos,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [240/255, 240/255, 245/255], textColor: [0, 0, 0] },
        head: [['Document Name', 'Type', 'Size']],
        body: request.attachments.map((file: any) => [
          file.fileName || file.name || 'N/A',
          file.fileType || 'N/A',
          file.fileSize ? `${(file.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'
        ])
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add Approval Status section if admin or approver PDF
    if (type === 'admin' || type === 'approver' || (request.approvals && request.approvals.length > 0)) {
      yPos = addSection(doc, 'Approval Status', yPos, 15, textColor);
      
      if (request.approvals && request.approvals.length > 0) {
        autoTable(doc, {
          startY: yPos,
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 3 },
          margin: { left: 15, right: 15 },
          headStyles: { fillColor: [240/255, 240/255, 245/255], textColor: [0, 0, 0] },
          head: [['Approver', 'Department', 'Status', 'Comments', 'Processed At']],
          body: request.approvals.map((approval: any) => [
            approval.approver?.username || 'N/A',
            approval.department || 'N/A',
            approval.status?.toUpperCase() || 'PENDING',
            approval.comments || 'N/A',
            approval.processedAt ? new Date(approval.processedAt).toLocaleDateString() : 'Not processed'
          ])
        });
      } else {
        autoTable(doc, {
          startY: yPos,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 3 },
          margin: { left: 15, right: 15 },
          body: [['No approval information available']]
        });
      }
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add signature section for admin and approver PDFs
    if (type === 'admin' || type === 'approver') {
      yPos = addSection(doc, 'Signatures', yPos);
      
      // Add signature lines
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      const lineWidth = (pageWidth - (margin * 2) - 20) / 2;
      
      // Requester signature - include requester name and department
      doc.line(margin, yPos + 15, margin + lineWidth, yPos + 15);
      doc.setFontSize(9);
      // Use the same requester name variables we defined earlier to ensure consistency
      const requesterSignature = requesterName !== 'N/A' ? 
        `${requesterName}${requesterDepartment !== 'N/A' ? ` (${requesterDepartment})` : ''}` : 
        'Requester Signature';
      doc.text(requesterSignature, margin, yPos + 20);
      
      // Approver signature
      doc.line(margin + lineWidth + 20, yPos + 15, pageWidth - margin, yPos + 15);
      // If we have approval info, show the last approver in the chain
      let approverText = 'Approver Signature';
      if (request.approvals && request.approvals.length > 0) {
        const lastApproval = request.approvals[request.approvals.length - 1];
        if (lastApproval.approver?.username) {
          approverText = `${lastApproval.approver.username} (${lastApproval.department || 'Approver'})`;
        }
      }
      doc.text(approverText, margin + lineWidth + 20, yPos + 20);
    }
    
    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      await addFooter(doc, i, pageCount, pdfSettings);
    }
    
    // Generate tracking ID for this PDF
    const trackingId = generatePdfTrackingId(request.id);

    // Get security level from settings, defaulting to 'internal' if not specified
    const securityLevel = pdfSettings?.securityLevel || 'internal';
    
    // Apply security watermark based on security level and template configuration
    const templateConfig = pdfSettings.templateConfig || {};
    const showWatermark = templateConfig.showWatermark !== false;
    
    // Get security level from template config or fall back to settings
    const templateSecurityLevel = templateConfig.securityLevel || securityLevel;
    
    // Apply security watermark based on security level if not public
    if (showWatermark && templateSecurityLevel !== 'public') {
      // Apply security watermark with specific styling based on security level
      // Pass user ID if available for tracking
      const userId = request.requesterId || undefined;
      applySecurityWatermark(doc, templateSecurityLevel, userId, trackingId);
      
      console.log(`Applied ${templateSecurityLevel} security watermark to PDF`);
    }
    // Apply standard watermark if security watermark is not used but watermark is enabled
    else if (showWatermark && (pdfSettings?.watermarkEnabled !== false || pdfSettings?.useWatermark === true)) {
      // Use watermark text from template config if available
      const watermarkText = templateConfig.watermarkText || 
                          pdfSettings?.watermarkText || 
                          `CONFIDENTIAL - ${request.requestNumber || ''}`;
      
      // Use watermark opacity from template config if available
      const watermarkOpacity = templateConfig.watermarkOpacity || 
                            pdfSettings?.watermarkOpacity || 
                            0.08;
      
      applyPdfWatermark(doc, watermarkText, watermarkOpacity);
      console.log(`Applied standard watermark with opacity ${watermarkOpacity}`);
    }
    
    // Log audit event for PDF generation (non-blocking async)
    logPdfAuditEvent(
      request.id, 
      'pdf_generated', 
      {
        trackingId,
        pdfType: type,
        securityLevel,
        pageCount,
        timestamp: new Date().toISOString(),
        ipAddress: '127.0.0.1' // In a real app, this would come from the request
      },
      type
    ).catch(err => console.error('Error logging PDF generation:', err));
    
    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}