import { useState } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, FileSpreadsheet, FileText, Archive, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RequestFilters } from "@/services/requests";
import * as exportUtils from "@/lib/exportUtils";

export interface BulkExportButtonProps extends Omit<ButtonProps, "children"> {
  requests: any[];
  filters?: RequestFilters;
  format?: "excel" | "csv" | "pdf" | "zip";
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
  const [exportFormat, setExportFormat] = useState<"excel" | "csv" | "pdf" | "zip" | null>(format || null);
  const { toast } = useToast();

  const handleExport = async (selectedFormat: "excel" | "csv" | "pdf" | "zip") => {
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
      let exportResult: string;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      let fileName = `purchase-requests-export-${timestamp}`;

      // Apply any filters provided for filename clarity
      if (filters) {
        if (filters.status?.length) fileName += `-status-${filters.status.join("-")}`;
        if (filters.priority?.length) fileName += `-priority-${filters.priority.join("-")}`;
        if (filters.startDate) fileName += `-from-${filters.startDate}`;
        if (filters.endDate) fileName += `-to-${filters.endDate}`;
      }

      switch (selectedFormat) {
        case "excel":
          exportResult = await exportUtils.exportMultipleRequestsToExcel(requests);
          fileName = `${fileName}.xlsx`;
          break;
        case "csv":
          exportResult = await exportUtils.exportMultipleRequestsToCSV(requests);
          fileName = `${fileName}.csv`;
          break;
        case "pdf":
          exportResult = await exportUtils.exportMultipleRequestsToPDF(requests);
          fileName = `${fileName}.zip`;
          break;
        case "zip":
          exportResult = await exportUtils.exportMultipleRequestsAsZip(requests);
          fileName = `${fileName}.zip`;
          break;
        default:
          throw new Error(`Unsupported export format: ${selectedFormat}`);
      }

      if (exportResult) {
        // If the export utilities returned a URL, initiate download
        if (typeof exportResult === 'string' && exportResult.startsWith('blob:')) {
          await exportUtils.safeDownload(new Blob([exportResult]), fileName);
        } else {
          // Display success message
          toast({
            title: "Export Complete",
            description: `Successfully exported ${requests.length} requests as ${selectedFormat.toUpperCase()}`,
          });
        }

        if (onExportComplete) {
          onExportComplete(fileName);
        }
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
                {format === "excel" && <FileSpreadsheet className="mr-2 h-4 w-4" />}
                {format === "csv" && <FileText className="mr-2 h-4 w-4" />}
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
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
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