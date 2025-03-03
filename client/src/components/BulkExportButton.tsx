import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileArchive, AlertTriangle, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { exportMultipleRequestsAsZip } from "@/lib/exportUtils";
import { analyzeBulkExportIssue } from "@/services/export-analyzer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { user } = useUser();
  const { toast } = useToast();

  // Only admin users can use this functionality
  if (user?.role !== 'admin') {
    return null;
  }

  const processExportFilters = () => {
    // Prepare the query parameters based on selected IDs or filters
    const queryParams: string[] = [];
    
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
    return `/api/requests/export/bulk${queryString}`;
  };

  const checkExportCount = async () => {
    try {
      setIsLoading(true);
      setExportError(null);
      
      const endpoint = processExportFilters();
      console.log('Checking export count with endpoint:', endpoint);

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
        let errorMessage = 'Failed to retrieve export data';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const jsonData = await response.json();
      console.log('Export count check response:', jsonData);
      
      if (!jsonData || !Array.isArray(jsonData.data)) {
        throw new Error('Invalid response format from server');
      }
      
      setExportCount(jsonData.data.length);
      
      if (jsonData.data.length === 0) {
        toast({
          title: "No Data Found",
          description: "No requests match the selected criteria."
        });
        setIsLoading(false);
        return;
      }
      
      // Open confirmation dialog
      setIsConfirmOpen(true);
    } catch (error) {
      console.error('Error checking export count:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to check export data');
      toast({
        title: "Export Preparation Failed",
        description: error instanceof Error ? error.message : "Could not prepare data for export",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportRequests = async () => {
    try {
      setIsLoading(true);
      setIsConfirmOpen(false);
      
      const endpoint = processExportFilters();
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
        console.log('Export API response received with data length:', jsonData?.data?.length);
      } catch (e) {
        console.error('Error parsing JSON response:', e);
        throw new Error('Invalid response format from server');
      }
      
      // Validate response structure
      if (!jsonData || !jsonData.data) {
        throw new Error('Invalid response format from export API');
      }
      
      // Handle empty data case
      const { data } = jsonData;
      
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
      
      // Show toast that we're preparing the ZIP
      toast({
        title: "Preparing Export",
        description: `Processing ${data.length} purchase requests...`,
        variant: "default",
      });
      
      // Generate and download the ZIP file with all requests
      await exportMultipleRequestsAsZip(data, 'admin');
      
      toast({
        title: "Bulk Export Complete",
        description: `Successfully exported ${data.length} purchase requests.`
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
    <>
      <Button
        variant={variant}
        size={size}
        onClick={checkExportCount}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <FileArchive className="mr-2 h-4 w-4" />
            Export Requests
          </>
        )}
      </Button>
      
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Export</DialogTitle>
            <DialogDescription>
              You are about to export {exportCount} purchase requests with all their details.
              This may take a while depending on the amount of data.
            </DialogDescription>
          </DialogHeader>
          
          {exportCount && exportCount > 50 && (
            <Alert className="my-4 border-amber-500 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertTitle className="text-amber-800 dark:text-amber-400">Large Export</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                You are exporting a large number of requests ({exportCount}). 
                This might take some time and could impact browser performance.
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportRequests} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Proceed with Export'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}