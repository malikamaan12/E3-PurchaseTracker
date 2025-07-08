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
  FileText, 
  FileArchive, 
  Download, 
  Loader2, 
  AlertTriangle
} from "lucide-react";
import { 
  exportRequestToPDF, 
  exportMultipleRequestsAsZip
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
  const [currentExportType, setCurrentExportType] = useState<'pdf' | 'pdf-admin' | 'pdf-approver' | 'zip' | 'zip-data' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useUser();
  
  // Note: Previously determined user type - now using consolidated format
  // Keeping user role for analytics tracking only
  const userRole = user?.role;
  
  // Track analytics for download using export audit utilities
  const trackDownload = async (fileType: string, success: boolean) => {
    try {
      // Import the validation and logging functions
      const { 
        validateResourceId,
        logPdfExport, 
        logZipExport 
      } = await import('@/lib/exportAuditUtils');
      
      // Validate the request ID first
      const validatedId = validateResourceId(request?.id);
      if (validatedId === null) {
        console.warn(`Invalid request ID for tracking ${fileType} download: ${request?.id}`);
        return; // Skip tracking for invalid IDs
      }
      
      // Prepare common details
      const details = {
        success,
        userRole: userRole || 'user',
        operation: success ? 'download' : 'view',
        timestamp: new Date().toISOString()
      };
      
      console.log(`Tracking ${fileType} ${success ? 'download' : 'view'} for request ID: ${validatedId}`);
      
      // Use the appropriate specialized logging function based on file type
      switch (fileType) {
        case 'pdf':
          await logPdfExport(validatedId, details, userRole as any || 'user');
          break;
        case 'zip':
          await logZipExport(validatedId, details, userRole as any || 'user');
          break;
        default:
          // For backwards compatibility, use PDF export logging
          await logPdfExport(validatedId, { ...details, fileType }, userRole as any || 'user');
      }
    } catch (error) {
      console.error(`Failed to track ${fileType} ${success ? 'download' : 'view'} event:`, error);
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
      
      const { data, pdfSettings } = jsonData;
      
      // Use the consolidated PDF format that works for all user types
      console.log('Generating PDF from data...');
      // Use the user role for audit logging purposes only
      const userRoleForAudit = user?.role === 'admin' ? 'admin' : 
                      (user?.role === 'approver' ? 'approver' : 'user');
      await exportRequestToPDF(data, userRoleForAudit, pdfSettings);
      
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
  
  // Handle ZIP download with attachments
  const handleZipDownload = async () => {
    try {
      setIsLoading(true);
      setCurrentExportType('zip');
      setExportError(null);

      // Show toast for starting the download process
      toast({
        title: "Preparing ZIP",
        description: "Getting request data and attachments for download...",
      });

      // Get the request ID from the current request
      const requestId = request?.id ? parseInt(String(request.id)) : null;
      
      // Validate the request ID is a valid number
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Try to fetch ZIP file directly from server first
      console.log(`Fetching ZIP package for request ${requestId}`);
      const zipUrl = `/api/requests/${requestId}/zip`;
      const response = await fetch(zipUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/zip, application/octet-stream'
        }
      });
      
      if (response.ok) {
        // Server returned a ZIP file
        const blob = await response.blob();
        
        // Create filename for the zip file
        const fileName = `Purchase_Request_${request?.requestNumber || request?.id}_with_attachments.zip`;
        
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
      } else {
        // Server didn't return a ZIP file, fall back to client-side generation
        console.log("Server ZIP generation failed, falling back to client-side generation");
        
        // Get request data for client-side ZIP generation
        const dataResponse = await fetch(`/api/requests/${requestId}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!dataResponse.ok) {
          throw new Error('Failed to fetch request data');
        }
        
        const requestData = await dataResponse.json();
        
        // Create ZIP file client-side
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        const requestNumber = requestData.requestNumber || `PR-${requestId}`;
        const requestFolder = zip.folder(requestNumber);
        
        if (!requestFolder) {
          throw new Error('Failed to create ZIP folder');
        }
        
        // Add request details as JSON
        requestFolder.file('request-data.json', JSON.stringify(requestData, null, 2));
        
        // Add summary text file
        const summary = `
Purchase Request Summary
=======================
Request ID: ${requestId}
Request Number: ${requestNumber}
Title: ${requestData.title || 'N/A'}
Status: ${requestData.status || 'N/A'}
Created: ${requestData.createdAt ? new Date(requestData.createdAt).toLocaleDateString() : 'N/A'}
Requester: ${requestData.requester?.username || 'N/A'}
Department: ${requestData.requester?.department || 'N/A'}
Items Count: ${requestData.items?.length || 0}
Total Cost: ${requestData.totalEstimatedCost || 0} ${requestData.currency || 'QAR'}
        `;
        requestFolder.file('summary.txt', summary);
        
        // Generate and add PDF
        try {
          const pdfResponse = await fetch(`/api/requests/${requestId}/pdf`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/pdf'
            }
          });
          
          if (pdfResponse.ok) {
            const pdfBlob = await pdfResponse.blob();
            requestFolder.file(`${requestNumber}.pdf`, pdfBlob);
          }
        } catch (pdfError) {
          console.error('Error fetching PDF:', pdfError);
        }
        
        // Add attachments
        if (requestData.attachments && requestData.attachments.length > 0) {
          const attachmentsFolder = requestFolder.folder('attachments');
          
          if (attachmentsFolder) {
            for (const attachment of requestData.attachments) {
              try {
                const attachmentResponse = await fetch(`/api/attachments/${attachment.id}`, {
                  credentials: 'include'
                });
                
                if (attachmentResponse.ok) {
                  const attachmentBlob = await attachmentResponse.blob();
                  attachmentsFolder.file(attachment.fileName, attachmentBlob);
                }
              } catch (attachmentError) {
                console.error(`Error fetching attachment ${attachment.fileName}:`, attachmentError);
                // Add a note about missing file
                attachmentsFolder.file(`${attachment.fileName}.missing.txt`, 
                  `This attachment file (${attachment.fileName}) could not be downloaded.`);
              }
            }
          }
        }
        
        // Generate ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // Create filename for the zip file
        const fileName = `Purchase_Request_${request?.requestNumber || request?.id}_with_attachments.zip`;
        
        // Directly initiate download
        const url = window.URL.createObjectURL(zipBlob);
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
      }
      
      // Track successful download
      await trackDownload('zip', true);
      
      toast({
        title: "Success",
        description: "ZIP file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      setExportError(error instanceof Error ? error.message : "Failed to download ZIP package");
      
      // Track failed download
      await trackDownload('zip', false);
      
      // Quick diagnosis first
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
      
      // For more detailed analysis in background
      try {
        const { analyzeExportIssue } = await import('@/services/export-analyzer');
        const analysis = await analyzeExportIssue(error, {
          operation: 'zip_export',
          requestId: request?.id,
          attachmentsCount: request?.attachments?.length || 0
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