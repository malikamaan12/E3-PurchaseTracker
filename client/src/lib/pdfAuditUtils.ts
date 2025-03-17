/**
 * PDF Audit Utilities
 * 
 * This file provides utilities for logging PDF-related audit events
 * such as generation, viewing, and downloading.
 */

/**
 * Log a PDF generation event to the audit log
 * 
 * @param requestId - The ID of the request being processed
 * @param action - The action being performed ('pdf_generated', 'pdf_downloaded', 'pdf_viewed')
 * @param details - Additional details about the generation
 * @param type - The type of user performing the action
 * @returns Promise resolving to the audit log entry
 */
export async function logPdfAuditEvent(
  requestId: number,
  action: 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed',
  details: Record<string, any> = {},
  type: 'user' | 'approver' | 'admin' = 'user'
): Promise<any> {
  try {
    // Add user type to details
    const auditDetails = {
      ...details,
      type,
      timestamp: new Date().toISOString(),
    };

    // Send the audit log to the server
    const response = await fetch('/api/pdf/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId,
        action,
        details: auditDetails,
      }),
    });

    if (!response.ok) {
      console.error('Failed to log PDF audit event:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error logging PDF audit event:', error);
    return null;
  }
}

/**
 * Generate a unique tracking ID for a PDF
 * This can be used for watermarking or tracking specific PDF instances
 * 
 * @param requestId - The request ID
 * @param userId - Optional user ID
 * @returns A unique tracking ID string
 */
export function generatePdfTrackingId(requestId: number, userId?: number): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const userPart = userId ? `-${userId}` : '';
  
  return `PDF-${requestId}${userPart}-${timestamp}-${randomSuffix}`;
}

/**
 * Apply dynamic watermarking to PDF content
 * Typically called during PDF generation
 * 
 * @param doc - jsPDF document instance
 * @param text - Watermark text
 * @param opacity - Watermark opacity (0-1)
 */
export function applyPdfWatermark(doc: any, text: string, opacity: number = 0.1): void {
  try {
    const pageCount = doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Save current state
      doc.saveGraphicsState();
      
      // Set watermark properties
      doc.setTextColor(0, 0, 0);
      doc.setGState(new doc.GState({ opacity }));
      doc.setFontSize(20);
      doc.setFont('helvetica', 'italic');
      
      // Rotate and position watermark
      doc.translate(pageWidth / 2, pageHeight / 2);
      doc.rotate(-45);
      doc.text(text, 0, 0, { align: 'center' });
      
      // Restore state
      doc.restoreGraphicsState();
    }
  } catch (error) {
    console.error('Error applying PDF watermark:', error);
  }
}