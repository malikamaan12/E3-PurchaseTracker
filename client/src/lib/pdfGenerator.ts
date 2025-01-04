import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type CompanyBranding } from '@db/schema';
import { format } from 'date-fns';

// Interfaces
interface TemplateConfig {
  branding: {
    name: string;
    primaryColor: [number, number, number];
    secondaryColor: [number, number, number];
    accentColor: [number, number, number];
    headerStyle: string;
    logo: string | null;
    logoMimeType: string | null;
    headerImage: string | null;
    headerImageMimeType: string | null;
    footerImage: string | null;
    footerImageMimeType: string | null;
    footerText: string;
  };
  layout: 'modern' | 'classic' | 'bento';
  headerHeight: number;
  footerHeight: number;
  showLogo: boolean;
}

// Enhanced error logging
const logError = (error: any, context: string) => {
  console.error(`PDF Generator Error [${context}]:`, {
    message: error.message,
    stack: error.stack,
    data: error
  });
};

// Function to validate base64 data with enhanced logging
function isValidBase64(str: string | null) {
  if (!str) {
    console.warn('No data provided for base64 validation');
    return false;
  }

  try {
    // Remove data URL prefix if present
    const base64Data = str.includes('base64,') ? str.split('base64,')[1] : str;
    return btoa(atob(base64Data)) === base64Data;
  } catch (err) {
    console.warn('Invalid base64 data:', err);
    return false;
  }
}

// Enhanced image handling with validation and logging
function addImageToPDF(doc: jsPDF, imageData: string | null, mimeType: string | null, x: number, y: number, width: number, height: number): boolean {
  try {
    if (!imageData) {
      console.warn('No image data provided');
      return false;
    }

    if (!mimeType) {
      console.warn('No mime type provided');
      return false;
    }

    // Clean and validate image data
    const base64Data = imageData.includes('base64,') ?
      imageData.split('base64,')[1] :
      imageData;

    if (!base64Data) {
      console.warn('Invalid image data format');
      return false;
    }

    const imgFormat = mimeType.split('/')[1].toUpperCase();
    if (!['PNG', 'JPEG', 'JPG'].includes(imgFormat)) {
      console.warn(`Unsupported image format: ${imgFormat}`);
      return false;
    }

    const fullImageData = `data:${mimeType};base64,${base64Data}`;
    console.log(`Adding image: format=${imgFormat}, size=${width}x${height}, position=(${x},${y})`);

    doc.addImage(
      fullImageData,
      imgFormat,
      x,
      y,
      width,
      height,
      undefined,
      'FAST'
    );

    console.log('Image added successfully');
    return true;
  } catch (error) {
    logError(error, 'addImageToPDF');
    return false;
  }
}

// Enhanced branding fetch with proper error handling and logging
async function fetchBranding(): Promise<TemplateConfig['branding']> {
  try {
    console.log('Fetching company branding data...');
    const response = await fetch('/api/branding');

    if (!response.ok) {
      throw new Error(`Failed to fetch branding: ${response.statusText}`);
    }

    const data: CompanyBranding = await response.json();
    console.log('Received branding data:', {
      ...data,
      logo: data.logo ? '[PRESENT]' : '[MISSING]',
      header_image_url: data.header_image_url ? '[PRESENT]' : '[MISSING]',
      footer_image_url: data.footer_image_url ? '[PRESENT]' : '[MISSING]'
    });

    return {
      name: data.company_name,
      primaryColor: hexToRGB(data.primary_color),
      secondaryColor: hexToRGB(data.secondary_color),
      accentColor: hexToRGB(data.accent_color),
      headerStyle: data.header_style,
      logo: data.logo,
      logoMimeType: data.logo_mime_type,
      headerImage: data.header_image_url,
      headerImageMimeType: data.header_image_mime_type,
      footerImage: data.footer_image_url,
      footerImageMimeType: data.footer_image_mime_type,
      footerText: data.footer_text || "Confidential - For Internal Use Only"
    };
  } catch (error) {
    logError(error, 'fetchBranding');
    console.warn('Using default branding due to error');
    return {
      name: "Company Name",
      primaryColor: [113, 86, 158],
      secondaryColor: [240, 240, 250],
      accentColor: [25, 17, 96],
      headerStyle: "modern",
      logo: null,
      logoMimeType: null,
      headerImage: null,
      headerImageMimeType: null,
      footerImage: null,
      footerImageMimeType: null,
      footerText: "Confidential - For Internal Use Only"
    };
  }
}

// Helper function to convert hex color to RGB array
function hexToRGB(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [113, 86, 158]; // Default purple color
}

// Function to add header with enhanced styling and logging
function addHeader(doc: jsPDF, config: TemplateConfig, pageWidth: number) {
  const headerHeight = 35;
  console.log('Adding header with config:', {
    hasHeaderImage: !!config.branding.headerImage,
    hasLogo: !!config.branding.logo,
    headerStyle: config.branding.headerStyle
  });

  // Try to add header image first
  if (config.branding.headerImage) {
    console.log('Attempting to add header image');
    const added = addImageToPDF(
      doc,
      config.branding.headerImage,
      config.branding.headerImageMimeType || 'image/png',
      0,
      0,
      pageWidth,
      headerHeight
    );
    if (added) {
      console.log('Header image added successfully');
      return headerHeight;
    }
  }

  // Fallback to styled header
  console.log('Using fallback styled header');
  const brandingColor = config.branding.primaryColor;

  // Modern header with gradient effect
  doc.setFillColor(brandingColor[0], brandingColor[1], brandingColor[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Add subtle pattern
  for (let i = 0; i < pageWidth; i += 15) {
    doc.setFillColor(255, 255, 255, 0.1);
    doc.rect(i, 0, 10, headerHeight, 'F');
  }

  // Add logo if available
  let logoWidth = 0;
  if (config.branding.logo) {
    console.log('Attempting to add logo');
    const logoAdded = addImageToPDF(
      doc,
      config.branding.logo,
      config.branding.logoMimeType || 'image/png',
      10,
      5,
      25,
      25
    );
    if (logoAdded) {
      logoWidth = 35; // Logo width + margin
      console.log('Logo added successfully');
    }
  }

  // Company name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.branding.name, 10 + logoWidth, headerHeight / 2);

  // Add date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const date = format(new Date(), 'PPP');
  doc.text(date, pageWidth - 15, headerHeight / 2, { align: 'right' });

  return headerHeight;
}

// Function to add footer with enhanced styling and logging
function addFooter(doc: jsPDF, config: TemplateConfig, pageWidth: number, pageHeight: number) {
  const footerHeight = 25;
  const footerY = pageHeight - footerHeight;
  console.log('Adding footer with config:', {
    hasFooterImage: !!config.branding.footerImage,
    footerText: config.branding.footerText
  });

  // Try to add footer image first
  if (config.branding.footerImage) {
    console.log('Attempting to add footer image');
    const added = addImageToPDF(
      doc,
      config.branding.footerImage,
      config.branding.footerImageMimeType || 'image/png',
      0,
      footerY,
      pageWidth,
      footerHeight
    );
    if (added) {
      console.log('Footer image added successfully');
      return footerHeight;
    }
  }

  // Fallback to styled footer
  console.log('Using fallback styled footer');
  const brandingColor = config.branding.primaryColor;

  // Modern footer with gradient effect
  doc.setFillColor(brandingColor[0], brandingColor[1], brandingColor[2]);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  // Add subtle pattern
  for (let i = 0; i < pageWidth; i += 15) {
    doc.setFillColor(255, 255, 255, 0.1);
    doc.rect(i, footerY, 10, footerHeight, 'F');
  }

  // Footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(config.branding.footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Page number
  const pageNumber = `Page ${doc.getCurrentPageInfo().pageNumber}`;
  doc.text(pageNumber, pageWidth - 15, pageHeight - 10, { align: 'right' });

  return footerHeight;
}

export async function generateRequestPDF(
  request: PurchaseRequestWithRelations,
  templateConfig: Partial<TemplateConfig> = {}
) {
  try {
    console.log('Starting PDF generation for request:', {
      id: request.id,
      status: request.status,
      items: request.items?.length || 0
    });

    // Validate request data
    if (!request || !request.items) {
      throw new Error('Invalid request data - missing required fields');
    }

    // Fetch company branding
    const branding = await fetchBranding();

    const config: TemplateConfig = {
      branding,
      layout: 'bento',
      headerHeight: templateConfig.headerHeight || 35,
      footerHeight: templateConfig.footerHeight || 25,
      showLogo: !!branding.logo
    };

    console.log('Using PDF config:', config);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);

    // Add header
    const headerHeight = addHeader(doc, config, pageWidth);
    let yPos = headerHeight + 10;

    // Helper function for creating tiles with enhanced styling
    const addTile = (title: string, content: string[], y: number, height: number) => {
      try {
        // Add tile background with subtle gradient
        doc.setFillColor(config.branding.secondaryColor[0], config.branding.secondaryColor[1], config.branding.secondaryColor[2]);
        doc.rect(margin, y, maxWidth, height, 'F');

        // Add decorative accent
        doc.setFillColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.rect(margin, y, 5, height, 'F');

        // Add title with enhanced styling
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]);
        doc.text(title.toUpperCase(), margin + 8, y + 10);

        // Add content with improved formatting
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(config.branding.accentColor[0], config.branding.accentColor[1], config.branding.accentColor[2]);
        doc.setFontSize(10);
        content.forEach((text, index) => {
          if (text) {
            doc.text(text, margin + 8, y + 22 + (index * 6));
          }
        });
      } catch (error) {
        logError(error, `addTile-${title}`);
        throw error;
      }
    };

    // Request Info Tile
    const requestInfo = [
      `Request Number: ${request.requestNumber}`,
      `Status: ${request.status.toUpperCase().replace('_', ' ')}`,
      `Priority: ${request.priority.toUpperCase()}`,
      `Created: ${format(new Date(request.createdAt || new Date()), 'PPp')}`,
    ];
    addTile('Request Information', requestInfo, yPos, 35);

    // Requester Info Tile
    yPos += 40;
    const requesterInfo = [
      `Name: ${request.requester?.username || 'N/A'}`,
      `Department: ${request.requester?.department || 'N/A'}`,
      `Contact: ${request.requester?.contactNumber || 'N/A'}`,
      `Email: ${request.requester?.email || 'N/A'}`,
    ];
    addTile('Requester Details', requesterInfo, yPos, 40);

    // Purpose Tile
    yPos += 45;
    const purposeInfo = [
      `Type: ${request.purposeType.replace('_', ' ').toUpperCase()}`,
      request.subPurpose ? `Sub Purpose: ${request.subPurpose.name}` : '',
      `Details: ${request.description || 'N/A'}`,
    ].filter(Boolean);
    addTile('Purpose Information', purposeInfo, yPos, 35);

    // Items Table
    yPos += 40;
    const tableStyles = {
      headStyles: {
        fillColor: [config.branding.primaryColor[0], config.branding.primaryColor[1], config.branding.primaryColor[2]],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [
          Math.floor(config.branding.secondaryColor[0] * 0.98),
          Math.floor(config.branding.secondaryColor[1] * 0.98),
          Math.floor(config.branding.secondaryColor[2] * 0.98)
        ],
      },
      margin: { left: margin + 8, right: margin + 8 }
    };

    // Format items data
    const items = request.items.map(item => [
      item?.name || 'N/A',
      item?.quantity?.toString() || '0',
      formatCurrency(item?.estimatedCost || 0, request.currency),
      formatCurrency((item?.quantity || 0) * (item?.estimatedCost || 0), request.currency)
    ]);

    // Add items table
    autoTable(doc, {
      startY: yPos + 15,
      head: [['Item', 'Qty', 'Unit Cost', 'Total']],
      body: items,
      foot: [
        ['', '', 'Items Total:', formatCurrency(calculateItemsTotal(request), request.currency)],
        ['', '', 'Freight:', formatCurrency(Number(request.freightAmount || 0), request.currency)],
        ['', '', 'Total Cost:', formatCurrency(calculateTotalCost(request), request.currency)]
      ],
      ...tableStyles,
      footStyles: {
        ...tableStyles.headStyles,
        fillColor: [
          Math.floor(config.branding.primaryColor[0] * 0.9),
          Math.floor(config.branding.primaryColor[1] * 0.9),
          Math.floor(config.branding.primaryColor[2] * 0.9)
        ],
      }
    });

    // Approvals Table
    if (request.approvals && request.approvals.length > 0) {
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Add approvals table
      autoTable(doc, {
        startY: yPos,
        head: [['Department', 'Approver', 'Status', 'Comments']],
        body: request.approvals.map(approval => [
          approval.department || 'N/A',
          approval.approver?.username || 'N/A',
          approval.status.toUpperCase(),
          approval.comments || '-'
        ]),
        ...tableStyles,
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 'auto' }
        }
      });
    }

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, config, pageWidth, pageHeight);
    }

    console.log('PDF generation completed successfully');
    return doc;
  } catch (error) {
    logError(error, 'generateRequestPDF');
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper functions
function formatCurrency(amount: number, currency: string = 'QAR'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    logError(error, 'formatCurrency');
    return `${currency} ${amount}`;
  }
}

function calculateItemsTotal(request: PurchaseRequestWithRelations): number {
  try {
    return (request.items || []).reduce(
      (sum, item) => sum + (Number(item?.quantity || 0) * Number(item?.estimatedCost || 0)),
      0
    );
  } catch (error) {
    logError(error, 'calculateItemsTotal');
    return 0;
  }
}

function calculateTotalCost(request: PurchaseRequestWithRelations): number {
  try {
    return calculateItemsTotal(request) + Number(request.freightAmount || 0);
  } catch (error) {
    logError(error, 'calculateTotalCost');
    return 0;
  }
}

function formatFileSize(bytes: number): string {
  try {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  } catch (error) {
    logError(error, 'formatFileSize');
    return '0 Bytes';
  }
}