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
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import { 
  logPdfAuditEvent,
  generatePdfTrackingId  
} from '@/lib/pdfAuditUtils';

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
  
  // PDF export implementation
  const handlePdfExport = async (): Promise<string> => {
    console.log('Creating PDF export...');
    
    // Create PDF document
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
      doc.autoTable({
        head: tableHead,
        body: tableBody,
        startY: tableY + 5,
        margin: { left: 14 },
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] }
      });
    }
    
    // Create filename and blob
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.pdf`;
    const blob = doc.output('blob');
    
    // Download the file
    await downloadFile(blob, fileName);
    
    return fileName;
  };
  
  // ZIP export implementation
  const handleZipExport = async (): Promise<string> => {
    console.log('Creating ZIP export...');
    
    // Create ZIP instance
    const zip = new JSZip();
    
    // Add JSON data
    const requestJson = JSON.stringify(request, null, 2);
    zip.file(`request-${request.id}-data.json`, requestJson);
    
    // Add plain text summary
    const summary = `
Purchase Request Summary
=======================
Request ID: ${request.id}
Request Number: ${request.requestNumber || 'N/A'}
Title: ${request.title || 'N/A'}
Status: ${request.status || 'N/A'}
Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}
Requester: ${request.requester?.username || 'N/A'}
Department: ${request.requester?.department || 'N/A'}
Items Count: ${request.items?.length || 0}
    `;
    zip.file(`request-${request.id}-summary.txt`, summary);
    
    // Add items info if present
    if (request.items && request.items.length > 0) {
      let itemsInfo = "ITEMS LIST\n===========\n\n";
      
      request.items.forEach((item: any, index: number) => {
        itemsInfo += `Item #${index + 1}\n`;
        itemsInfo += `Name: ${item.name || 'N/A'}\n`;
        itemsInfo += `Description: ${item.description || 'N/A'}\n`;
        itemsInfo += `Quantity: ${Number(item.quantity) || 0}\n`;
        itemsInfo += `Estimated Cost: ${(Number(item.estimatedCost) || 0).toFixed(2)}\n\n`;
      });
      
      zip.file(`request-${request.id}-items.txt`, itemsInfo);
    }
    
    // Generate file
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
    const fileName = `purchase-request-${request.id}-${timestamp}.zip`;
    const content = await zip.generateAsync({ type: 'blob' });
    
    // Download the file
    await downloadFile(content, fileName);
    
    return fileName;
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