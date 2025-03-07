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
      onExportError?.(new Error('No requests available for export'));
      return;
    }

    setIsLoading(format);
    try {
      // Prepare requests count message for logs
      const requestsCount = requests?.length || 0;
      const formatLabel = format === 'excel' ? 'Excel Spreadsheet' : 
                         format === 'csv' ? 'CSV File' : 
                         format === 'zip' ? 'ZIP Archive' : format;
      
      console.log(`Starting export of ${requestsCount} requests in ${formatLabel} format`);
      
      let fileName = '';

      if (requests?.length) {
        // Validate requests to ensure we have all required data
        const validRequests = requests.filter(req => req && req.id);
        
        if (validRequests.length === 0) {
          throw new Error('No valid requests to export');
        }
        
        if (validRequests.length !== requests.length) {
          console.warn(`Some requests (${requests.length - validRequests.length}) were filtered out due to missing data`);
        }
        
        // Export directly from provided requests
        switch (format) {
          case 'excel':
            fileName = await exportMultipleRequestsToExcel(validRequests);
            break;
          case 'csv':
            fileName = await exportMultipleRequestsToCSV(validRequests);
            break;
          case 'zip':
            // Zip export can be large, so let's add a confirmation if many requests
            if (validRequests.length > 20) {
              const totalAttachments = validRequests.reduce((count, req) => 
                count + (req.attachments?.length || 0), 0);
              
              if (totalAttachments > 50 && !window.confirm(
                `You are about to export ${validRequests.length} requests with approximately ${totalAttachments} attachments. ` +
                `This may take some time and create a large file. Continue?`
              )) {
                setIsLoading(null);
                return;
              }
            }
            
            fileName = await exportMultipleRequestsAsZip(validRequests);
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
        
        try {
          console.log(`Fetching data with filters: ${queryParams.toString()}`);
          const response = await fetch(`/api/requests/export/bulk?${queryParams.toString()}`, {
            credentials: "include",
            headers: {
              'Accept': format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                        format === 'csv' ? 'text/csv' : 
                        format === 'zip' ? 'application/zip' : '*/*'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            try {
              // Try to parse as JSON error
              const errorJson = JSON.parse(errorText);
              throw new Error(errorJson.message || errorJson.error || 'Export failed');
            } catch (parseError) {
              // If not JSON, use text
              throw new Error(errorText || `Export failed with status ${response.status}`);
            }
          }
          
          // Get filename from Content-Disposition header or generate one
          let suggestedName;
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
              suggestedName = filenameMatch[1];
            }
          }
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          const date = new Date().toISOString().split('T')[0];
          fileName = suggestedName || `procurement_export_${date}.${
            format === 'excel' ? 'xlsx' : 
            format === 'csv' ? 'csv' : 
            format === 'zip' ? 'zip' : 'file'
          }`;
          
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (apiError) {
          console.error('API export error:', apiError);
          throw apiError;
        }
      }

      console.log(`Export completed: ${fileName}`);
      onExportComplete?.(fileName);
    } catch (error) {
      console.error('Error exporting data:', error);
      
      // Enhanced error handling with better user feedback
      if (error instanceof Error) {
        // Provide more helpful messages for common errors
        if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          onExportError?.(new Error('Network error - please check your connection and try again'));
        } else if (error.message.includes('CORS') || error.message.includes('Not allowed')) {
          onExportError?.(new Error('Security restriction prevented the export - try refreshing the page'));
        } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
          onExportError?.(new Error('Export data is too large - try exporting fewer requests or a different format'));
        } else {
          onExportError?.(error);
        }
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