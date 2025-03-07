import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileDown, FileText, Table, FileSpreadsheet, Package, Calendar, PenTool, Download } from "lucide-react";
import { exportRequestToPDF, exportRequestToExcel, exportRequestToCSV, exportRequestAsZip, exportMultipleRequestsToExcel, exportMultipleRequestsAsZip } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

interface ExportDropdownProps {
  requestIds?: number[];
  singleRequestId?: number;
  request?: any;
  filters?: Record<string, any>;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
  exportType?: "single" | "multiple" | "filtered";
  showLabel?: boolean;
  includeReportTypes?: boolean;
}

export function ExportDropdown({
  requestIds = [],
  singleRequestId,
  request,
  filters = {},
  variant = "default",
  size = "default",
  exportType = "single",
  showLabel = true,
  includeReportTypes = false
}: ExportDropdownProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleExportSingle = async (format: string, type: 'user' | 'approver' | 'admin' = 'user') => {
    if (!request && !singleRequestId) {
      toast({
        title: "No Request Selected",
        description: "Please select a request to export",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(format);
      
      // Fetch the request if we only have the ID
      let requestData = request;
      if (!requestData && singleRequestId) {
        try {
          console.log(`Fetching request data for ID: ${singleRequestId}`);
          const response = await fetch(`/api/requests/${singleRequestId}`);
          if (!response.ok) throw new Error('Failed to fetch request data');
          requestData = await response.json();
          console.log('Retrieved request data:', requestData);
        } catch (error) {
          console.error('Error fetching request data:', error);
          toast({
            title: "Error",
            description: "Failed to fetch request data for export",
            variant: "destructive"
          });
          setIsLoading(null);
          return;
        }
      }

      // Early validation to prevent null/undefined requestData
      if (!requestData || typeof requestData !== 'object') {
        throw new Error('Invalid request data for export');
      }

      // For direct API formats like CSV and Excel, use the API endpoint
      if (format === 'csv' || format === 'excel') {
        try {
          // Call the server-side export endpoint with proper ID parameter
          const requestId = requestData?.id || singleRequestId;
          if (!requestId) {
            throw new Error('Missing request ID for export');
          }
          
          console.log(`Using direct API export for ${format} with request ID: ${requestId}`);
          const endpoint = `/api/requests/export?format=${format === 'excel' ? 'xlsx' : 'csv'}&id=${requestId}`;
          
          // Open the endpoint in a new window/tab for download
          const win = window.open(endpoint, '_blank');
          
          // If popup blocked, use alternative download method
          if (!win || win.closed || typeof win.closed === 'undefined') {
            console.log('Popup blocked, using fetch for download');
            const response = await fetch(endpoint);
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API error: ${errorText || response.statusText}`);
            }
            
            // Get the blob data for the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Create an anchor element and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `request_${requestId}.${format === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
          
          toast({
            title: "Export Successful",
            description: `Successfully exported request to ${format.toUpperCase()}`
          });
          return;
        } catch (apiError) {
          console.error(`API export error for ${format}:`, apiError);
          
          // Fall back to client-side generation for API errors
          console.log('Falling back to client-side export generation');
        }
      }

      // Client-side generation as fallback or for PDF/ZIP
      console.log(`Using client-side export for ${format}`);
      let fileName = '';
      switch (format) {
        case 'pdf':
          fileName = await exportRequestToPDF(requestData, type);
          break;
        case 'excel':
          fileName = await exportRequestToExcel(requestData, true);
          break;
        case 'csv':
          fileName = await exportRequestToCSV(requestData, 'all');
          break;
        case 'zip':
          fileName = await exportRequestAsZip(requestData, true, type);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      toast({
        title: "Export Successful",
        description: `Successfully exported ${fileName}`
      });
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleExportMultiple = async (format: string, type: 'user' | 'approver' | 'admin' = 'user') => {
    if (requestIds.length === 0 && exportType === 'multiple') {
      toast({
        title: "No Requests Selected",
        description: "Please select at least one request to export",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(format);
      
      // Direct API export approach for CSV and Excel
      if (format === 'csv' || format === 'excel') {
        try {
          // Build proper query parameters
          const queryParams: Record<string, string> = {};
          
          // Format determines the file type
          queryParams.format = format === 'excel' ? 'xlsx' : 'csv';
          
          // Add IDs or filters based on export type
          if (exportType === 'multiple' && requestIds.length > 0) {
            // Convert array of IDs to string
            queryParams.ids = requestIds.join(',');
          } else if (exportType === 'filtered') {
            // Add all filters as query parameters
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                  queryParams[key] = value.join(',');
                } else {
                  queryParams[key] = String(value);
                }
              }
            });
          }
          
          // Create URL with proper query parameters
          const endpoint = `/api/requests/export/bulk?${new URLSearchParams(queryParams).toString()}`;
          console.log('Direct API export endpoint:', endpoint);
          
          // Option 1: Open in new window (works in most browsers)
          const win = window.open(endpoint, '_blank');
          
          // Option 2: If popup blocked, use a fetch-based approach
          if (!win || win.closed || typeof win.closed === 'undefined') {
            console.log('Popup blocked, using fetch for bulk download');
            
            const response = await fetch(endpoint);
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API error: ${errorText || response.statusText}`);
            }
            
            // Get blob data for file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Create and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `requests_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
          
          toast({
            title: "Export Initiated",
            description: `Your ${format.toUpperCase()} export has started. Check your downloads folder.`
          });
          
          setIsLoading(null);
          return;
        } catch (directApiError) {
          console.error(`Direct API export error for ${format}:`, directApiError);
          // Continue to client-side fallback export below
        }
      }
      
      // Client-side export fallback or for formats that need client processing (ZIP)
      console.log('Using client-side bulk export for format:', format);
      
      // For filtered export, we need to pass the filters
      const endpoint = exportType === 'filtered' 
        ? `/api/requests/export/bulk?${new URLSearchParams(Object.entries(filters).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null) {
              if (Array.isArray(value)) {
                acc[key] = value.join(',');
              } else {
                acc[key] = String(value);
              }
            }
            return acc;
          }, {} as Record<string, string>)).toString()}`
        : `/api/requests/export/bulk?ids=${requestIds.join(',')}`;
      
      console.log('Fetching requests from endpoint:', endpoint);
      
      // Fetch data for multiple requests
      let requests = [];
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch requests data: ${errorText}`);
        }
        const responseData = await response.json();
        console.log('Received data from server:', responseData);
        
        // Handle different response formats - some endpoints return {data: [...]} structure
        requests = Array.isArray(responseData) ? responseData : 
                  (responseData.data && Array.isArray(responseData.data)) ? responseData.data : [];
                  
        console.log('Processing requests for export:', requests.length, 'items');
      } catch (error) {
        console.error('Error fetching requests data:', error);
        toast({
          title: "Export Error",
          description: error instanceof Error ? error.message : "Failed to fetch requests data for export",
          variant: "destructive"
        });
        setIsLoading(null);
        return;
      }

      if (requests.length === 0) {
        toast({
          title: "No Data",
          description: "No requests found with the current filters"
        });
        setIsLoading(null);
        return;
      }

      let fileName = '';
      switch (format) {
        case 'excel':
          fileName = await exportMultipleRequestsToExcel(requests);
          break;
        case 'zip':
          fileName = await exportMultipleRequestsAsZip(requests, type);
          break;
        default:
          throw new Error(`Unsupported bulk format: ${format}`);
      }

      toast({
        title: "Export Successful",
        description: `Successfully exported ${requests.length} requests to ${fileName}`
      });
    } catch (error) {
      console.error(`Error exporting multiple to ${format}:`, error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export requests",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
    }
  };

  // Determine the export handler based on export type
  const handleExport = (format: string, type: 'user' | 'approver' | 'admin' = 'user') => {
    if (exportType === 'single') {
      handleExportSingle(format, type);
    } else {
      handleExportMultiple(format, type);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant}
          size={size}
          className="gap-2"
          disabled={!!isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <FileDown className="h-4 w-4 animate-pulse" />
              Exporting...
            </span>
          ) : (
            <>
              <Download className="h-4 w-4" />
              {showLabel && "Export"}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Unified document export options for all types */}
        <DropdownMenuItem onClick={() => handleExport('pdf', 'user')}>
          <FileText className="h-4 w-4 mr-2" />
          <span>PDF Document</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          <span>Excel Spreadsheet</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <Table className="h-4 w-4 mr-2" />
          <span>CSV File</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Comprehensive archive for all export types */}
        <DropdownMenuItem onClick={() => handleExport('zip', 'user')}>
          <Package className="h-4 w-4 mr-2" />
          <span>Complete Archive (ZIP)</span>
        </DropdownMenuItem>

        {includeReportTypes && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Advanced Options</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExport('pdf', 'admin')}>
              <PenTool className="h-4 w-4 mr-2" />
                  <span>Admin ZIP Archive</span>
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}