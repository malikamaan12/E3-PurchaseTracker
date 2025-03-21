import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, FileSearch, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pdfService } from '../services/pdfService';
import { pdfAnalysisService } from '../services/pdfAnalysisService';

interface EnhancedPdfExportProps {
  requestId: number;
  userRole?: 'user' | 'approver' | 'admin';
  disabled?: boolean;
  label?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showDialog?: boolean;
}

/**
 * Enhanced PDF Export Button with AI-powered analysis
 * 
 * This component provides a unified interface for exporting PDFs with
 * intelligent error handling and optimization suggestions.
 */
export function EnhancedPdfExport({
  requestId,
  userRole = 'user',
  disabled = false,
  label = 'Export PDF',
  variant = 'default',
  size = 'default',
  showDialog = true
}: EnhancedPdfExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportOption, setExportOption] = useState<'pdf' | 'zip'>('pdf');
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
    recommendations?: string[];
  } | null>(null);
  
  const { toast } = useToast();
  
  // Handle direct export (no dialog)
  const handleDirectExport = async () => {
    if (disabled || isExporting) return;
    
    setIsExporting(true);
    
    try {
      const fileName = await pdfService.exportRequestToPdf(requestId, userRole);
      
      toast({
        title: 'PDF Exported',
        description: `Successfully exported ${fileName}`,
      });
      
      setExportResult({
        success: true,
        message: `Successfully exported ${fileName}`
      });
    } catch (error) {
      console.error('PDF export error:', error);
      
      // Analyze the error with AI
      try {
        const analysis = await pdfAnalysisService.analyzePdfError(error, requestId);
        
        setExportResult({
          success: false,
          message: error instanceof Error ? error.message : String(error),
          recommendations: analysis.recommendations
        });
      } catch (analysisError) {
        console.error('Error analyzing PDF error:', analysisError);
        
        setExportResult({
          success: false,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      setIsExporting(false);
    }
  };
  
  // Handle dialog-based export
  const handleDialogExport = async () => {
    setIsExporting(true);
    
    try {
      if (exportOption === 'pdf') {
        const fileName = await pdfService.exportRequestToPdf(requestId, userRole);
        
        toast({
          title: 'PDF Exported',
          description: `Successfully exported ${fileName}`,
        });
        
        setExportResult({
          success: true,
          message: `Successfully exported ${fileName}`
        });
      } else { // zip
        const fileName = await pdfService.exportRequestsAsZip([requestId], includeAttachments);
        
        toast({
          title: 'ZIP Exported',
          description: `Successfully exported ${fileName}`,
        });
        
        setExportResult({
          success: true,
          message: `Successfully exported ${fileName}`
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      
      // Analyze the error with AI
      try {
        const analysis = await pdfAnalysisService.analyzePdfError(error, requestId);
        
        setExportResult({
          success: false,
          message: error instanceof Error ? error.message : String(error),
          recommendations: analysis.recommendations
        });
      } catch (analysisError) {
        console.error('Error analyzing export error:', analysisError);
        
        setExportResult({
          success: false,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      setIsExporting(false);
    }
  };
  
  // Handle click based on dialog setting
  const handleClick = () => {
    if (showDialog) {
      setDialogOpen(true);
      setExportResult(null);
    } else {
      handleDirectExport();
    }
  };
  
  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled || isExporting}
        onClick={handleClick}
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
      
      {showDialog && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Export Request</DialogTitle>
              <DialogDescription>
                Choose your export options for this request.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="export-type" className="text-right">
                  Format
                </Label>
                <Select
                  value={exportOption}
                  onValueChange={(value) => setExportOption(value as 'pdf' | 'zip')}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="zip">ZIP Archive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {exportOption === 'zip' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="include-attachments" className="text-right">
                    Include Attachments
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Switch
                      id="include-attachments"
                      checked={includeAttachments}
                      onCheckedChange={setIncludeAttachments}
                    />
                    <Label htmlFor="include-attachments">
                      {includeAttachments ? 'Yes' : 'No'}
                    </Label>
                  </div>
                </div>
              )}
              
              {exportResult && (
                <div className={`p-4 rounded-md ${
                  exportResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {exportResult.success ? (
                        <Check className="h-5 w-5 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium">
                        {exportResult.success ? 'Export successful' : 'Export failed'}
                      </h3>
                      <div className="mt-2 text-sm">
                        <p>{exportResult.message}</p>
                        
                        {exportResult.recommendations && exportResult.recommendations.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium">Recommendations:</p>
                            <ul className="list-disc pl-5 space-y-1 mt-1">
                              {exportResult.recommendations.slice(0, 3).map((rec, i) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDialogExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * PDF Preview Button Component
 */
export function PdfPreviewButton({
  requestId,
  userRole = 'user',
  disabled = false,
  label = 'Preview PDF',
  variant = 'outline',
  size = 'default'
}: Omit<EnhancedPdfExportProps, 'showDialog'>) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const handlePreview = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Log the audit event first
      await pdfService.logPdfAudit(
        requestId,
        'pdf_viewed',
        {
          previewType: 'browser',
          timestamp: new Date().toISOString()
        },
        userRole
      );
      
      // Open preview in new tab
      window.open(`/api/requests/${requestId}/pdf?preview=true`, '_blank');
    } catch (error) {
      console.error('PDF preview error:', error);
      
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Failed to generate PDF preview',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
      onClick={handlePreview}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <FileSearch className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}