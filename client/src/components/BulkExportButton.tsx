import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Download, FileSpreadsheet, FileText, Archive } from "lucide-react";
import { exportMultipleRequestsToExcel, exportMultipleRequestsToCSV, exportMultipleRequestsAsZip, logExport } from '@/lib/exportUtils';

interface BulkExportButtonProps {
  requests: any[];
  isLoading?: boolean;
  disabled?: boolean;
  onSuccess?: (fileName: string) => void;
  onError?: (error: Error) => void;
}

export function BulkExportButton({
  requests = [], 
  isLoading = false,
  disabled = false,
  onSuccess,
  onError
}: BulkExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<null | 'excel' | 'csv' | 'zip'>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExport = async (format: 'excel' | 'csv' | 'zip') => {
    if (exporting || requests.length === 0) return;
    
    setExporting(true);
    setExportFormat(format);
    setErrorMessage(null);
    
    try {
      let fileName: string;
      
      // Log the requests we're exporting (count only for debugging)
      logExport('bulkExport', `Starting bulk export of ${requests.length} requests in ${format} format`);
      
      switch (format) {
        case 'excel':
          fileName = await exportMultipleRequestsToExcel(requests);
          break;
        case 'csv':
          fileName = await exportMultipleRequestsToCSV(requests);
          break;
        case 'zip':
          fileName = await exportMultipleRequestsAsZip(requests);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      if (onSuccess) {
        onSuccess(fileName);
      }
    } catch (error) {
      console.error('Export error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown export error');
      
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      setExporting(false);
    }
  };

  const buttonDisabled = disabled || isLoading || exporting || requests.length === 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            disabled={buttonDisabled}
            className="flex items-center gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export {requests.length > 0 ? `(${requests.length})` : ''}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => handleExport('excel')}
            disabled={buttonDisabled}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export to Excel</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleExport('csv')}
            disabled={buttonDisabled}
            className="flex items-center gap-2"
          >
            <FileCopy className="h-4 w-4" />
            <span>Export to CSV</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleExport('zip')}
            disabled={buttonDisabled}
            className="flex items-center gap-2"
          >
            <FileArchive className="h-4 w-4" />
            <span>Export as ZIP (all formats)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Error Dialog */}
      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Error</AlertDialogTitle>
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExport(exportFormat!)}>
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}