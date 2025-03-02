import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileArchive, FileDown, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { exportMultipleRequestsAsZip } from "@/lib/exportUtils";
import { analyzeBulkExportIssue } from "@/services/export-analyzer";

interface BulkExportButtonProps {
  selectedRequestIds?: number[];
  filters?: Record<string, any>;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
}

export function BulkExportButton({
  selectedRequestIds = [],
  filters = {},
  variant = "outline",
  size = "sm" 
}: BulkExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  // Only admin users can use this functionality
  if (user?.role !== 'admin') {
    return null;
  }

  const handleExportRequests = async () => {
    try {
      setIsLoading(true);
      
      // Prepare the query parameters based on selected IDs or filters
      let queryParams = [];
      
      if (selectedRequestIds.length > 0) {
        // Format the IDs as a comma-separated list
        queryParams.push(`ids=${selectedRequestIds.join(',')}`);
      } else if (Object.keys(filters).length > 0) {
        // Process each filter key with proper validation
        for (const [key, value] of Object.entries(filters)) {
          // Skip empty values
          if (value === undefined || value === null || value === '' || 
              (Array.isArray(value) && value.length === 0)) {
            continue;
          }
          
          // Handle different value types
          if (Array.isArray(value)) {
            // Convert array to comma-separated string
            const stringValue = value.filter(v => v !== null && v !== undefined && v !== '')
                                     .join(',');
            if (stringValue) {
              queryParams.push(`${key}=${encodeURIComponent(stringValue)}`);
            }
          } else if (value instanceof Date) {
            // Format dates properly
            queryParams.push(`${key}=${encodeURIComponent(value.toISOString())}`);
          } else if (typeof value === 'object' && value !== null) {
            // Handle nested objects (like dateRange or costRange)
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
                if (nestedValue instanceof Date) {
                  queryParams.push(`${key}.${nestedKey}=${encodeURIComponent(nestedValue.toISOString())}`);
                } else {
                  queryParams.push(`${key}.${nestedKey}=${encodeURIComponent(String(nestedValue))}`);
                }
              }
            }
          } else {
            // Simple string/number values
            queryParams.push(`${key}=${encodeURIComponent(String(value))}`);
          }
        }
      }
      
      // Handle date range specially
      if (filters.dateRange?.from) {
        queryParams.push(`startDate=${encodeURIComponent(filters.dateRange.from.toISOString())}`);
      }
      
      if (filters.dateRange?.to) {
        queryParams.push(`endDate=${encodeURIComponent(filters.dateRange.to.toISOString())}`);
      }
      
      // Construct the final URL
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const endpoint = `/api/requests/export/bulk${queryString}`;
      
      console.log('Bulk export endpoint:', endpoint);
      console.log('Filters being used:', filters);

      // Fetch data from the API
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      // Handle HTTP errors
      if (!response.ok) {
        let errorMessage = 'Failed to export requests';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If can't parse JSON, use status text
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Parse response
      let jsonData;
      try {
        jsonData = await response.json();
        console.log('Export API response:', jsonData);
      } catch (e) {
        console.error('Error parsing JSON response:', e);
        throw new Error('Invalid response format from server');
      }
      
      // Validate response structure
      if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('Invalid response format from export API');
      }
      
      // Handle empty data case
      const { data = [] } = jsonData;
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format - expected array of requests');
      }
      
      if (data.length === 0) {
        toast({
          title: "No Data Found",
          description: "No requests match the selected criteria."
        });
        return;
      }
      
      // Generate and download the ZIP file with all requests
      await exportMultipleRequestsAsZip(data, 'admin');
      
      toast({
        title: "Bulk Export Complete",
        description: `Successfully exported ${data.length} purchase requests.`,
      });
    } catch (error) {
      console.error('Error exporting requests:', error);
      
      // Use AI analysis for more helpful error feedback
      try {
        const analysis = await analyzeBulkExportIssue(filters, error);
        console.log('Export error analysis:', analysis);
        
        toast({
          title: "Export Failed",
          description: analysis.issue.description || 
            (error instanceof Error ? error.message : "Failed to export requests"),
          variant: "destructive",
        });
        
        // Log immediate fix suggestions to console for developers
        if (analysis.fixes.immediate.length > 0) {
          console.info('Suggested fixes:', analysis.fixes.immediate);
        }
      } catch (analysisError) {
        // Fallback to simple error message if AI analysis fails
        toast({
          title: "Export Failed",
          description: error instanceof Error ? error.message : "Failed to export requests",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExportRequests}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <FileArchive className="mr-2 h-4 w-4" />
          Export Requests
        </>
      )}
    </Button>
  );
}