import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { PurchaseRequestWithRelations } from '../types/requests';

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex: string): [number, number, number] {
  // Remove the # if present
  const cleanHex = hex.replace('#', '');
  
  // Handle both 3-char and 6-char hex
  const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substr(4, 2), 16);
  
  // Convert 0-255 to 0-1 range for PDF
  return [r/255, g/255, b/255];
}

/**
 * Add a header to the PDF with company logo and gradient
 */
async function addHeader(doc: jsPDF, request: PurchaseRequestWithRelations, pdfSettings: any): Promise<number> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Default E3 colors
    const primaryColor = [111/255, 42/255, 230/255]; // E3 purple #6F2AE6
    const accentColor = [31/255, 211/255, 219/255]; // E3 teal #1FD3DB
    
    // Get header colors from settings or use defaults
    const headerColor = pdfSettings?.headerColor ? 
      hexToRgb(pdfSettings.headerColor) : primaryColor;
    
    // Start position at top of page
    const startY = 10;
    
    // Get header height from settings or use default
    const headerHeight = pdfSettings?.headerHeight || 30;
    
    // Get margins
    const margin = pdfSettings?.marginLeft || 15;
    
    // Add company logo if available
    if (pdfSettings?.headerImage) {
      try {
        const img = new Image();
        img.src = pdfSettings.headerImage;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails to load
        });
        doc.addImage(img, 'PNG', margin, startY, pageWidth - (margin * 2), headerHeight);
      } catch (error) {
        console.error('Error adding header image:', error);
        
        // Fallback - create a gradient header
        doc.setFillColor(...headerColor);
        doc.rect(margin, startY, pageWidth/2 - margin, 10, 'F');
        
        doc.setFillColor(...accentColor);
        doc.rect(pageWidth/2, startY, pageWidth/2 - margin, 10, 'F');
        
        // Add company name if header image fails
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("EVENTS & ENTERTAINMENT", pageWidth/2, startY + 25, { align: 'center' });
        doc.text("ENTERPRISES", pageWidth/2, startY + 35, { align: 'center' });
      }
    } else {
      // Fallback if no header image is set
      doc.setFillColor(...headerColor);
      doc.rect(margin, startY, pageWidth/2 - margin, 10, 'F');
      
      doc.setFillColor(...accentColor);
      doc.rect(pageWidth/2, startY, pageWidth/2 - margin, 10, 'F');
      
      // Add company name if header image is not available
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("EVENTS & ENTERTAINMENT", pageWidth/2, startY + 25, { align: 'center' });
      doc.text("ENTERPRISES", pageWidth/2, startY + 35, { align: 'center' });
    }
    
    // Add "PURCHASE REQUEST" title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("PURCHASE REQUEST", pageWidth/2, startY + headerHeight + 20, { align: 'center' });
    
    // Add request details table
    const yPos = startY + headerHeight + 30;
    
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
          '',
          ''
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
          'Status:',
          request.status || 'N/A'
        ]
      ],
      didDrawCell: (data) => {
        // Add border around the entire table
        if (data.row.index === 0 && data.column.index === 0) {
          const { x, y, width, height } = data.table;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.rect(x, y, width, height * 3);
        }
      }
    });
    
    return (doc as any).lastAutoTable.finalY + 10;
  } catch (error) {
    console.error('Error adding header:', error);
    return 100; // Return a safe default position
  }
}

/**
 * Add a section title with styling
 */
function addSection(doc: jsPDF, title: string, yPos: number, margin = 15): number {
  // Add a blue background bar
  doc.setFillColor(63/255, 81/255, 181/255);
  doc.rect(margin, yPos, 5, 6, 'F');
  
  // Add section title with a light gray background
  doc.setFillColor(240/255, 240/255, 245/255);
  const pageWidth = doc.internal.pageSize.width;
  doc.rect(margin + 5, yPos, pageWidth - (margin * 2) - 5, 6, 'F');
  
  // Add title text
  doc.setFontSize(10);
  doc.setTextColor(50/255, 50/255, 150/255);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 10, yPos + 4);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  return yPos + 10;
}

/**
 * Add a footer to the PDF
 */
async function addFooter(doc: jsPDF, currentPage: number, totalPages: number, pdfSettings: any): Promise<void> {
  try {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Get footer colors from settings or use defaults
    const primaryColor = [111/255, 42/255, 230/255]; // E3 purple
    const accentColor = [31/255, 211/255, 219/255]; // E3 teal
    const footerColor = pdfSettings?.footerColor ? 
      hexToRgb(pdfSettings.footerColor) : primaryColor;
    
    // Get margins and footer height
    const margin = pdfSettings?.marginLeft || 15;
    const footerHeight = pdfSettings?.footerHeight || 30;
    const footerY = pageHeight - footerHeight - 10;
    
    // Add footer image if available
    if (pdfSettings?.footerImage) {
      try {
        const img = new Image();
        img.src = pdfSettings.footerImage;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails to load
        });
        doc.addImage(img, 'PNG', margin, footerY, pageWidth - (margin * 2), footerHeight);
      } catch (error) {
        console.error('Error adding footer image:', error);
        
        // Fallback - create a gradient footer
        doc.setFillColor(...footerColor);
        doc.rect(margin, footerY, pageWidth/2 - margin, 5, 'F');
        
        doc.setFillColor(...accentColor);
        doc.rect(pageWidth/2, footerY, pageWidth/2 - margin, 5, 'F');
      }
    } else {
      // Fallback if no footer image is set
      doc.setFillColor(...footerColor);
      doc.rect(margin, footerY, pageWidth/2 - margin, 5, 'F');
      
      doc.setFillColor(...accentColor);
      doc.rect(pageWidth/2, footerY, pageWidth/2 - margin, 5, 'F');
    }
    
    // Add page numbers
    if (pdfSettings?.pageNumbering !== false) {
      doc.setFontSize(8);
      doc.setTextColor(100/255, 100/255, 100/255);
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }
    
    // Add footer text if provided
    if (pdfSettings?.footerText) {
      doc.setFontSize(8);
      doc.setTextColor(100/255, 100/255, 100/255);
      doc.text(pdfSettings.footerText, margin, pageHeight - 10);
    }
  } catch (error) {
    console.error('Error adding footer:', error);
  }
}

/**
 * Generate a professional PDF for the purchase request
 * @param request Purchase request data
 * @param type Type of PDF to generate
 * @returns jsPDF document
 */
export async function generateEnhancedPDF(request: PurchaseRequestWithRelations, type: 'user' | 'approver' | 'admin' = 'user'): Promise<jsPDF> {
  try {
    // Fetch PDF settings
    let pdfSettings = null;
    try {
      const response = await fetch('/api/pdf/print-settings');
      if (response.ok) {
        pdfSettings = await response.json();
      }
    } catch (error) {
      console.error('Error fetching PDF settings:', error);
    }
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Add header
    let yPos = await addHeader(doc, request, pdfSettings);
    
    // Add Basic Information section
    yPos = addSection(doc, 'Basic Information', yPos);
    
    autoTable(doc, {
      startY: yPos,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      body: [
        [
          'Title:',
          request.title || 'N/A',
          'Status:',
          request.status?.toUpperCase() || 'N/A'
        ],
        [
          'Description:',
          request.description || 'N/A',
          'Priority:',
          request.priority?.toUpperCase() || 'N/A'
        ],
        [
          'Purpose Type:',
          request.purposeType || 'N/A',
          'Sub-purpose:',
          request.subPurpose?.name || 'N/A'
        ]
      ]
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Add Vendor Information section
    yPos = addSection(doc, 'Vendor Information', yPos);
    
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
    yPos = addSection(doc, 'Items', yPos);
    
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
      yPos = addSection(doc, 'Attached Documents', yPos);
      
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
      yPos = addSection(doc, 'Approval Status', yPos);
      
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
      
      // Requester signature
      doc.line(margin, yPos + 15, margin + lineWidth, yPos + 15);
      doc.setFontSize(9);
      doc.text('Requester Signature', margin, yPos + 20);
      
      // Approver signature
      doc.line(margin + lineWidth + 20, yPos + 15, pageWidth - margin, yPos + 15);
      doc.text('Approver Signature', margin + lineWidth + 20, yPos + 20);
    }
    
    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      await addFooter(doc, i, pageCount, pdfSettings);
    }
    
    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}