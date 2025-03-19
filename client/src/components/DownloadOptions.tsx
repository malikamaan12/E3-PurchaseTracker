import { useState } from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  FileDown, 
  FileText, 
  FileArchive, 
  Download, 
  Loader2, 
  AlertTriangle, 
  Table, 
  FileSpreadsheet 
} from "lucide-react";
import { 
  exportRequestToPDF, 
  exportMultipleRequestsAsZip,
  exportRequestToExcel,
  exportRequestToCSV 
} from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { quickDiagnoseExportError } from "@/services/export-analyzer";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DownloadOptionsProps {
  request: any;
  compact?: boolean;
}

export function DownloadOptions({ request, compact = false }: DownloadOptionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentExportType, setCurrentExportType] = useState<'pdf' | 'pdf-admin' | 'pdf-approver' | 'zip' | 'zip-data' | 'excel' | 'csv' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useUser();
  
  // Note: Previously determined user type - now using consolidated format
  // Keeping user role for analytics tracking only
  const userRole = user?.role;
  
  // Track analytics for download
  const trackDownload = async (fileType: string, success: boolean) => {
    try {
      // Log audit for tracking download activity
      await fetch('/api/pdf/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: success ? 'pdf_downloaded' : 'pdf_viewed',
          requestId: request.id,
          details: {
            fileType,
            userRole,
            timestamp: new Date().toISOString()
          }
        }),
      });
    } catch (error) {
      console.error('Failed to track download event:', error);
      // Non-critical error, don't display to user
    }
  };
  
  // Handle unified PDF download - type is only used for audit logging
  const handlePdfDownload = async () => {
    try {
      setIsLoading(true);
      setCurrentExportType('pdf');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing PDF",
        description: "Getting request data for download...",
      });
      
      // Get the request ID from the current request
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Validate the request ID is a valid number
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Use the actual request ID from the current request
      const useId = requestId;
      
      // Fetch request data with full details
      console.log(`Fetching PDF data for request ${useId}`);
      const response = await fetch(`/api/requests/${useId}/pdf`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download PDF');
      }
      
      const jsonData = await response.json();
      console.log('PDF API response structure:', Object.keys(jsonData));
      
      if (!jsonData || !jsonData.data) {
        throw new Error('Invalid response format from PDF API');
      }
      
      const { data } = jsonData;
      
      // Use the consolidated PDF format that works for all user types
      console.log('Generating PDF from data...');
      // Use the user role for audit logging purposes only
      const userRoleForAudit = user?.role === 'admin' ? 'admin' : 
                      (user?.role === 'approver' ? 'approver' : 'user');
      await exportRequestToPDF(data, userRoleForAudit);
      
      // Track successful download
      await trackDownload('pdf', true);
      
      toast({
        title: "Success",
        description: "PDF downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download PDF");
      
      // Track failed download
      await trackDownload('pdf', false);
      
      // First try quick diagnosis which doesn't require API call
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'pdf_export',
        entityType: 'request',
        dataSize: request.attachments?.length || 0
      });
      
      // Show toast with quick diagnosis
      toast({
        title: "Download failed",
        description: quickDiagnosis.message,
        variant: "destructive",
      });
      
      // For deeper analysis, use AI in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'pdf_export',
          requestId: request.id,
          exportType: 'unified'
        });
        
        console.log('PDF export error analysis:', analysis);
        
        // If the analysis offers more insight than quick diagnosis, show it
        if (analysis.issue.description !== quickDiagnosis.message) {
          toast({
            title: "Export Error Analysis",
            description: analysis.issue.description,
            variant: "destructive",
          });
        }
      } catch (analysisError) {
        // AI analysis failed, but we already showed quick diagnosis, so no need for another toast
        console.error('Error analyzing PDF export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle Excel download
  // Use the server-side export endpoint directly
  const handleDirectExcelExport = async () => {
    try {
      setIsLoading(true);
      setCurrentExportType('excel');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing Excel",
        description: "Generating Excel file...",
      });
      
      // Create a proper export URL with request ID if available
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Use the actual request ID from the request object
      const exportUrl = requestId && !isNaN(requestId)
        ? `/api/requests/export?id=${requestId}&format=xlsx`
        : `/api/requests/export?format=xlsx`;
      
      console.log(`Direct Excel export URL: ${exportUrl} for request ID: ${requestId}`);
      
      // Fetch Excel file directly from server
      const response = await fetch(exportUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
      
      if (!response.ok) {
        let errorMsg = 'Failed to download Excel file';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } else {
            errorMsg = await response.text() || errorMsg;
          }
        } catch (e) {
          // Ignore parsing errors and use default message
        }
        throw new Error(errorMsg);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create filename
      const fileName = `Purchase_Request_${request?.requestNumber || request?.id || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Directly initiate download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      // Track successful download
      await trackDownload('excel', true);
      
      toast({
        title: "Success",
        description: "Excel file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading Excel:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download Excel file");
      
      // Track failed download
      await trackDownload('excel', false);
      
      // Use quick diagnosis first
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'excel_export',
        entityType: 'request',
        dataSize: request?.attachments?.length || 0
      });
      
      // Show toast with quick diagnosis
      toast({
        title: "Download failed",
        description: quickDiagnosis.message,
        variant: "destructive",
      });
      
      // For more detailed analysis, use AI in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'excel_export',
          requestId: request?.id,
          directExport: true
        });
        
        console.log('Excel export error analysis:', analysis);
        
        // Log the solutions to console for developers
        if (analysis.fixes?.immediate?.length > 0) {
          console.info('Suggested fixes for Excel export issue:', analysis.fixes.immediate);
        }
      } catch (analysisError) {
        // AI analysis failed but we already showed quick diagnosis
        console.error('Error analyzing Excel export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Original client-side Excel export method as backup
  const handleExcelDownload = async (includeDetails: boolean = true) => {
    try {
      setIsLoading(true);
      setCurrentExportType('excel');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing Excel",
        description: "Getting request data for download...",
      });
      
      // Get the request ID from the current request
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Validate the request ID is a valid number
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Use the actual request ID from the current request
      const useId = requestId;
      
      // Fetch request data with full details
      console.log(`Fetching Excel data for request ${useId}`);
      const response = await fetch(`/api/requests/${useId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download Excel');
      }
      
      const data = await response.json();
      console.log('Excel API response structure:', Object.keys(data));
      
      if (!data) {
        throw new Error('Invalid response format from request API');
      }
      
      // Generate and download Excel
      console.log('Generating Excel from data...');
      await exportRequestToExcel(data);
      
      // Track successful download
      await trackDownload('excel', true);
      
      toast({
        title: "Success",
        description: "Excel file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading Excel:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download Excel file");
      
      // If client-side method fails, try the direct export 
      console.log('Client-side Excel export failed, trying direct export...');
      try {
        await handleDirectExcelExport();
        return; // If direct export succeeds, we're done
      } catch (directExportError) {
        console.error('Direct Excel export also failed:', directExportError);
        // Continue with error handling for the original error
      }
      
      // Track failed download
      await trackDownload('excel', false);
      
      // Use quick diagnosis first
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'excel_export',
        entityType: 'request',
        dataSize: request?.attachments?.length || 0
      });
      
      // Show toast with quick diagnosis
      toast({
        title: "Download failed",
        description: quickDiagnosis.message,
        variant: "destructive",
      });
      
      // For more detailed analysis, use AI in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'excel_export',
          requestId: request?.id,
          includeDetails
        });
        
        console.log('Excel export error analysis:', analysis);
        
        // Log the solutions to console for developers
        if (analysis.fixes?.immediate?.length > 0) {
          console.info('Suggested fixes for Excel export issue:', analysis.fixes.immediate);
        }
      } catch (analysisError) {
        // AI analysis failed but we already showed quick diagnosis
        console.error('Error analyzing Excel export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Use the server-side export endpoint directly for CSV
  const handleDirectCsvExport = async () => {
    try {
      setIsLoading(true);
      setCurrentExportType('csv');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing CSV",
        description: "Generating CSV file...",
      });
      
      // Create a proper export URL with request ID if available
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Use the actual request ID from the request object
      const exportUrl = requestId && !isNaN(requestId)
        ? `/api/requests/export?id=${requestId}&format=csv`
        : `/api/requests/export?format=csv`;
      
      console.log(`Direct CSV export URL: ${exportUrl} for request ID: ${requestId}`);
      
      // Fetch CSV file directly from server
      const response = await fetch(exportUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'text/csv'
        }
      });
      
      if (!response.ok) {
        let errorMsg = 'Failed to download CSV file';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } else {
            errorMsg = await response.text() || errorMsg;
          }
        } catch (e) {
          // Ignore parsing errors and use default message
        }
        throw new Error(errorMsg);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create filename
      const fileName = `Purchase_Request_${request?.requestNumber || request?.id || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Directly initiate download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      // Track successful download
      await trackDownload('csv', true);
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download CSV file");
      
      // Track failed download
      await trackDownload('csv', false);
      
      // Use quick diagnosis first
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'csv_export',
        entityType: 'request',
        dataSize: request?.attachments?.length || 0
      });
      
      // Show toast with quick diagnosis
      toast({
        title: "Download failed",
        description: quickDiagnosis.message,
        variant: "destructive",
      });
      
      // For more detailed analysis, use AI in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'csv_export',
          requestId: request?.id,
          directExport: true
        });
        
        console.log('CSV export error analysis:', analysis);
        
        // Log the solutions to console for developers
        if (analysis.fixes?.immediate?.length > 0) {
          console.info('Suggested fixes for CSV export issue:', analysis.fixes.immediate);
        }
      } catch (analysisError) {
        // AI analysis failed but we already showed quick diagnosis
        console.error('Error analyzing CSV export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Original client-side CSV export method as backup
  const handleCsvDownload = async () => {
    try {
      setIsLoading(true);
      setCurrentExportType('csv');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing CSV",
        description: "Getting request data for download...",
      });
      
      // Get the request ID from the current request
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Validate the request ID is a valid number
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Use the actual request ID from the current request
      const useId = requestId;
      
      // Fetch request data with full details
      console.log(`Fetching CSV data for request ${useId}`);
      const response = await fetch(`/api/requests/${useId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download CSV');
      }
      
      const data = await response.json();
      console.log('CSV API response structure:', Object.keys(data));
      
      if (!data) {
        throw new Error('Invalid response format from request API');
      }
      
      // Generate and download CSV
      console.log('Generating CSV from data...');
      await exportRequestToCSV(data);
      
      // Track successful download
      await trackDownload('csv', true);
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download CSV file");
      
      // If client-side method fails, try the direct export
      console.log('Client-side CSV export failed, trying direct export...');
      try {
        await handleDirectCsvExport();
        return; // If direct export succeeds, we're done
      } catch (directExportError) {
        console.error('Direct CSV export also failed:', directExportError);
        // Continue with error handling for the original error
      }
      
      // Track failed download
      await trackDownload('csv', false);
      
      // Use quick diagnosis first
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'csv_export',
        entityType: 'request',
        dataSize: request?.attachments?.length || 0
      });
      
      // Show toast with quick diagnosis
      toast({
        title: "Download failed",
        description: quickDiagnosis.message,
        variant: "destructive",
      });
      
      // For more detailed analysis, use AI in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'csv_export',
          requestId: request?.id,
        });
        
        console.log('CSV export error analysis:', analysis);
        
        // Log the solutions to console for developers
        if (analysis.fixes?.immediate?.length > 0) {
          console.info('Suggested fixes for CSV export issue:', analysis.fixes.immediate);
        }
      } catch (analysisError) {
        // AI analysis failed but we already showed quick diagnosis
        console.error('Error analyzing CSV export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle ZIP download
  const handleZipDownload = async () => {
    try {
      setIsLoading(true);
      setCurrentExportType('zip');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing ZIP",
        description: "Getting request data for download...",
      });
      
      // Get the request ID from the current request
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Validate the request ID is a valid number
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Use the actual request ID from the current request
      const useId = requestId;
      
      // Fetch request data with full details
      console.log(`Fetching ZIP data for request ${useId}`);
      const response = await fetch(`/api/requests/${useId}/zip`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download ZIP archive');
      }
      
      const data = await response.json();
      console.log('ZIP API response structure:', Object.keys(data));
      
      if (!data) {
        throw new Error('Invalid response format from request API');
      }
      
      // Extract ZIP URL
      const zipUrl = data.url;
      if (!zipUrl) {
        throw new Error('No ZIP URL returned from server');
      }
      
      // Create an anchor element to trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = zipUrl;
      a.download = `Purchase_Request_${request.requestNumber || request.id}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
      }, 100);
      
      // Track successful download
      await trackDownload('zip', true);
      
      toast({
        title: "Success",
        description: "ZIP file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download ZIP archive");
      
      // Track failed download
      await trackDownload('zip', false);
      
      // Use quick diagnosis first
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'zip_export',
        entityType: 'request',
        dataSize: request?.attachments?.length || 0
      });
      
      // Show toast with quick diagnosis
      toast({
        title: "Download failed",
        description: quickDiagnosis.message,
        variant: "destructive",
      });
      
      // For more detailed analysis, use AI in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'zip_export',
          requestId: request.id,
        });
        
        console.log('ZIP export error analysis:', analysis);
        
        // If the analysis offers more insight than quick diagnosis, show it
        if (analysis.issue.description !== quickDiagnosis.message) {
          toast({
            title: "Export Error Analysis",
            description: analysis.issue.description,
            variant: "destructive",
          });
        }
      } catch (analysisError) {
        // AI analysis failed but we already showed quick diagnosis
        console.error('Error analyzing ZIP export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col space-y-4">
      {exportError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {exportError}
          </AlertDescription>
        </Alert>
      )}
      
      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting {currentExportType}...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handlePdfDownload} disabled={isLoading}>
              <FileText className="mr-2 h-4 w-4" />
              <span>PDF Document</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDirectExcelExport()} disabled={isLoading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              <span>Excel File</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDirectCsvExport()} disabled={isLoading}>
              <Table className="mr-2 h-4 w-4" />
              <span>CSV File</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleZipDownload} disabled={isLoading}>
              <FileArchive className="mr-2 h-4 w-4" />
              <span>ZIP (All Files)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdfDownload}
            disabled={isLoading}
          >
            {isLoading && currentExportType === 'pdf' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDirectExcelExport()}
            disabled={isLoading}
          >
            {isLoading && currentExportType === 'excel' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Excel
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDirectCsvExport()}
            disabled={isLoading}
          >
            {isLoading && currentExportType === 'csv' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Table className="mr-2 h-4 w-4" />
            )}
            CSV
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZipDownload}
            disabled={isLoading}
          >
            {isLoading && currentExportType === 'zip' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileArchive className="mr-2 h-4 w-4" />
            )}
            ZIP
          </Button>
        </div>
      )}
    </div>
  );
}