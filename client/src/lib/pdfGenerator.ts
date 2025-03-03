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
    const headerHeight = 40; 
    const margin = 15;
    
    // Try to get PDF settings
    let logoUrl = null;
    let headerImageUrl = null;
    
    try {
      const response = await fetch('/api/pdf/print-settings');
      if (response.ok) {
        const settings = await response.json();
        logoUrl = settings.logo;
        headerImageUrl = settings.headerImage;
      }
    } catch (settingsError) {
      console.error('Error fetching PDF settings:', settingsError);
    }
    
    // Add logo if available
    if (logoUrl) {
      try {
        const img = new Image();
        img.src = logoUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails to load
        });
        
        // Draw the logo on the left side
        doc.addImage(img, 'PNG', margin, 10, 20, 20);
      } catch (logoError) {
        console.error('Error adding logo to PDF:', logoError);
      }
    }
    
    // Add company header
    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.text("EVENTS & ENTERTAINMENT", pageWidth/2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text("ENTERPRISES", pageWidth/2, 22, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text("PURCHASE REQUEST", pageWidth/2, 29, { align: 'center' });
    
    // Try to add header image/banner if available
    if (headerImageUrl) {
      try {
        const img = new Image();
        img.src = headerImageUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails to load
        });
        
        // Draw the header image below the text
        doc.addImage(img, 'PNG', margin, 35, pageWidth - (margin * 2), 10);
        return headerHeight + 10; // Add extra space for the image
      } catch (headerImgError) {
        console.error('Error adding header image to PDF:', headerImgError);
      }
    }
    
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
    doc.text(`Purchase Request #${request?.requestNumber?.replace('PR-', '') || '12345'}`, margin, 55);
    
    // Add requester and date on the next row
    doc.setFontSize(9);
    doc.text(`Requester:`, margin, 62);
    doc.text(`${request?.requester?.username || 'John Smith'}`, margin + 30, 62);
    
    doc.text(`Department:`, pageWidth / 2, 62);
    doc.text(`${request?.requester?.department || 'Engineering'}`, pageWidth / 2 + 30, 62);
    
    doc.text(`Date:`, margin, 69);
    let dateText = 'N/A';
    if (request?.createdAt) {
      try {
        dateText = new Date(request.createdAt).toLocaleDateString();
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
      }
    }
    doc.text(dateText, margin + 30, 69);
    
    doc.text(`Status:`, pageWidth / 2, 69);
    doc.text(`${request?.status?.charAt(0).toUpperCase() + request?.status?.slice(1) || 'Pending'}`, pageWidth / 2 + 30, 69);
    
    return 75; // Return position after all header elements
  } catch (error) {
    console.error('Error adding request details:', error);
    return 40; // Return default header height
  }
}

async function addFooter(doc: jsPDF, currentPage: number, totalPages: number): Promise<void> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const footerHeight = 15;
    
    // Try to get PDF settings for footer image
    let footerImageUrl = null;
    let footerColor = [90, 90, 90]; // Default gray color
    let footerText = "ALL RIGHTS RESERVED BY E3";
    
    try {
      const response = await fetch('/api/pdf/print-settings');
      if (response.ok) {
        const settings = await response.json();
        footerImageUrl = settings.footerImage;
        if (settings.footerColor) {
          // Parse color string to RGB
          try {
            const hexColor = settings.footerColor?.replace('#', '');
            if (hexColor && hexColor.length === 6) {
              footerColor = [
                parseInt(hexColor.substring(0, 2), 16),
                parseInt(hexColor.substring(2, 4), 16),
                parseInt(hexColor.substring(4, 6), 16)
              ];
            }
          } catch (colorError) {
            console.error('Error parsing footer color:', colorError);
          }
        }
        if (settings.footerText) {
          footerText = settings.footerText;
        }
      }
    } catch (settingsError) {
      console.error('Error fetching PDF settings for footer:', settingsError);
    }
    
    // Add footer image if available
    if (footerImageUrl) {
      try {
        const img = new Image();
        img.src = footerImageUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails to load
        });
        
        // Draw the footer image
        doc.addImage(img, 'PNG', margin, pageHeight - footerHeight, pageWidth - (margin * 2), 5);
      } catch (footerImgError) {
        console.error('Error adding footer image to PDF:', footerImgError);
      }
    }
    
    // Add footer text
    doc.setFontSize(8);
    doc.setTextColor(footerColor[0], footerColor[1], footerColor[2]);
    doc.text(footerText, margin, pageHeight - 5);
    doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
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
export async function generateRequestPDF(request: any, type: 'user' | 'approver' | 'admin' = 'user') {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const margin = 15;
    let yPos = await addHeader(doc, request);

    // Basic Information Section
    yPos = addSection(doc, "Basic Information", yPos);

    const basicInfo = [
      [
        { content: 'Title:', styles: { fontStyle: 'bold', cellWidth: 25 } },
        { content: request.title || 'N/A', colSpan: 3 }
      ],
      [
        { content: 'Status:', styles: { fontStyle: 'bold', cellWidth: 25 } },
        { content: request.status?.toUpperCase() || 'N/A', cellWidth: 35 },
        { content: 'Priority:', styles: { fontStyle: 'bold', cellWidth: 25 } },
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
        { content: 'Description:', styles: { fontStyle: 'bold', cellWidth: 25 } },
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
        { content: 'Purpose Type:', styles: { fontStyle: 'bold', cellWidth: 25 } },
        { content: request.purposeType || 'N/A', cellWidth: 35 },
        { content: 'Sub-purpose:', styles: { fontStyle: 'bold', cellWidth: 25 } },
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
        { content: 'Vendor Name:', styles: { fontStyle: 'bold', cellWidth: 25 } },
        { content: vendorName, cellWidth: 35 },
        { content: 'Contact Person:', styles: { fontStyle: 'bold', cellWidth: 25 } },
        { content: contactPerson }
      ],
      [
        { content: 'Email:', styles: { fontStyle: 'bold', cellWidth: 25 } },
        { content: vendorEmail, cellWidth: 35 },
        { content: 'Phone:', styles: { fontStyle: 'bold', cellWidth: 25 } },
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
      theme: 'striped',
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
      addFooter(doc, i, pageCount);
    }

    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}