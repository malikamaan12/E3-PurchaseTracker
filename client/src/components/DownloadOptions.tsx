import { useState } from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, FileArchive, Download, Loader2 } from "lucide-react";
import { exportRequestToPDF, exportRequestAsZip } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface DownloadOptionsProps {
  request: any;
  compact?: boolean;
}

export function DownloadOptions({ request, compact = false }: DownloadOptionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  
  // Determine user type based on role for appropriate export options
  const userType = user?.role === 'admin' 
    ? 'admin' 
    : (user?.role === 'approver' ? 'approver' : 'user');
  
  // Handle PDF download
  const handlePdfDownload = async (type: 'user' | 'approver' | 'admin' = 'user') => {
    try {
      setIsLoading(true);
      
      // Only allow admin to download admin PDF
      if (type === 'admin' && user?.role !== 'admin') {
        throw new Error('You do not have permission to download this report');
      }
      
      // Only allow approver or admin to download approver PDF
      if (type === 'approver' && !['approver', 'admin'].includes(user?.role || '')) {
        throw new Error('You do not have permission to download this report');
      }
      
      // Fetch request data with full details
      const response = await fetch(`/api/requests/${request.id}/pdf?type=${type}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download PDF');
      }
      
      const { data } = await response.json();
      
      // Generate and download PDF
      await exportRequestToPDF(data, type);
      
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle ZIP download
  const handleZipDownload = async (includeAttachments: boolean = true) => {
    try {
      setIsLoading(true);
      
      // Fetch request data with attachments
      const response = await fetch(`/api/requests/${request.id}/zip?type=${userType}&includeAttachments=${includeAttachments}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download ZIP');
      }
      
      const { data } = await response.json();
      
      // Generate and download ZIP
      await exportRequestAsZip(data, includeAttachments, userType);
      
      toast({
        title: "Success",
        description: `ZIP file ${includeAttachments ? 'with attachments ' : ''}downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download ZIP file",
        variant: "destructive",
      });
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
            <DropdownMenuItem onClick={() => handlePdfDownload('admin')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Download Admin PDF</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  // Full layout with separate buttons
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handlePdfDownload(userType)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Download PDF
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handleZipDownload(true)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileArchive className="mr-2 h-4 w-4" />
        )}
        Download ZIP
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