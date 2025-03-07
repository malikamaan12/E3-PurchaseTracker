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
  requests?: any[];
  filters?: any;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  onExportComplete?: (fileName: string) => void;
  onExportError?: (error: Error) => void;
}

export function BulkExportButton({ 
  requests,
  filters,
  variant = "default",
  size = "default",
  onExportComplete,
  onExportError
}: BulkExportButtonProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    // Check if we have either requests or filters
    if (!requests?.length && !filters) {
      return;
    }

    setIsLoading(format);
    try {
      // If we have direct requests, use them. Otherwise use API with filters
      if (requests?.length) {
        console.log(`Starting export for ${requests.length} requests with format: ${format}`);
      } else if (filters) {
        console.log(`Starting export with filters and format: ${format}`);
      }
      
      let fileName = '';

      if (requests?.length) {
        // Export directly from provided requests
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
      } else if (filters) {
        // Call API with filters
        const queryParams = new URLSearchParams();
        queryParams.append('format', format);
        
        // Add filters to query parameters
        if (filters.status?.length) queryParams.append('status', filters.status.join(','));
        if (filters.priority?.length) queryParams.append('priority', filters.priority.join(','));
        if (filters.department?.length) queryParams.append('department', filters.department.join(','));
        if (filters.purposeType?.length) queryParams.append('purposeType', filters.purposeType.join(','));
        if (filters.subPurposeId) queryParams.append('subPurposeId', filters.subPurposeId.toString());
        if (filters.vendorId) queryParams.append('vendorId', filters.vendorId.toString());
        if (filters.dateRange?.from) queryParams.append('startDate', filters.dateRange.from.toISOString());
        if (filters.dateRange?.to) queryParams.append('endDate', filters.dateRange.to.toISOString());
        if (filters.searchQuery) queryParams.append('searchTerm', filters.searchQuery);
        
        const response = await fetch(`/api/requests/export/bulk?${queryParams.toString()}`, {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(await response.text());
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        fileName = `procurement_export_${date}.${format}`;
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
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
        <Button variant={variant} size={size}>
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
          disabled={isLoading !== null || (!requests?.length && !filters)} 
          onClick={() => handleExport('excel')}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Excel Spreadsheet</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          disabled={isLoading !== null || (!requests?.length && !filters)} 
          onClick={() => handleExport('csv')}
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>CSV File</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          disabled={isLoading !== null || (!requests?.length && !filters)} 
          onClick={() => handleExport('zip')}
        >
          <FileArchive className="mr-2 h-4 w-4" />
          <span>ZIP Archive (All Formats)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}