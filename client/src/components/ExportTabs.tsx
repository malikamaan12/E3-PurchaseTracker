import { useState } from 'react';
import { FileText, FileArchive, Database, Table2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

interface ExportTabsProps {
  request: any;
  compact?: boolean;
}

export function ExportTabs({ request, compact = false }: ExportTabsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);
  const { toast } = useToast();

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
      
      toast({
        title: "Export Successful",
        description: `Request exported as ${fileName}`
      });
    } catch (error) {
      console.error(`Error during ${format} export:`, error);
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
  
  return (
    <Tabs defaultValue="excel" className="w-full">
      <TabsList className="grid grid-cols-4 mb-4 bg-black">
        <TabsTrigger 
          value="excel" 
          className="flex items-center gap-2 data-[state=active]:bg-gray-800 text-white"
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
          className="flex items-center gap-2 data-[state=active]:bg-gray-800 text-white"
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
          className="flex items-center gap-2 data-[state=active]:bg-gray-800 text-white"
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
          className="flex items-center gap-2 data-[state=active]:bg-gray-800 text-white"
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