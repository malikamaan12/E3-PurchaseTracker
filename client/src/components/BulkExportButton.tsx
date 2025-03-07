import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, FileArchive, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportMultipleRequestsToExcel, exportMultipleRequestsToCSV, exportMultipleRequestsAsZip } from '@/lib/exportUtils';

interface BulkExportButtonProps {
  requests: any[];
  onExportComplete?: (fileName: string) => void;
  onExportError?: (error: Error) => void;
}

export function BulkExportButton({ 
  requests,
  onExportComplete,
  onExportError
}: BulkExportButtonProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    if (!requests.length) {
      return;
    }

    setIsLoading(format);
    try {
      console.log(`Starting export for ${requests.length} requests with format: ${format}`);
      let fileName = '';

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

      console.log(`Export completed: ${fileName}`);
      onExportComplete?.(fileName);
    } catch (error) {
      console.error('Error exporting data:', error);
      if (error instanceof Error) {
        onExportError?.(error);
      } else {
        onExportError?.(new Error('Unknown export error occurred'));
      }
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          disabled={isLoading !== null || !requests.length} 
          onClick={() => handleExport('excel')}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Excel Spreadsheet</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          disabled={isLoading !== null || !requests.length} 
          onClick={() => handleExport('csv')}
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>CSV File</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          disabled={isLoading !== null || !requests.length} 
          onClick={() => handleExport('zip')}
        >
          <FileArchive className="mr-2 h-4 w-4" />
          <span>ZIP Archive (All Formats)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}