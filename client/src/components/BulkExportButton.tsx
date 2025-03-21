import { useState } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, FileText, Archive, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RequestFilters } from "@/services/requests";
import * as exportUtils from "@/lib/exportUtils";

export interface BulkExportButtonProps extends Omit<ButtonProps, "children"> {
  requests: any[];
  filters?: RequestFilters;
  format?: "pdf" | "zip";
  includeAttachments?: boolean;
  children?: React.ReactNode; 
  onExportComplete?: (fileName: string) => void;
  onExportError?: (error: Error) => void;
}

export function BulkExportButton({
  requests,
  filters,
  format,
  includeAttachments = true,
  className,
  children,
  onExportComplete,
  onExportError,
  ...props
}: BulkExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "zip" | null>(format || null);
  const { toast } = useToast();

  const handleExport = async (selectedFormat: "pdf" | "zip") => {
    if (!requests || requests.length === 0) {
      toast({
        title: "No requests to export",
        description: "Please select at least one request for export",
      });
      return;
    }

    setExportFormat(selectedFormat);
    setExporting(true);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      let fileName = `purchase-requests-export-${timestamp}`;

      // Apply any filters provided for filename clarity
      if (filters) {
        if (filters.status?.length) fileName += `-status-${filters.status.join("-")}`;
        if (filters.priority?.length) fileName += `-priority-${filters.priority.join("-")}`;
        if (filters.startDate) fileName += `-from-${filters.startDate}`;
        if (filters.endDate) fileName += `-to-${filters.endDate}`;
      }

      // Add format-specific extension to the filename
      let fileExtension = '';
      switch (selectedFormat) {
        case "pdf":
        case "zip":
          fileExtension = '.zip';
          break;
      }
      
      fileName += fileExtension;
      
      // Show toast to inform user we're starting the export
      toast({
        title: "Starting Export",
        description: `Preparing ${requests.length} requests for export as ${selectedFormat.toUpperCase()}...`,
      });
      
      let exportedFileName: string;
      
      // Use the appropriate export function based on format
      try {
        console.log(`Starting ${selectedFormat} export for ${requests.length} requests`);
        
        switch (selectedFormat) {
          case "pdf":
            exportedFileName = await exportUtils.exportMultipleRequestsToPDF(requests);
            break;
          case "zip":
            exportedFileName = await exportUtils.exportMultipleRequestsAsZip(requests, includeAttachments);
            break;
          default:
            throw new Error(`Unsupported export format: ${selectedFormat}`);
        }
        
        // If we get here, the export functions successfully triggered a download
        console.log(`Export completed successfully as: ${exportedFileName}`);
        
        // Export was successful if we reached this point
        toast({
          title: "Export Complete",
          description: `Successfully exported ${requests.length} requests as ${selectedFormat.toUpperCase()}`,
        });

        if (onExportComplete) {
          // Use the actual filename returned by the export function
          onExportComplete(exportedFileName || fileName);
        }
      } catch (exportError) {
        console.error(`Error during ${selectedFormat} export:`, exportError);
        throw exportError; // Rethrow to be caught by the outer try/catch
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error 
          ? error.message 
          : "An unexpected error occurred during export",
        variant: "destructive",
      });
      
      if (onExportError && error instanceof Error) {
        onExportError(error);
      }
    } finally {
      setExporting(false);
      setExportFormat(null);
    }
  };

  if (format) {
    return (
      <Button
        onClick={() => handleExport(format)}
        disabled={exporting || !requests || requests.length === 0}
        className={className}
        {...props}
      >
        {exporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            {children || (
              <>
                {format === "pdf" && <FileText className="mr-2 h-4 w-4" />}
                {format === "zip" && <Archive className="mr-2 h-4 w-4" />}
                Export as {format === "pdf" ? "PDF (ZIP)" : format.toUpperCase()}
              </>
            )}
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={exporting || !requests || requests.length === 0}
          className={className}
          {...props}
        >
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting as {exportFormat?.toUpperCase()}...
            </>
          ) : (
            <>
              {children || (
                <>
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="mr-2 h-4 w-4" />
          PDF (ZIP with PDFs)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("zip")}>
          <Archive className="mr-2 h-4 w-4" />
          ZIP {includeAttachments ? "(with attachments)" : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default BulkExportButton;