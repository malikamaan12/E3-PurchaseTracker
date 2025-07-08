import { useState } from 'react';
import { FileText, FileArchive, Database, Table2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Parser } from '@json2csv/plainjs';
import JSZip from 'jszip';
import { 
  logPdfAuditEvent,
  generatePdfTrackingId  
} from '@/lib/pdfAuditUtils';
import { exportRequestToPDF } from '@/lib/exportUtils';

interface ExportTabsProps {
  request: any;
  compact?: boolean;
}

export function ExportTabs({ request, compact = false }: ExportTabsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useUser();

  // Track export in audit log
  const trackExport = async (format: string, fileName: string, success: boolean) => {
    try {
      if (!request || !request.id) return;
      
      const requestId = typeof request.id === 'string' ? parseInt(request.id) : request.id;
      if (isNaN(requestId)) return;
      
      const userRole = user?.role || 'user';
      
      // Map format to action for the audit log
      let action: string;
      switch (format) {
        case 'excel':
          action = 'excel_downloaded';
          break;
        case 'csv':
          action = 'csv_downloaded';
          break;
        case 'pdf':
          action = 'pdf_downloaded';
          break;
        case 'zip':
          action = 'zip_downloaded';
          break;
        default:
          action = 'pdf_downloaded'; // Default fallback
      }
      
      // Create tracking ID for audit purposes
      const trackingId = generatePdfTrackingId(requestId);
      
      // Log the export event
      await logPdfAuditEvent(requestId, action as any, {
        fileName,
        success,
        userRole,
        trackingId,
        timestamp: new Date().toISOString(),
        fileSize: 0, // Would need actual file size in a production environment
      }, userRole as any);
      
      console.log(`Tracked ${format} export: ${success ? 'success' : 'failure'}`);
    } catch (error) {
      console.error('Failed to log export event:', error);
      // Non-critical - don't block the UI for audit failure
    }
  };

  // Direct file download function with improved reliability
  const downloadFile = async (data: Blob, fileName: string): Promise<boolean> => {
    try {
      console.log(`Initiating download for ${fileName} (${data.size} bytes)`);
      
      // Try FileSaver.js first as it's more reliable across browsers
      try {
        console.log('Using FileSaver for download...');
        saveAs(data, fileName);
        console.log('FileSaver download initiated');
        return true;
      } catch (fileSaverError) {
        console.error('FileSaver error, falling back to manual method:', fileSaverError);
      }
      
      // Fallback to manual download
      console.log('Using manual download method as fallback');
      
      // Create object URL for the blob
      const url = URL.createObjectURL(data);
      
      // Create a download link
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // Add to document
      document.body.appendChild(link);
      
      // Trigger download with a slight delay to ensure browser processes it
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Clicking download link...');
      link.click();
      
      // Clean up
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('Download link cleanup completed');
        } catch (cleanupError) {
          console.error('Cleanup error (non-critical):', cleanupError);
        }
      }, 300);
      
      return true;
    } catch (error) {
      console.error('All download methods failed:', error);
      return false;
    }
  };
  
  // Excel export implementation
  const handleExcelExport = async (): Promise<string> => {
    console.log('Creating Excel export...');
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Format request data for main sheet
    const mainData = [{
      'Request ID': request.id || '',
      'Request Number': request.requestNumber || `PR-${request.id || ''}`,
      'Title': request.title || '',
      'Description': request.description || '',
      'Status': request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : '',
      'Requester': request.requester?.username || '',
      'Department': request.requester?.department || '',
      'Vendor': request.vendor?.companyName || request.vendor?.name || '',
      'Created Date': request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '',
      'Updated Date': request.updatedAt ? new Date(request.updatedAt).toLocaleDateString() : ''
    }];
    
    // Create main sheet
    const mainSheet = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, mainSheet, 'Request Details');
    
    // Add items sheet if present
    if (request.items && request.items.length > 0) {
      const itemData = request.items.map((item: any, index: number) => ({
        'Item #': index + 1,
        'Name': item.name || '',
        'Description': item.description || '',
        'Quantity': Number(item.quantity) || 0,
        'Unit Cost': (Number(item.estimatedCost) || 0).toFixed(2),
        'Total Cost': ((Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0)).toFixed(2)
      }));
      
      const itemSheet = XLSX.utils.json_to_sheet(itemData);
      XLSX.utils.book_append_sheet(wb, itemSheet, 'Items');
    }
    
    // Generate file data
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Download the file
    await downloadFile(blob, fileName);
    
    return fileName;
  };
  
  // CSV export implementation
  const handleCsvExport = async (): Promise<string> => {
    console.log('Creating CSV export...');
    
    // Format request data
    const requestData = {
      'Request ID': request.id || '',
      'Request Number': request.requestNumber || `PR-${request.id || ''}`,
      'Title': request.title || '',
      'Description': request.description || '',
      'Status': request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : '',
      'Priority': request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : '',
      'Created Date': request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '',
      'Requester': request.requester?.username || '',
      'Department': request.requester?.department || '',
      'Items Count': request.items?.length || 0
    };
    
    // Create CSV content
    const parser = new Parser({ delimiter: ',', header: true });
    const csv = parser.parse([requestData]);
    
    // Add BOM for Excel compatibility
    const bomPrefix = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvContent = new Uint8Array(csv.length);
    for (let i = 0; i < csv.length; i++) {
      csvContent[i] = csv.charCodeAt(i);
    }
    
    // Combine BOM and CSV
    const finalContent = new Uint8Array(bomPrefix.length + csvContent.length);
    finalContent.set(bomPrefix);
    finalContent.set(csvContent, bomPrefix.length);
    
    // Generate file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.csv`;
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8' });
    
    // Download the file
    await downloadFile(blob, fileName);
    
    return fileName;
  };
  
  // PDF export implementation using the working approach
  const handlePdfExport = async (): Promise<string> => {
    console.log('Creating PDF export using working approach...');
    
    try {
      // Get the request ID from the current request
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Validate the request ID is a valid number
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Fetch request data with full details for PDF generation
      console.log(`Fetching PDF data for request ${requestId}`);
      const response = await fetch(`/api/requests/${requestId}/pdf`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch PDF data');
      }
      
      const jsonData = await response.json();
      console.log('PDF API response structure:', Object.keys(jsonData));
      
      if (!jsonData || !jsonData.data) {
        throw new Error('Invalid response format from PDF API');
      }
      
      const { data, pdfSettings } = jsonData;
      
      // Use the working PDF generation approach
      console.log('Generating PDF using working approach...');
      const userRoleForAudit = user?.role === 'admin' ? 'admin' : 
                      (user?.role === 'approver' ? 'approver' : 'user');
      
      // Call the working PDF export function
      const fileName = await exportRequestToPDF(data, userRoleForAudit, pdfSettings);
      
      console.log('PDF generated successfully:', fileName);
      return fileName;
      
    } catch (error) {
      console.error('PDF export error:', error);
      throw error;
    }
  };
  
  // ZIP export implementation - unified with DownloadOptions
  const handleZipExport = async (): Promise<string> => {
    console.log('Creating ZIP export...');
    
    // Get the request ID from the current request
    const requestId = request?.id ? parseInt(String(request.id)) : null;
    
    // Validate the request ID is a valid number
    if (!requestId || isNaN(requestId)) {
      throw new Error('Invalid request ID');
    }
    
    // Try to fetch ZIP file directly from server first
    console.log(`Fetching ZIP package for request ${requestId}`);
    const zipUrl = `/api/requests/${requestId}/zip`;
    const response = await fetch(zipUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/zip, application/octet-stream'
      }
    });
    
    if (response.ok) {
      // Server returned a ZIP file
      const blob = await response.blob();
      
      // Create filename for the zip file
      const fileName = `Purchase_Request_${request?.requestNumber || request?.id}_with_attachments.zip`;
      
      // Download the file
      await downloadFile(blob, fileName);
      return fileName;
    } else {
      // Server didn't return a ZIP file, fall back to client-side generation
      console.log("Server ZIP generation failed, falling back to client-side generation");
      
      // Get request data for client-side ZIP generation
      const dataResponse = await fetch(`/api/requests/${requestId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!dataResponse.ok) {
        throw new Error('Failed to fetch request data');
      }
      
      const requestData = await dataResponse.json();
      
      // Create ZIP file client-side
      const zip = new JSZip();
      
      const requestNumber = requestData.requestNumber || `PR-${requestId}`;
      const requestFolder = zip.folder(requestNumber);
      
      if (!requestFolder) {
        throw new Error('Failed to create ZIP folder');
      }
      
      // Add request details as JSON
      requestFolder.file('request-data.json', JSON.stringify(requestData, null, 2));
      
      // Add summary text file
      const summary = `
Purchase Request Summary
=======================
Request ID: ${requestId}
Request Number: ${requestNumber}
Title: ${requestData.title || 'N/A'}
Status: ${requestData.status || 'N/A'}
Created: ${requestData.createdAt ? new Date(requestData.createdAt).toLocaleDateString() : 'N/A'}
Requester: ${requestData.requester?.username || 'N/A'}
Department: ${requestData.requester?.department || 'N/A'}
Items Count: ${requestData.items?.length || 0}
Total Cost: ${requestData.totalEstimatedCost || 0} ${requestData.currency || 'QAR'}
      `;
      requestFolder.file('summary.txt', summary);
      
      // Generate and add PDF
      try {
        const pdfResponse = await fetch(`/api/requests/${requestId}/pdf`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/pdf'
          }
        });
        
        if (pdfResponse.ok) {
          const pdfBlob = await pdfResponse.blob();
          requestFolder.file(`${requestNumber}.pdf`, pdfBlob);
        }
      } catch (pdfError) {
        console.error('Error fetching PDF:', pdfError);
      }
      
      // Add attachments
      if (requestData.attachments && requestData.attachments.length > 0) {
        const attachmentsFolder = requestFolder.folder('attachments');
        
        if (attachmentsFolder) {
          for (const attachment of requestData.attachments) {
            try {
              const attachmentResponse = await fetch(`/api/attachments/${attachment.id}`, {
                credentials: 'include'
              });
              
              if (attachmentResponse.ok) {
                const attachmentBlob = await attachmentResponse.blob();
                attachmentsFolder.file(attachment.fileName, attachmentBlob);
              }
            } catch (attachmentError) {
              console.error(`Error fetching attachment ${attachment.fileName}:`, attachmentError);
              // Add a note about missing file
              attachmentsFolder.file(`${attachment.fileName}.missing.txt`, 
                `This attachment file (${attachment.fileName}) could not be downloaded.`);
            }
          }
        }
      }
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Create filename for the zip file
      const fileName = `Purchase_Request_${request?.requestNumber || request?.id}_with_attachments.zip`;
      
      // Download the file
      await downloadFile(zipBlob, fileName);
      
      return fileName;
    }
  };

  const handleExport = async (format: string) => {
    if (isLoading) return;
    
    console.log(`Starting ${format} export for request:`, request);
    setIsLoading(true);
    setExportType(format);
    
    try {
      let fileName = '';
      
      // Use direct export implementations
      switch(format) {
        case 'excel':
          fileName = await handleExcelExport();
          break;
        case 'csv':
          fileName = await handleCsvExport();
          break;
        case 'pdf':
          fileName = await handlePdfExport();
          break;
        case 'zip':
          fileName = await handleZipExport();
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      console.log(`${format} export completed successfully`);
      
      // Track successful export in audit log
      await trackExport(format, fileName, true);
      
      toast({
        title: "Export Successful",
        description: `Request exported as ${fileName}`
      });
    } catch (error) {
      console.error(`Error during ${format} export:`, error);
      
      // Track failed export in audit log
      await trackExport(format, `failed-${format}-export.${format}`, false);
      
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setExportType(null);
    }
  };
  
  if (compact) {
    return (
      <div className="flex space-x-2">
        <button
          onClick={() => handleExport('excel')}
          disabled={isLoading}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:text-white dark:hover:text-white dark:hover:bg-accent"
        >
          {isLoading && exportType === 'excel' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Database className="h-4 w-4 mr-2" />
          )}
          Excel
        </button>
        
        <button
          onClick={() => handleExport('csv')}
          disabled={isLoading}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:text-white dark:hover:text-white dark:hover:bg-accent"
        >
          {isLoading && exportType === 'csv' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Table2 className="h-4 w-4 mr-2" />
          )}
          CSV
        </button>
        
        <button
          onClick={() => handleExport('pdf')}
          disabled={isLoading}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:text-white dark:hover:text-white dark:hover:bg-accent"
        >
          {isLoading && exportType === 'pdf' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          PDF
        </button>
        
        <button
          onClick={() => handleExport('zip')}
          disabled={isLoading}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:text-white dark:hover:text-white dark:hover:bg-accent"
        >
          {isLoading && exportType === 'zip' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileArchive className="h-4 w-4 mr-2" />
          )}
          ZIP
        </button>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div 
          className="flex flex-col items-center p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors bg-background dark:bg-gray-900"
          onClick={() => !isLoading && handleExport('excel')}
        >
          <div className="h-12 w-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            {isLoading && exportType === 'excel' ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Database className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-medium text-foreground dark:text-white">Excel (.xlsx)</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">Comprehensive with multiple sheets</p>
        </div>
        
        <div 
          className="flex flex-col items-center p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors bg-background dark:bg-gray-900"
          onClick={() => !isLoading && handleExport('csv')}
        >
          <div className="h-12 w-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            {isLoading && exportType === 'csv' ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Table2 className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-medium text-foreground dark:text-white">CSV</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">Simple tabular format</p>
        </div>
        
        <div 
          className="flex flex-col items-center p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors bg-background dark:bg-gray-900"
          onClick={() => !isLoading && handleExport('pdf')}
        >
          <div className="h-12 w-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            {isLoading && exportType === 'pdf' ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-medium text-foreground dark:text-white">PDF</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">Professional document format</p>
        </div>
        
        <div 
          className="flex flex-col items-center p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors bg-background dark:bg-gray-900"
          onClick={() => !isLoading && handleExport('zip')}
        >
          <div className="h-12 w-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            {isLoading && exportType === 'zip' ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <FileArchive className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-medium text-foreground dark:text-white">ZIP</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">With attachments and files</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary" />
          <p className="text-sm text-foreground dark:text-white">Generating {exportType} export...</p>
        </div>
      )}
    </div>
  );
}