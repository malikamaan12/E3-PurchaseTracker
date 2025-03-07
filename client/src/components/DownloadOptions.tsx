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
  
  // Determine user type based on role for appropriate export options
  const userType = user?.role === 'admin' 
    ? 'admin' 
    : (user?.role === 'approver' ? 'approver' : 'user');
  
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
          action: `pdf_${success ? 'downloaded' : 'failed'}`,
          requestId: request.id,
          details: {
            fileType,
            userType,
            timestamp: new Date().toISOString()
          }
        }),
      });
    } catch (error) {
      console.error('Failed to track download event:', error);
      // Non-critical error, don't display to user
    }
  };
  
  // Handle PDF download
  const handlePdfDownload = async (type: 'user' | 'approver' | 'admin' = 'user') => {
    try {
      setIsLoading(true);
      setCurrentExportType(type === 'admin' ? 'pdf-admin' : type === 'approver' ? 'pdf-approver' : 'pdf');
      setExportError(null);
      
      // Only allow admin to download admin PDF
      if (type === 'admin' && user?.role !== 'admin') {
        throw new Error('You do not have permission to download this report');
      }
      
      // Only allow approver or admin to download approver PDF
      if (type === 'approver' && !['approver', 'admin'].includes(user?.role || '')) {
        throw new Error('You do not have permission to download this report');
      }
      
      // Show toast for starting the download process
      toast({
        title: "Preparing PDF",
        description: "Getting request data for download...",
      });
      
      // Fetch request data with full details
      console.log(`Fetching PDF data for request ${request.id} with type ${type}`);
      const response = await fetch(`/api/requests/${request.id}/pdf?type=${type}`, {
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
      
      // Generate and download PDF
      console.log('Generating PDF from data...');
      await exportRequestToPDF(data, type);
      
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
          exportType: type
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
      const exportUrl = request?.id 
        ? `/api/requests/export?id=${request.id}&format=xlsx` 
        : `/api/requests/export?format=xlsx`;
      
      console.log(`Direct Excel export URL: ${exportUrl}`);
      
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
      
      // Fetch request data with full details
      console.log(`Fetching Excel data for request ${request?.id}`);
      const response = await fetch(`/api/requests/${request?.id}`, {
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
      await exportRequestToExcel(data, includeDetails);
      
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
      const exportUrl = request?.id 
        ? `/api/requests/export?id=${request.id}&format=csv` 
        : `/api/requests/export?format=csv`;
      
      console.log(`Direct CSV export URL: ${exportUrl}`);
      
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
  const handleCsvDownload = async (exportType: 'basic' | 'items' | 'approvals' | 'all' = 'all') => {
    try {
      setIsLoading(true);
      setCurrentExportType('csv');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing CSV",
        description: `Getting ${exportType} data for download...`,
      });
      
      // Fetch request data
      console.log(`Fetching CSV data for request ${request?.id} with type ${exportType}`);
      const response = await fetch(`/api/requests/${request?.id}`, {
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
      await exportRequestToCSV(data, exportType);
      
      // Track successful download
      await trackDownload('csv', true);
      
      toast({
        title: "Success",
        description: `CSV file${exportType === 'all' ? 's' : ''} downloaded successfully`
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
        dataSize: request?.items?.length || 0
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
          exportFormat: exportType
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
  const handleZipDownload = async (includeAttachments: boolean = true) => {
    try {
      setIsLoading(true);
      setCurrentExportType('zip');
      setExportError(null);
      
      // Show toast for starting the download process
      toast({
        title: "Preparing ZIP",
        description: `Getting request data${includeAttachments ? ' and attachments' : ''}...`,
      });
      
      // Fetch request data with attachments
      console.log(`Fetching ZIP data for request ${request.id} with type ${userType}, includeAttachments: ${includeAttachments}`);
      const response = await fetch(`/api/requests/${request.id}/zip?type=${userType}&includeAttachments=${includeAttachments}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download ZIP');
      }
      
      const jsonData = await response.json();
      console.log('ZIP API response structure:', Object.keys(jsonData));
      
      if (!jsonData || !jsonData.data) {
        throw new Error('Invalid response format from ZIP API');
      }
      
      const { data } = jsonData;
      
      // Generate and download ZIP
      console.log('Generating ZIP from data...');
      await exportRequestAsZip(data, includeAttachments, userType);
      
      // Track successful download
      await trackDownload('zip', true);
      
      toast({
        title: "Success",
        description: `ZIP file ${includeAttachments ? 'with attachments ' : ''}downloaded successfully`
      });
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download ZIP file");
      
      // Track failed download
      await trackDownload('zip', false);
      
      // Use quick diagnosis first
      const quickDiagnosis = quickDiagnoseExportError(error, {
        operation: 'zip_export',
        entityType: 'request',
        dataSize: request.attachments?.length || 0
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
          exportType: userType,
          includeAttachments
        });
        
        console.log('ZIP export error analysis:', analysis);
        
        // Log the solutions to console for developers
        if (analysis.fixes?.immediate?.length > 0) {
          console.info('Suggested fixes for ZIP export issue:', analysis.fixes.immediate);
        }
      } catch (analysisError) {
        // AI analysis failed but we already showed quick diagnosis
        console.error('Error analyzing ZIP export error:', analysisError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  if (compact) {
    // Single button with dropdown menu for compact layout
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => handlePdfDownload('user')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Download as PDF</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleDirectExcelExport()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            <span>Download as Excel</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleDirectCsvExport()}>
            <Table className="mr-2 h-4 w-4" />
            <span>Download as CSV</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => handleZipDownload(true)}>
            <FileArchive className="mr-2 h-4 w-4" />
            <span>Download as ZIP with attachments</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleZipDownload(false)}>
            <FileArchive className="mr-2 h-4 w-4" />
            <span>Download as ZIP (data only)</span>
          </DropdownMenuItem>
          
          {/* Show approver option for approvers and admins */}
          {['approver', 'admin'].includes(user?.role || '') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePdfDownload('approver')}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Download Approver PDF</span>
              </DropdownMenuItem>
            </>
          )}
          
          {/* Show admin option for admins only */}
          {user?.role === 'admin' && (
            <>
              <DropdownMenuItem onClick={() => handlePdfDownload('admin')}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Download Admin PDF</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleCsvDownload('all')}>
                <Table className="mr-2 h-4 w-4" />
                <span>Download All CSV Data</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  // Full layout with separate buttons
  return (
    <div className="flex flex-col gap-2 sm:flex-row flex-wrap">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handlePdfDownload(userType)}
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
        onClick={() => handleZipDownload(true)}
        disabled={isLoading}
      >
        {isLoading && currentExportType === 'zip' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileArchive className="mr-2 h-4 w-4" />
        )}
        ZIP
      </Button>
      
      {/* For admin, show a dropdown with all options */}
      {user?.role === 'admin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              More Options
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handlePdfDownload('user')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Download User PDF</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handlePdfDownload('approver')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Download Approver PDF</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handlePdfDownload('admin')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Download Admin PDF</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => handleExcelDownload(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              <span>Download Excel (with details)</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handleExcelDownload(false)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              <span>Download Excel (basic)</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => handleCsvDownload('basic')}>
              <Table className="mr-2 h-4 w-4" />
              <span>Download Basic CSV</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handleCsvDownload('items')}>
              <Table className="mr-2 h-4 w-4" />
              <span>Download Items CSV</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handleCsvDownload('approvals')}>
              <Table className="mr-2 h-4 w-4" />
              <span>Download Approvals CSV</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handleCsvDownload('all')}>
              <Table className="mr-2 h-4 w-4" />
              <span>Download All CSV Data</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => handleZipDownload(false)}>
              <FileArchive className="mr-2 h-4 w-4" />
              <span>Download ZIP (data only)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}