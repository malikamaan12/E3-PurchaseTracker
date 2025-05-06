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
import { 
  exportRequestToPDF, 
  exportRequestToExcel,
  exportRequestToCSV,
  exportMultipleRequestsAsZip
} from '@/lib/exportUtils';
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

  const handleExport = async (format: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setExportType(format);
    
    try {
      let fileName = '';
      
      switch(format) {
        case 'excel':
          fileName = await exportRequestToExcel(request);
          break;
        case 'csv':
          fileName = await exportRequestToCSV(request);
          break;
        case 'pdf':
          fileName = await exportRequestToPDF(request);
          break;
        case 'zip':
          fileName = await exportMultipleRequestsAsZip([request]);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
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
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
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
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
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
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
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
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
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
    <Tabs defaultValue="excel" className="w-full">
      <TabsList className="grid grid-cols-4 mb-4">
        <TabsTrigger 
          value="excel" 
          className="flex items-center gap-2"
          onClick={() => handleExport('excel')}
          disabled={isLoading}
        >
          {isLoading && exportType === 'excel' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          <span>Excel (.xlsx)</span>
        </TabsTrigger>
        
        <TabsTrigger 
          value="csv" 
          className="flex items-center gap-2"
          onClick={() => handleExport('csv')}
          disabled={isLoading}
        >
          {isLoading && exportType === 'csv' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Table2 className="h-4 w-4" />
          )}
          <span>CSV</span>
        </TabsTrigger>
        
        <TabsTrigger 
          value="pdf" 
          className="flex items-center gap-2"
          onClick={() => handleExport('pdf')}
          disabled={isLoading}
        >
          {isLoading && exportType === 'pdf' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          <span>PDF</span>
        </TabsTrigger>
        
        <TabsTrigger 
          value="zip" 
          className="flex items-center gap-2"
          onClick={() => handleExport('zip')}
          disabled={isLoading}
        >
          {isLoading && exportType === 'zip' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileArchive className="h-4 w-4" />
          )}
          <span>ZIP</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="excel" className="text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">Comprehensive with multiple sheets</p>
      </TabsContent>
      
      <TabsContent value="csv" className="text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">Simple tabular format</p>
      </TabsContent>
      
      <TabsContent value="pdf" className="text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">Professional document format</p>
      </TabsContent>
      
      <TabsContent value="zip" className="text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">With attachments and files</p>
      </TabsContent>
    </Tabs>
  );
}