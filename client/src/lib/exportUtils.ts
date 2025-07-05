/**
 * Export Utilities
 * 
 * Provides comprehensive export functionality in multiple formats:
 * - Excel (.xlsx): Comprehensive export with multiple sheets
 * - CSV: Simple tabular format
 * - PDF: Professional document format
 * - ZIP: With attachments and files
 * 
 * This module has been updated to support bulk exports with enhanced reliability
 */

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';
import { jsPDF } from 'jspdf';

// Correct import pattern from official documentation
import { autoTable } from 'jspdf-autotable';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { logPdfAuditEvent, generatePdfTrackingId, applyPdfWatermark } from './pdfAuditUtils';
import { generateProfessionalPdf } from './professionalPdfGenerator';

/**
 * Safely download a file using FileSaver with fallbacks
 */
export async function safeDownload(blob: Blob, fileName: string): Promise<boolean> {
  console.log("safeDownload called with:", { fileName, blobType: blob.type, blobSize: blob.size });
  
  // Direct object URL method (more reliable in most browsers)
  try {
    console.log("Using direct Object URL download method...");
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Use a small timeout to ensure the link is properly added to the DOM
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log("Clicking download link...");
    link.click();
    
    // Cleanup after a small delay to ensure the download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log("Download link cleanup completed");
    }, 100);
    
    return true;
  } catch (directError) {
    console.error("Direct download error:", directError);
    
    // FileSaver fallback
    try {
      console.log("Trying FileSaver fallback...");
      saveAs(blob, fileName);
      console.log("FileSaver method succeeded");
      return true;
    } catch (fallbackError) {
      console.error("All download methods failed:", fallbackError);
      return false;
    }
  }
}

/**
 * Calculate the total cost of a purchase request
 */
function calculateTotalCost(request: any): number {
  try {
    if (!request?.items || !Array.isArray(request.items)) return 0;
    
    // Calculate the sum of all items
    const itemsTotal = request.items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0;
      const cost = Number(item.estimatedCost) || 0;
      const itemCost = quantity * cost;
      return sum + itemCost;
    }, 0);
    
    // Add any freight amount
    const freightAmount = Number(request.freightAmount) || 0;
    
    return itemsTotal + freightAmount;
  } catch (error) {
    console.error('Error calculating total cost:', error);
    return 0;
  }
}

/**
 * Format a purchase request for export with comprehensive field coverage
 */
function formatRequestForExport(request: any) {
  try {
    if (!request) return {};
    
    // Calculate totals
    const totalCost = calculateTotalCost(request);
    
    // Format timestamps
    const createdAt = request.createdAt 
      ? new Date(request.createdAt).toLocaleString() 
      : 'N/A';
    
    const updatedAt = request.updatedAt 
      ? new Date(request.updatedAt).toLocaleString() 
      : 'N/A';
    
    // Format approval summary
    const approvalSummary = getApprovalSummary(request);
    
    // Get item details summary
    const itemDetails = request.items && request.items.length > 0
      ? request.items.map((item: any, index: number) => 
          `${index + 1}. ${item.name} x${item.quantity} - $${Number(item.estimatedCost).toFixed(2)}`
        ).join('; ')
      : 'No items';
    
    // Build a comprehensive export object
    return {
      'ID': request.id || '',
      'Request Number': request.requestNumber || `PR-${request.id || ''}`,
      'Title': request.title || '',
      'Status': request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : '',
      'Priority': request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : '',
      'Requester': request.requester?.username || '',
      'Department': request.requester?.department || '',
      'Created': createdAt,
      'Last Updated': updatedAt,
      'Description': request.description || '',
      'Total Cost': totalCost.toFixed(2),
      'Items Count': request.items?.length || 0,
      'Item Details': itemDetails,
      'Approval Summary': approvalSummary,
      'Freight Amount': request.freightAmount ? Number(request.freightAmount).toFixed(2) : '0.00',
      'Attachments Count': request.attachments?.length || 0,
      'Vendor': request.vendor?.name || '',
      'Notes': request.notes || ''
    };
  } catch (error) {
    console.error('Error formatting request for export:', error);
    return {
      'Error': 'Failed to format request',
      'Request ID': request?.id || 'Unknown'
    };
  }
}

/**
 * Get a summary of approval status
 */
function getApprovalSummary(request: any): string {
  try {
    if (!request.approvals || !Array.isArray(request.approvals) || request.approvals.length === 0) {
      return 'No approvals';
    }
    
    // Create a map to keep track of the latest approval for each department
    const departmentMap = new Map<string, any>();
    
    // Process all approvals to find the latest for each department
    request.approvals.forEach((approval: any) => {
      const department = approval.department || 'Unknown';
      
      if (!departmentMap.has(department) || 
          (new Date(approval.processedAt || 0) > new Date(departmentMap.get(department).processedAt || 0))) {
        departmentMap.set(department, approval);
      }
    });
    
    // Convert the map to a summary string
    const summaryParts = Array.from(departmentMap.entries()).map(([department, approval]) => {
      const status = approval.status ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1) : 'Unknown';
      return `${department}: ${status}`;
    });
    
    return summaryParts.join('; ');
  } catch (error) {
    console.error('Error generating approval summary:', error);
    return 'Error processing approvals';
  }
}

/**
 * Export a purchase request to CSV format
 */
export async function exportRequestToCSV(request: any, roleForAudit: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
  try {
    const formattedRequest = formatRequestForExport(request);
    
    // Create CSV content
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    const csv = parser.parse([formattedRequest]);
    
    // Add BOM (Byte Order Mark) to ensure Excel can open the file correctly with UTF-8
    const bomPrefix = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvContent = new Uint8Array(csv.length);
    for (let i = 0; i < csv.length; i++) {
      csvContent[i] = csv.charCodeAt(i);
    }
    
    // Combine BOM and CSV content
    const finalContent = new Uint8Array(bomPrefix.length + csvContent.length);
    finalContent.set(bomPrefix);
    finalContent.set(csvContent, bomPrefix.length);
    
    // Generate timestamp for filename
    const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm');
    const requestId = request.id || 'unknown';
    const fileName = `purchase-request-${requestId}-${timestamp}.csv`;
    
    // Create blob for download
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' });
    
    // Log the export for audit tracking purposes
    try {
      await logPdfAuditEvent(
        requestId,
        'csv_downloaded',
        {
          trackingId: generatePdfTrackingId(requestId),
          exportType: 'csv',
          fileName,
          fileSize: finalContent.length,
          timestamp: new Date().toISOString(),
          roleType: roleForAudit
        },
        roleForAudit
      );
    } catch (auditError) {
      // Don't block export if audit logging fails
      console.error('Failed to log CSV export audit event:', auditError);
    }
    
    // Download the file
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`CSV export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('CSV export error:', error);
    throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export a purchase request to Excel format with multiple sheets
 */
export async function exportRequestToExcel(request: any, roleForAudit: 'user' | 'approver' | 'admin' = 'user'): Promise<string> {
  try {
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Add a summary sheet
    const summaryData = [formatRequestForExport(request)];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    
    // Add an items sheet if available
    if (request.items && request.items.length > 0) {
      const itemsData = request.items.map((item: any, index: number) => ({
        'Item #': index + 1,
        'Name': item.name || '',
        'Description': item.description || '',
        'Quantity': Number(item.quantity) || 0,
        'Unit Cost': Number(item.estimatedCost).toFixed(2),
        'Total Cost': ((Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0)).toFixed(2),
        'SKU/Part Number': item.sku || '',
        'Category': item.category || '',
        'Notes': item.notes || ''
      }));
      
      const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items');
    }
    
    // Add approvals sheet if available
    if (request.approvals && request.approvals.length > 0) {
      const approvalsData = request.approvals.map((approval: any) => ({
        'Department': approval.department || '',
        'Status': approval.status ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1) : '',
        'Processed By': approval.approver?.username || '',
        'Processed On': approval.processedAt ? new Date(approval.processedAt).toLocaleString() : '',
        'Comments': approval.comments || ''
      }));
      
      const approvalsSheet = XLSX.utils.json_to_sheet(approvalsData);
      XLSX.utils.book_append_sheet(wb, approvalsSheet, 'Approvals');
    }
    
    // Generate timestamp for filename
    const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm');
    const requestId = request.id || 'unknown';
    const fileName = `purchase-request-${requestId}-${timestamp}.xlsx`;
    
    // Convert workbook to array buffer and create blob
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Log the export to audit trail
    try {
      await logPdfAuditEvent(
        requestId,
        'excel_downloaded',
        {
          trackingId: generatePdfTrackingId(requestId),
          exportType: 'excel',
          fileName,
          fileSize: blob.size,
          timestamp: new Date().toISOString(),
          roleType: roleForAudit,
          sheetCount: Object.keys(wb.Sheets || {}).length
        },
        roleForAudit
      );
    } catch (auditError) {
      // Don't block export if audit logging fails
      console.error('Failed to log Excel export audit event:', auditError);
    }
    
    // Download the file
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`Excel export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Excel export error:', error);
    throw new Error(`Failed to export Excel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export a purchase request to PDF format
 */
export async function exportRequestToPDF(request: any, roleForAudit: 'user' | 'approver' | 'admin' = 'user', pdfSettings?: any): Promise<string> {
  try {
    console.log('Creating PDF export...');
    
    // Use the new simple PDF generator that doesn't rely on autoTable
    const { generateSimplePDF } = await import('./simplePdfGenerator');
    const result = await generateSimplePDF(request, 'purchase');
    
    if (!result.success) {
      throw new Error(result.error || 'PDF generation failed');
    }
    
    // Create download link
    const fileName = `purchase-request-${request.id}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    const url = URL.createObjectURL(result.blob!);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    URL.revokeObjectURL(url);
    
    console.log('PDF export completed successfully');
    return fileName;
  } catch (error) {
    console.error("PDF export error:", error);
    throw error;
  }
}

export async function exportRequestToPDFOld(request: any, roleForAudit: 'user' | 'approver' | 'admin' = 'user', pdfSettings?: any): Promise<string> {
  try {
    // Apply PDF settings if available
    const settings = pdfSettings || {};
    
    // Create PDF document with configurable margins
    const marginTop = settings.marginTop || 20;
    const marginLeft = settings.marginLeft || 20;
    const marginRight = settings.marginRight || 20;
    const marginBottom = settings.marginBottom || 20;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    }) as any;
    
    // Apply font settings from admin panel
    const fontSize = settings.fontSize || 10;
    const fontFamily = settings.fontFamily || 'helvetica';
    
    try {
      doc.setFont(fontFamily);
    } catch {
      doc.setFont('helvetica'); // Fallback
    }
    
    // Apply text colors from settings
    const parseColor = (colorHex: string): [number, number, number] => {
      if (!colorHex || !colorHex.startsWith('#')) return [0, 0, 0];
      const hex = colorHex.substring(1);
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16)
      ];
    };
    
    const textColor = parseColor(settings.textColor || '#000000');
    const headerColor = parseColor(settings.headerColor || '#000000');
    const tableHeaderColor = parseColor(settings.tableHeaderColor || '#f0f0f0');
    
    let currentY = marginTop;
    const pageWidth = 210 - marginLeft - marginRight; // A4 width minus margins
    
    // Header with title and request info - use header color from settings
    doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.setFontSize(settings.headerFontSize || 16);
    doc.setFont(fontFamily, 'bold');
    doc.text(settings.companyName || 'PURCHASE REQUEST', marginLeft, currentY);
    
    // Request number and date on the right
    const requestNumber = request.requestNumber || `PR-${request.id}`;
    const dateCreated = request.createdAt ? new Date(request.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    
    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const rightColumnX = marginLeft + pageWidth - 50;
    doc.text(`PR #${request.id}`, rightColumnX, currentY - 5);
    doc.text(`Date: ${dateCreated}`, rightColumnX, currentY + 2);
    
    currentY += 15;
    
    // Top info section with configurable background color
    const sectionBgColor = parseColor(settings.sectionBackgroundColor || '#f0f0f0');
    doc.setFillColor(sectionBgColor[0], sectionBgColor[1], sectionBgColor[2]);
    doc.rect(marginLeft, currentY, pageWidth, 20, 'F');
    
    currentY += 5;
    
    // Two column layout for basic info - use settings
    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Left column
    doc.text('Requester:', marginLeft + 5, currentY);
    doc.text(request.requester?.username || 'N/A', marginLeft + 25, currentY);
    
    // Right column  
    doc.text('Department:', marginLeft + pageWidth/2, currentY);
    doc.text(request.requester?.department || 'N/A', marginLeft + pageWidth/2 + 25, currentY);
    
    currentY += 7;
    
    // Second row
    doc.text('Status:', marginLeft + 5, currentY);
    doc.text((request.status || 'PENDING').toUpperCase(), marginLeft + 25, currentY);
    
    doc.text('Priority:', marginLeft + pageWidth/2, currentY);
    doc.text((request.priority || 'MEDIUM').toUpperCase(), marginLeft + pageWidth/2 + 25, currentY);
    
    currentY += 10;
    
    // BASIC INFORMATION Section - use settings for section headers
    const sectionHeaderBgColor = parseColor(settings.sectionHeaderColor || '#000000');
    doc.setFillColor(sectionHeaderBgColor[0], sectionHeaderBgColor[1], sectionHeaderBgColor[2]);
    doc.rect(marginLeft, currentY, pageWidth, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, 'bold');
    doc.text('BASIC INFORMATION', marginLeft + 2, currentY + 5);
    
    currentY += 15;
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont(fontFamily, 'normal');
    
    // Basic info fields - conditionally show based on settings
    if (settings.showTitle !== false) {
      doc.text('Title:', marginLeft + 5, currentY);
      doc.text(request.title || 'N/A', marginLeft + 25, currentY);
      currentY += 7;
    }
    
    if (settings.showDescription !== false) {
      doc.text('Description:', marginLeft + 5, currentY);
      const description = request.description || 'No description provided';
      doc.text(description, marginLeft + 25, currentY);
      currentY += 7;
    }
    
    if (settings.showPurposeDetails !== false) {
      doc.text('Purpose Type:', marginLeft + 5, currentY);
      doc.text(request.purposeType || 'N/A', marginLeft + 25, currentY);
      
      doc.text('Sub-purpose:', marginLeft + pageWidth/2, currentY);
      doc.text(request.subPurpose?.name || 'N/A', marginLeft + pageWidth/2 + 25, currentY);
      currentY += 7;
    }
    
    if (settings.showContactInfo !== false) {
      doc.text('Contact Info:', marginLeft + 5, currentY);
      const contactInfo = `Email: ${request.requester?.email || 'N/A'}`;
      doc.text(contactInfo, marginLeft + 25, currentY);
      currentY += 7;
    }
    
    currentY += 15;
    
    // VENDOR INFORMATION Section
    if (request.vendor && (request.vendor.companyName || request.vendor.name) && settings.showVendorDetails !== false) {
      doc.setFillColor(sectionHeaderBgColor[0], sectionHeaderBgColor[1], sectionHeaderBgColor[2]);
      doc.rect(marginLeft, currentY, pageWidth, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(fontSize);
      doc.setFont(fontFamily, 'bold');
      doc.text('VENDOR INFORMATION', marginLeft + 2, currentY + 5);
      
      currentY += 15;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont(fontFamily, 'normal');
      
      // Vendor info in two columns
      const vendorName = request.vendor.companyName || request.vendor.name;
      doc.text('Vendor Name:', marginLeft + 5, currentY);
      doc.text(vendorName, marginLeft + 30, currentY);
      
      doc.text('Contact Person:', marginLeft + pageWidth/2, currentY);
      doc.text(request.vendor.contactPerson || 'N/A', marginLeft + pageWidth/2 + 30, currentY);
      currentY += 7;
      
      doc.text('Email:', marginLeft + 5, currentY);
      doc.text(request.vendor.email || 'N/A', marginLeft + 30, currentY);
      
      doc.text('Phone:', marginLeft + pageWidth/2, currentY);
      doc.text(request.vendor.contactNumber || 'N/A', marginLeft + pageWidth/2 + 30, currentY);
      
      currentY += 15;
    }
    
    // ITEMS Section
    if (request.items && request.items.length > 0 && settings.showItemsTable !== false) {
      doc.setFillColor(sectionHeaderBgColor[0], sectionHeaderBgColor[1], sectionHeaderBgColor[2]);
      doc.rect(marginLeft, currentY, pageWidth, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(fontSize);
      doc.setFont(fontFamily, 'bold');
      doc.text('ITEMS', marginLeft + 2, currentY + 5);
      
      currentY += 15;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const tableHead = [['Item', 'Description', 'Qty', 'Unit Cost', 'Total']];
      const tableBody = request.items.map((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitCost = Number(item.estimatedCost) || 0;
        const totalCost = quantity * unitCost;
        
        return [
          item.name || 'N/A',
          item.description || 'N/A',
          quantity.toString(),
          `${request.currency || 'USD'} ${unitCost.toFixed(2)}`,
          `${request.currency || 'USD'} ${totalCost.toFixed(2)}`
        ];
      });

      // @ts-ignore - jsPDF-AutoTable adds this method
      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: currentY,
        margin: { left: marginLeft, right: marginRight },
        theme: 'grid',
        styles: { 
          fontSize: fontSize - 1, 
          cellPadding: 2,
          font: fontFamily,
          textColor: textColor
        },
        headStyles: { 
          fillColor: tableHeaderColor,
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          font: fontFamily
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 60 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' }
        }
      });
      
      // @ts-ignore - jsPDF-AutoTable adds this property
      currentY = doc.lastAutoTable.finalY + 5;
      
      // Add financial summary
      const itemsTotal = request.items.reduce((sum: number, item: any) => {
        return sum + (Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0);
      }, 0);
      
      const rightAlign = marginLeft + pageWidth - 40;
      
      doc.setFont('helvetica', 'normal');
      doc.text('Items Total:', rightAlign - 30, currentY);
      doc.text(`${request.currency || 'USD'} ${itemsTotal.toFixed(2)}`, rightAlign, currentY);
      currentY += 7;
      
      if (request.freightAmount) {
        doc.text('Freight:', rightAlign - 30, currentY);
        doc.text(`${request.currency || 'USD'} ${Number(request.freightAmount).toFixed(2)}`, rightAlign, currentY);
        currentY += 7;
      }
      
      const totalCost = request.totalEstimatedCost || (itemsTotal + (Number(request.freightAmount) || 0));
      doc.setFont('helvetica', 'bold');
      doc.text('Total Cost:', rightAlign - 30, currentY);
      doc.text(`${request.currency || 'USD'} ${Number(totalCost).toFixed(2)}`, rightAlign, currentY);
      
      currentY += 15;
    }
    
    // ATTACHED DOCUMENTS Section
    if (request.attachments && request.attachments.length > 0 && settings.showAttachments !== false) {
      doc.setFillColor(sectionHeaderBgColor[0], sectionHeaderBgColor[1], sectionHeaderBgColor[2]);
      doc.rect(marginLeft, currentY, pageWidth, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(fontSize);
      doc.setFont(fontFamily, 'bold');
      doc.text('ATTACHED DOCUMENTS', marginLeft + 2, currentY + 5);
      
      currentY += 15;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont(fontFamily, 'normal');
      
      // Attachments table
      const attachmentHead = [['Document Name', 'Type', 'Size']];
      const attachmentBody = request.attachments.map((attachment: any) => [
        attachment.fileName || 'N/A',
        attachment.fileType || 'Unknown',
        attachment.fileSize ? `${(attachment.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'
      ]);

      // @ts-ignore - jsPDF-AutoTable adds this method
      autoTable(doc, {
        head: attachmentHead,
        body: attachmentBody,
        startY: currentY,
        margin: { left: marginLeft, right: marginRight },
        theme: 'grid',
        styles: { 
          fontSize: fontSize - 1, 
          cellPadding: 2,
          font: fontFamily,
          textColor: textColor
        },
        headStyles: { 
          fillColor: tableHeaderColor,
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          font: fontFamily
        }
      });
      
      // @ts-ignore - jsPDF-AutoTable adds this property
      currentY = doc.lastAutoTable.finalY + 15;
    }

    // SIGNATURES Section (if enabled in settings)
    if (settings.showSignatures !== false) {
      doc.setFillColor(sectionHeaderBgColor[0], sectionHeaderBgColor[1], sectionHeaderBgColor[2]);
      doc.rect(marginLeft, currentY, pageWidth, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(fontSize);
      doc.setFont(fontFamily, 'bold');
      doc.text('SIGNATURES', marginLeft + 2, currentY + 5);
      
      currentY += 20;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont(fontFamily, 'normal');
      
      // Add signature lines (placeholder)
      // This section would be filled when approvals are processed
      
      currentY += 30;
    }
    
    // Apply watermark if enabled in settings
    if (settings.watermarkText && settings.showWatermark !== false) {
      applyPdfWatermark(doc, settings.watermarkText, settings.watermarkOpacity || 0.1);
    }
    
    // Add footer information using settings
    currentY = doc.internal.pageSize.height - 25;
    
    doc.setFontSize(fontSize - 2);
    doc.setTextColor(100, 100, 100);
    const footerInfo = settings.footerText || 'Phone: +974 30488565 | Email: info@eeegq.com | Web: www.eeegq.com';
    const footerAddress = settings.footerAddress || 'Palm Tower B 36th Floor, 3602 West Bay, Doha, Qatar';
    
    doc.text(footerInfo, marginLeft, currentY);
    doc.text(footerAddress, marginLeft, currentY + 5);
    
    // Page number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(fontSize - 2);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${pageCount}`, marginLeft + pageWidth - 20, currentY + 10);
    }
    
    // Add tracking ID and audit watermark for security
    const requestId = request.id || 'unknown';
    const trackingId = generatePdfTrackingId(requestId);
    
    // Apply watermark using settings
    const watermarkText = settings.watermarkText || trackingId;
    const watermarkOpacity = settings.watermarkOpacity ? settings.watermarkOpacity / 100 : 0.1;
    applyPdfWatermark(doc, watermarkText, watermarkOpacity);
    
    // Generate timestamp for filename
    const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm');
    const fileName = `purchase-request-${requestId}-${timestamp}.pdf`;
    
    // Generate blob from PDF
    const pdfBlob = doc.output('blob');
    
    // Log the export to audit trail
    try {
      await logPdfAuditEvent(
        requestId,
        'pdf_downloaded',
        {
          trackingId,
          exportType: 'single_pdf',
          fileName,
          fileSize: pdfBlob.size,
          timestamp: new Date().toISOString(),
          pageCount,
          roleType: roleForAudit
        },
        roleForAudit
      );
    } catch (auditError) {
      // Don't block export if audit logging fails
      console.error('Failed to log PDF export audit event:', auditError);
    }
    
    // Download the file
    const downloadResult = await safeDownload(pdfBlob, fileName);
    console.log(`PDF export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests to Excel format
 */
export async function exportMultipleRequestsToExcel(requests: any[]): Promise<string> {
  try {
    console.log(`Starting Excel export for ${requests.length} requests`);
    
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Add a summary sheet
    const summaryData = requests.map((request, index) => {
      return {
        'ID': request.id || '',
        'Request Number': request.requestNumber || `PR-${request.id || ''}`,
        'Title': request.title || '',
        'Status': request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : '',
        'Requester': request.requester?.username || '',
        'Department': request.requester?.department || '',
        'Priority': request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : '',
        'Cost': (request.totalEstimatedCost || calculateTotalCost(request)).toFixed(2),
        'Items Count': request.items?.length || 0,
        'Created Date': request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '',
      };
    });
    
    // Create the summary sheet
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    
    // Add a sheet for each status type
    const statusGroups: Record<string, any[]> = {};
    requests.forEach(request => {
      const status = request.status || 'unknown';
      if (!statusGroups[status]) statusGroups[status] = [];
      statusGroups[status].push(request);
    });
    
    // Create status-based sheets
    Object.entries(statusGroups).forEach(([status, statusRequests]) => {
      const sheetName = status.charAt(0).toUpperCase() + status.slice(1);
      const statusData = statusRequests.map((request) => formatRequestForExport(request));
      const statusSheet = XLSX.utils.json_to_sheet(statusData);
      XLSX.utils.book_append_sheet(wb, statusSheet, sheetName.substring(0, 31)); // Excel has a 31 char limit for sheet names
    });
    
    // Create a sheet with all items
    const allItems: any[] = [];
    requests.forEach(request => {
      if (request.items && Array.isArray(request.items)) {
        request.items.forEach((item: any) => {
          allItems.push({
            'Request ID': request.id || '',
            'Request Number': request.requestNumber || `PR-${request.id || ''}`,
            'Item Name': item.name || '',
            'Description': item.description || '',
            'Quantity': Number(item.quantity) || 0,
            'Unit Cost': (Number(item.estimatedCost) || 0).toFixed(2),
            'Total Cost': ((Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0)).toFixed(2),
          });
        });
      }
    });
    
    if (allItems.length > 0) {
      const itemsSheet = XLSX.utils.json_to_sheet(allItems);
      XLSX.utils.book_append_sheet(wb, itemsSheet, 'All Items');
    }
    
    // Generate timestamp for filename
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-excel-export-${timestamp}.xlsx`;
    
    // Convert workbook to array buffer and create blob
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Create tracking ID for audit purposes
    const referenceId = requests[0]?.id || 0;
    const trackingId = generatePdfTrackingId(referenceId);
    
    // Log the export to audit trail
    try {
      await logPdfAuditEvent(
        referenceId,
        'excel_downloaded',
        {
          trackingId,
          exportType: 'bulk_excel',
          fileName,
          fileSize: blob.size,
          timestamp: new Date().toISOString(),
          recordCount: requests.length,
          sheetCount: Object.keys(statusGroups).length + 2, // Summary + status sheets + items sheet
        },
        'user'
      );
    } catch (auditError) {
      // Non-critical - don't block export if audit logging fails
      console.error('Failed to log bulk Excel export audit event:', auditError);
    }
    
    // Download the file
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`Excel export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Multiple Excel export error:', error);
    throw new Error(`Failed to export Excel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests to CSV format
 */
export async function exportMultipleRequestsToCSV(requests: any[]): Promise<string> {
  try {
    console.log(`Starting CSV export for ${requests.length} requests`);
    
    // Format requests for CSV export
    const formattedRequests = requests.map(request => formatRequestForExport(request));
    
    // Create CSV content with parser
    const parser = new Parser({
      delimiter: ',',
      header: true
    });
    
    const csv = parser.parse(formattedRequests);
    
    // Add BOM (Byte Order Mark) to ensure Excel can open the file correctly with UTF-8
    const bomPrefix = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvContent = new Uint8Array(csv.length);
    for (let i = 0; i < csv.length; i++) {
      csvContent[i] = csv.charCodeAt(i);
    }
    
    // Combine BOM and CSV content
    const finalContent = new Uint8Array(bomPrefix.length + csvContent.length);
    finalContent.set(bomPrefix);
    finalContent.set(csvContent, bomPrefix.length);
    
    // Generate timestamp for filename
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-csv-export-${timestamp}.csv`;
    
    // Create blob for download
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create tracking ID for audit purposes
    const referenceId = requests[0]?.id || 0;
    const trackingId = generatePdfTrackingId(referenceId);
    
    // Log the export for audit tracking purposes
    try {
      await logPdfAuditEvent(
        referenceId,
        'csv_downloaded', // We reuse this action type for consistency in reporting
        {
          trackingId,
          exportType: 'bulk_csv',
          fileName,
          fileSize: finalContent.length,
          timestamp: new Date().toISOString(),
          recordCount: requests.length,
          fields: Object.keys(formattedRequests[0] || {}).length
        },
        'user'
      );
    } catch (auditError) {
      // Don't block export if audit logging fails
      console.error('Failed to log bulk CSV export audit event:', auditError);
    }
    
    const downloadResult = await safeDownload(blob, fileName);
    console.log(`CSV export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Multiple CSV export error:', error);
    throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests to PDF format
 */
export async function exportMultipleRequestsToPDF(requests: any[]): Promise<string> {
  try {
    console.log(`Starting PDF export for ${requests.length} requests`);
    
    // Create a ZIP file to contain all the individual PDFs
    const zip = new JSZip();
    
    // Create a directory for the PDFs
    const pdfsFolder = zip.folder('purchase-requests-pdfs');
    if (!pdfsFolder) throw new Error('Failed to create PDFs folder in ZIP archive');
    
    // Track successfully generated PDFs
    let successCount = 0;
    
    // Generate a PDF for each request
    for (const request of requests) {
      try {
        // Create PDF document with jsPDF
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // Add header
        doc.setFontSize(16);
        doc.text(`Purchase Request: ${request.requestNumber || request.id}`, 14, 15);
        
        // Add basic information
        doc.setFontSize(11);
        const startY = 25;
        const lineHeight = 7;
        
        doc.text(`Title: ${request.title || 'N/A'}`, 14, startY);
        doc.text(`Status: ${request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'N/A'}`, 14, startY + lineHeight);
        doc.text(`Requester: ${request.requester?.username || 'N/A'}`, 14, startY + lineHeight * 2);
        doc.text(`Department: ${request.requester?.department || 'N/A'}`, 14, startY + lineHeight * 3);
        doc.text(`Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}`, 14, startY + lineHeight * 4);
        
        // Add description
        doc.setFontSize(11);
        doc.text('Description:', 14, startY + lineHeight * 5);
        doc.setFontSize(10);
        
        // Split description text to prevent overflow
        const description = request.description || 'No description provided';
        const splitDescription = doc.splitTextToSize(description, 180);
        doc.text(splitDescription, 14, startY + lineHeight * 6);
        
        // Add items table if present
        if (request.items && request.items.length > 0) {
          const tableY = startY + lineHeight * 7 + splitDescription.length * 5;
          
          doc.setFontSize(11);
          doc.text('Items:', 14, tableY);
          
          const tableHead = [['#', 'Name', 'Description', 'Quantity', 'Est. Cost']];
          const tableBody = request.items.map((item: any, index: number) => [
            (index + 1).toString(),
            item.name || 'N/A',
            item.description || 'N/A',
            (Number(item.quantity) || 0).toString(),
            (Number(item.estimatedCost) || 0).toFixed(2)
          ]);
          
          // @ts-ignore - jsPDF-AutoTable adds this method
          autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: tableY + 5,
            margin: { left: 14 },
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [66, 139, 202] }
          });
        }
        
        // Convert to blob and add to ZIP
        const pdfBlob = doc.output('blob');
        const pdfBuffer = await pdfBlob.arrayBuffer();
        
        // Add to ZIP with filename that includes request number/ID
        const requestId = request.id || 'unknown';
        const requestNumber = request.requestNumber || `PR-${requestId}`;
        pdfsFolder.file(`${requestNumber}.pdf`, pdfBuffer);
        
        successCount++;
      } catch (requestError) {
        console.error(`Error generating PDF for request ID ${request.id}:`, requestError);
        // Continue with other requests even if one fails
      }
    }
    
    // If no PDFs were successfully generated, throw error
    if (successCount === 0) {
      throw new Error('Failed to generate any PDFs for the selected requests');
    }
    
    // Generate ZIP file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-pdf-export-${timestamp}.zip`;
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create audit record
    const referenceId = requests[0]?.id || 0;
    const trackingId = generatePdfTrackingId(referenceId);
    
    try {
      await logPdfAuditEvent(
        referenceId,
        'pdf_downloaded',
        {
          trackingId,
          exportType: 'bulk_pdf_zip',
          fileName,
          fileSize: zipBlob.size,
          timestamp: new Date().toISOString(),
          recordCount: requests.length,
          compressionType: 'zip',
          type: 'user'
        },
        'user'
      );
    } catch (auditError) {
      console.error('Failed to log PDF export audit event:', auditError);
    }
    
    // Download the ZIP file
    const downloadResult = await safeDownload(zipBlob, fileName);
    console.log(`PDF export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Error during bulk PDF export:', error);
    throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export multiple purchase requests as a ZIP file with attachments
 */
export async function exportMultipleRequestsAsZip(requests: any[], includeAttachments: boolean = true): Promise<string> {
  try {
    console.log(`Starting ZIP export for ${requests.length} requests`);
    
    // Create a new ZIP archive
    const zip = new JSZip();
    
    // Process each request
    for (const request of requests) {
      try {
        console.log(`Formatting request #${request.id} for export`);
        // Create a folder for this request
        const requestId = request.id;
        const requestNumber = request.requestNumber || `PR-${requestId}`;
        const requestFolder = zip.folder(requestNumber);
        
        if (!requestFolder) {
          console.error(`Failed to create folder for request ${requestNumber}`);
          continue; // Skip this request
        }
        
        // Add request details as JSON
        const requestData = JSON.stringify(request, null, 2);
        requestFolder.file('request-data.json', requestData);
        
        // Add a summary text file
        const summary = `
Purchase Request Summary
=======================
Request ID: ${requestId}
Request Number: ${requestNumber}
Title: ${request.title || 'N/A'}
Status: ${request.status || 'N/A'}
Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}
Requester: ${request.requester?.username || 'N/A'}
Department: ${request.requester?.department || 'N/A'}
Items Count: ${request.items?.length || 0}
        `;
        requestFolder.file('summary.txt', summary);
        
        // Generate a simple PDF view
        try {
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          // Add header
          doc.setFontSize(16);
          doc.text(`Purchase Request: ${requestNumber}`, 14, 15);
          
          // Add basic information
          doc.setFontSize(11);
          const startY = 25;
          const lineHeight = 7;
          
          doc.text(`Title: ${request.title || 'N/A'}`, 14, startY);
          doc.text(`Status: ${request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'N/A'}`, 14, startY + lineHeight);
          doc.text(`Requester: ${request.requester?.username || 'N/A'}`, 14, startY + lineHeight * 2);
          doc.text(`Department: ${request.requester?.department || 'N/A'}`, 14, startY + lineHeight * 3);
          doc.text(`Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}`, 14, startY + lineHeight * 4);
          
          const pdfOutput = doc.output('arraybuffer');
          requestFolder.file(`${requestNumber}.pdf`, pdfOutput);
        } catch (pdfError) {
          console.error(`Error generating PDF for request ${requestId}:`, pdfError);
          // Continue without PDF if generation fails
        }
        
        // Add items information if present
        if (request.items && Array.isArray(request.items)) {
          let itemsInfo = "ITEMS LIST\n===========\n\n";
          
          request.items.forEach((item: any, index: number) => {
            itemsInfo += `Item #${index + 1}\n`;
            itemsInfo += `Name: ${item.name || 'N/A'}\n`;
            itemsInfo += `Description: ${item.description || 'N/A'}\n`;
            itemsInfo += `Quantity: ${Number(item.quantity) || 0}\n`;
            itemsInfo += `Estimated Cost: ${(Number(item.estimatedCost) || 0).toFixed(2)}\n\n`;
          });
          
          requestFolder.file('items.txt', itemsInfo);
        }
        
        // Add attachments if requested and available
        if (includeAttachments && request.attachments && request.attachments.length > 0) {
          const attachmentsFolder = requestFolder.folder('attachments');
          if (!attachmentsFolder) {
            console.error(`Failed to create attachments folder for request ${requestId}`);
            continue;
          }
          
          // For now, we'll just add references to the attachments since downloading them 
          // would require additional fetch operations across the network
          const attachmentsList = request.attachments.map((attachment: any) => 
            `${attachment.fileName} (${attachment.fileSize} bytes, ${attachment.fileType})`
          ).join('\n');
          
          attachmentsFolder.file('_attachment_references.txt', 
            `This file contains references to the attachments for request ${requestNumber}.\n\n${attachmentsList}`);
        }
      } catch (requestError) {
        console.error(`Error processing request ${request.id}:`, requestError);
        // Continue with other requests even if one fails
      }
    }
    
    // Generate ZIP file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-requests-export-${timestamp}.zip`;
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Log export for audit purposes
    const referenceId = requests[0]?.id || 0;
    const trackingId = generatePdfTrackingId(referenceId);
    
    try {
      await logPdfAuditEvent(
        referenceId,
        'pdf_downloaded', // Reuse action type for consistency
        {
          trackingId,
          exportType: 'complete_export_zip',
          fileName,
          fileSize: zipBlob.size,
          timestamp: new Date().toISOString(),
          recordCount: requests.length,
          includesAttachments: includeAttachments,
          formatTypes: ['json', 'pdf', 'attachments'],
          type: 'user'
        },
        'user'
      );
    } catch (auditError) {
      console.error('Failed to log ZIP export audit event:', auditError);
    }
    
    // Download the ZIP file
    const downloadResult = await safeDownload(zipBlob, fileName);
    console.log(`ZIP export download result: ${downloadResult ? 'success' : 'failed'}`);
    
    return fileName;
  } catch (error) {
    console.error('Error during bulk ZIP export:', error);
    throw new Error(`Failed to export ZIP: ${error instanceof Error ? error.message : String(error)}`);
  }
}