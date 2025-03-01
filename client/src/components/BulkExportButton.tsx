import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileArchive, FileDown, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { exportMultipleRequestsAsZip } from "@/lib/exportUtils";

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
      let queryParams = '';
      
      if (selectedRequestIds.length > 0) {
        queryParams = `ids=${encodeURIComponent(JSON.stringify(selectedRequestIds))}`;
      } else if (Object.keys(filters).length > 0) {
        // Add each filter to the query parameters
        const filterParams = Object.entries(filters)
          .filter(([_, value]) => value !== undefined && value !== null && value !== '')
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}=${encodeURIComponent(value.join(','))}`;
            }
            if (value instanceof Date) {
              return `${key}=${encodeURIComponent(value.toISOString())}`;
            }
            return `${key}=${encodeURIComponent(String(value))}`;
          });
        
        queryParams = filterParams.join('&');
      }
      
      // Fetch the requests data from the API
      const endpoint = `/api/requests/export/bulk${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(endpoint, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export requests');
      }
      
      const { data } = await response.json();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No requests found matching the criteria');
      }
      
      // Generate and download the ZIP file with all requests
      await exportMultipleRequestsAsZip(data, 'admin');
      
      toast({
        title: "Bulk Export Complete",
        description: `Successfully exported ${data.length} purchase requests.`,
      });
    } catch (error) {
      console.error('Error exporting requests:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export requests",
        variant: "destructive",
      });
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