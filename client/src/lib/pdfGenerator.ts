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
    const margin = 15;
    
    // Try to get PDF settings - first check if already in request object
    let logoUrl = null;
    let headerImageUrl = null;
    let headerTitle = "EVENTS & ENTERTAINMENT";
    let headerSubtitle = "ENTERPRISES";
    
    // Brand colors for E3 (purple to teal gradient)
    const primaryColor = [111, 42, 230]; // E3 purple #6F2AE6
    const accentColor = [31, 211, 219]; // E3 teal #1FD3DB
    
    // First check if settings were passed directly in the request object
    if (request.pdfSettings) {
      logoUrl = request.pdfSettings.logo;
      headerImageUrl = request.pdfSettings.headerImage;
      
      if (request.pdfSettings.headerTitle) {
        headerTitle = request.pdfSettings.headerTitle;
      }
      
      if (request.pdfSettings.headerSubtitle) {
        headerSubtitle = request.pdfSettings.headerSubtitle;
      }
    } else {
      // Otherwise fetch from API
      try {
        const response = await fetch('/api/pdf/print-settings');
        if (response.ok) {
          const settings = await response.json();
          logoUrl = settings.logo;
          headerImageUrl = settings.headerImage;
          
          if (settings.headerTitle) {
            headerTitle = settings.headerTitle;
          }
          
          if (settings.headerSubtitle) {
            headerSubtitle = settings.headerSubtitle;
          }
        }
      } catch (settingsError) {
        console.error('Error fetching PDF settings:', settingsError);
      }
    }
    
    // E3 Logo on left side
    let e3Logo = logoUrl;
    if (!e3Logo) {
      // Fallback to default E3 logo if none is provided
      e3Logo = '/uploads/logos/e3-logo.png';
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
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("E3", margin + 5, 20);
    }
    
    // Add company header with E3 branding colors
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(headerTitle, pageWidth/2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(headerSubtitle, pageWidth/2, 22, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text("PURCHASE REQUEST", pageWidth/2, 29, { align: 'center' });
    
    // Add the colored gradient bar (matching E3 brand)
    // Create a gradient bar effect manually since PDF doesn't support CSS gradients
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]); // Purple
    doc.rect(margin, 33, pageWidth / 2 - margin, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(pageWidth / 2, 33, pageWidth / 2 - margin, 3, 'F');
    
    // Add subtle border line
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, 38, pageWidth - margin, 38);
    
  } catch (error) {
    console.error("Error rendering PDF header:", error);
    // Continue rendering
  }

  // Add request number and date with error handling
  try {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    
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
    const margin = 15;
    const footerHeight = 20;
    
    // E3 brand colors (matching header)
    const primaryColor = [111, 42, 230]; // E3 purple #6F2AE6
    const accentColor = [31, 211, 219]; // E3 teal #1FD3DB
    const textColor = [50, 50, 50]; // Dark gray for text
    
    // Try to get PDF settings for footer
    let footerText = "ALL RIGHTS RESERVED BY E3";
    let pageNumbering = true;
    let contactInfo = {
      phone: "+974 44332340 / 55255417",
      email: "info@e3corp.com",
      website: "www.e3corp.com",
      address: "Floor 36, Office 3602, Palm Tower B, Marina 41, Port Area, P.O.Box 55821, Doha"
    };
    
    // First check if settings were passed directly in the request object
    if (request?.pdfSettings) {
      if (request.pdfSettings.footerText) {
        footerText = request.pdfSettings.footerText;
      }
      
      // Check page numbering setting
      if (request.pdfSettings.hasOwnProperty('pageNumbering')) {
        pageNumbering = request.pdfSettings.pageNumbering;
      }
      
      // Check for contact info override
      if (request.pdfSettings.contactInfo) {
        contactInfo = { ...contactInfo, ...request.pdfSettings.contactInfo };
      }
    } else {
      // Otherwise fetch from API
      try {
        const response = await fetch('/api/pdf/print-settings');
        if (response.ok) {
          const settings = await response.json();
          
          if (settings.footerText) {
            footerText = settings.footerText;
          }
          
          if (settings.hasOwnProperty('pageNumbering')) {
            pageNumbering = settings.pageNumbering;
          }
          
          // Check for contact info override
          if (settings.contactInfo) {
            contactInfo = { ...contactInfo, ...settings.contactInfo };
          }
        }
      } catch (settingsError) {
        console.error('Error fetching PDF settings for footer:', settingsError);
      }
    }
    
    // Draw gradient bar at the bottom (similar to header)
    // Add a line above the footer
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);
    
    // Add the colored gradient bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]); // Purple
    doc.rect(margin, pageHeight - footerHeight + 2, pageWidth/3, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(margin + pageWidth/3, pageHeight - footerHeight + 2, pageWidth/3, 3, 'F');
    
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]); // Teal
    doc.rect(margin + 2*pageWidth/3, pageHeight - footerHeight + 2, pageWidth/3 - margin, 3, 'F');
    
    // Add contact information in the footer
    doc.setFontSize(7);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Left side - Phone and email
    const phoneIcon = "\uf095"; // Font Awesome phone icon code
    const emailIcon = "\uf0e0"; // Font Awesome email icon
    const webIcon = "\uf0ac";   // Font Awesome web icon
    
    // Use standard text instead of icons for better compatibility
    doc.text(`☎ ${contactInfo.phone}`, margin, pageHeight - footerHeight + 10);
    doc.text(`✉ ${contactInfo.email}`, margin, pageHeight - footerHeight + 14);
    doc.text(`🌐 ${contactInfo.website}`, margin, pageHeight - footerHeight + 18);
    
    // Right side - Address
    doc.text(`📍 ${contactInfo.address}`, pageWidth / 2, pageHeight - footerHeight + 14);
    
    // Add footer text and page numbers
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(footerText, margin, pageHeight - 5);
    
    if (pageNumbering) {
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
  showAttachments: boolean;
  showApprovals: boolean;
  showVendorDetails: boolean;
  showAuditInfo: boolean;
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
    showAttachments: true,
    showApprovals: true,
    showVendorDetails: true,
    showAuditInfo: true,
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
    const templateConfig = getTemplateConfig(templateId);
    
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

    // Basic Information Section
    yPos = addSection(doc, "Basic Information", yPos);

    // Type casting for jspdf-autotable styles to avoid TypeScript errors
    const boldStyle = { fontStyle: 'bold' as 'bold', cellWidth: 25 };
    
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

    // Purpose Information Section
    yPos = addSection(doc, "Purpose Information", yPos);
    const purposeInfo = [
      [
        { content: 'Purpose Type:', styles: boldStyle },
        { content: request.purposeType || 'N/A', cellWidth: 35 },
        { content: 'Sub-purpose:', styles: boldStyle },
        { content: request.subPurpose?.name || 'N/A' }
      ]
    ];

    autoTable(doc, {
      startY: yPos,
      body: purposeInfo,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Vendor Information Section
    yPos = addSection(doc, "Vendor Information", yPos);
    
    // Safely extract vendor information - handle field name differences in data structure
    const vendor = request.vendor || {};
    const vendorName = vendor.name || vendor.companyName || 'N/A';
    const contactPerson = vendor.contactPerson || 'N/A';
    const vendorEmail = vendor.email || 'N/A';
    const vendorPhone = vendor.phone || vendor.contactNumber || 'N/A';
    
    const vendorInfo = [
      [
        { content: 'Vendor Name:', styles: boldStyle },
        { content: vendorName, cellWidth: 35 },
        { content: 'Contact Person:', styles: boldStyle },
        { content: contactPerson }
      ],
      [
        { content: 'Email:', styles: boldStyle },
        { content: vendorEmail, cellWidth: 35 },
        { content: 'Phone:', styles: boldStyle },
        { content: vendorPhone }
      ]
    ];

    autoTable(doc, {
      startY: yPos,
      body: vendorInfo,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Items Section
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

    // Attached Documents Section if available
    if (request.attachments?.length > 0) {
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
    }
    
    // Add approver-specific information if this is an approver or admin report
    if (type === 'approver' || type === 'admin') {
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
    }
    
    // Add admin-specific information
    if (type === 'admin') {
      yPos = (doc as any).lastAutoTable.finalY + 5;
      
      // Audit Information Section
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