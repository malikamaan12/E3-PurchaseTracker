import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { FileText, Download, Printer, RefreshCw, ZoomIn, ZoomOut, Maximize, Scale } from "lucide-react";
import { generateRequestPDF } from "@/lib/pdfGenerator";
import { PurchaseRequestWithRelations } from "@/types/requests";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PDFPreviewProps {
  pdfSettings: any;
  onRefresh?: () => void;
  isDesignMode?: boolean;
}

export function PDFPreview({ pdfSettings, onRefresh, isDesignMode = false }: PDFPreviewProps) {
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [useBlankTemplate, setUseBlankTemplate] = useState(isDesignMode);
  const [showGridLines, setShowGridLines] = useState(isDesignMode);
  
  // Sample data to generate the preview
  const sampleRequest: Partial<PurchaseRequestWithRelations> = {
    id: 12345,
    requestNumber: "PR-12345",
    title: "Office Equipment Purchase",
    description: "Purchase of new office equipment for the engineering department",
    status: "pending",
    priority: "medium",
    createdAt: new Date().toISOString(),
    requester: {
      id: 1,
      username: "John Smith",
      department: "Engineering",
    },
    items: [
      {
        name: "Laptop Computer",
        quantity: 2,
        estimatedCost: 1200,
        description: "Dell XPS 15 Laptop"
      },
      {
        name: "Office Chair",
        quantity: 3,
        estimatedCost: 350,
        description: "Ergonomic office chair"
      },
      {
        name: "Desk",
        quantity: 2,
        estimatedCost: 500,
        description: "Adjustable standing desk"
      }
    ],
    currency: "USD",
    freightAmount: 0,
    purposeType: "office_equipment",
    subPurpose: { name: "Hardware" },
    approvals: [
      {
        id: 1,
        status: "approved",
        department: "Department Head",
        comments: "Approved as requested",
        processedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        approver: { username: "Jane Doe" }
      },
      {
        id: 2,
        status: "pending",
        department: "Finance",
        approver: { username: "Mike Johnson" }
      },
      {
        id: 3,
        status: "pending",
        department: "CEO Office",
        approver: { username: "Sarah Williams" }
      }
    ]
  };

  const generateBlankTemplate = useCallback(() => {
    setIsLoading(true);
    
    try {
      // Create a blank template for design purposes
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      
      // Draw a blank page with a grid if showGridLines is enabled
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 595, 842, 'F');
      
      if (showGridLines) {
        // Draw grid lines
        doc.setLineWidth(0.2);
        
        // Draw vertical grid lines
        for (let x = 50; x < 595; x += 50) {
          doc.line(x, 0, x, 842);
        }
        
        // Draw horizontal grid lines
        for (let y = 50; y < 842; y += 50) {
          doc.line(0, y, 595, y);
        }
        
        // Draw content area indicator
        doc.setLineDashPattern([5, 5], 0);
        doc.setDrawColor(200, 200, 200);
        doc.rect(40, 120, 515, 602);
        doc.setFontSize(12);
        doc.setTextColor(180, 180, 180);
        doc.text('DOCUMENT CONTENT AREA', 297.5, 421, { align: 'center' });
        
        // Draw header and footer areas
        doc.rect(0, 0, 595, 100);
        doc.rect(0, 780, 595, 62);
      }
      
      // Add branding elements from settings
      if (pdfSettings) {
        // Add logo if enabled
        if (pdfSettings.showLogo && pdfSettings.logo) {
          try {
            doc.addImage(pdfSettings.logo, 'PNG', 20, 20, 100, 60);
          } catch (e) {
            console.error('Failed to add logo', e);
          }
        }
        
        // Add header image if enabled
        if (pdfSettings.showHeaderImage && pdfSettings.headerImage) {
          try {
            doc.addImage(pdfSettings.headerImage, 'PNG', 0, 0, 595, 100);
          } catch (e) {
            console.error('Failed to add header image', e);
          }
        }
        
        // Add header text if enabled
        if (pdfSettings.showHeaderText) {
          doc.setTextColor(pdfSettings.headerColor || '#6F2AE6');
          doc.setFontSize(20);
          doc.setFont('helvetica', 'bold');
          doc.text(pdfSettings.headerTitle || 'EVENTS & ENTERTAINMENT', 140, 40);
          doc.setFontSize(14);
          doc.text(pdfSettings.headerSubtitle || 'ENTERPRISES', 140, 60);
        }
        
        // Add footer image if enabled
        if (pdfSettings.showFooterImage && pdfSettings.footerImage) {
          try {
            doc.addImage(pdfSettings.footerImage, 'PNG', 0, 780, 595, 62);
          } catch (e) {
            console.error('Failed to add footer image', e);
          }
        }
        
        // Add footer text if enabled
        if (pdfSettings.showFooterText) {
          doc.setTextColor(pdfSettings.footerColor || '#6F2AE6');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(pdfSettings.footerText || 'ALL RIGHTS RESERVED BY E3', 297.5, 820, { align: 'center' });
        }
        
        // Add page numbers if enabled
        if (pdfSettings.pageNumbering) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text('Page 1 of 1', 560, 830, { align: 'right' });
        }
      }
      
      // Create data URL for preview
      const pdfBlob = doc.output('blob');
      const blobWithType = new Blob([pdfBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blobWithType);
      
      // Clean up previous URL if it exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating blank template:", error);
      toast({
        title: "Template Generation Failed",
        description: "Could not generate blank template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [pdfSettings, pdfUrl, showGridLines, toast, useBlankTemplate]);

  const generatePreviewPDF = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // If using blank template in design mode, use that instead of the full PDF
      if (useBlankTemplate) {
        generateBlankTemplate();
        return;
      }
      
      // Apply all PDF settings from props to the sample request
      const requestWithSettings = {
        ...sampleRequest,
        pdfSettings: {
          ...pdfSettings,
          // Ensure the template mode is passed to the PDF generator
          templateMode: pdfSettings?.templateMode || 'standard'
        }
      };
      
      // Use the real PDF generator function with our settings
      const doc = await generateRequestPDF(requestWithSettings as any, 'admin');
      
      try {
        // Convert to blob URL
        const pdfBlob = doc.output('blob');
        
        // Add proper content type to avoid Chrome blocking
        const blobWithType = new Blob([pdfBlob], { type: 'application/pdf' });
        const url = URL.createObjectURL(blobWithType);
        
        // Clean up previous URL if it exists
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        
        setPdfUrl(url);
      } catch (blobError) {
        console.error("Error creating PDF blob:", blobError);
        toast({
          title: "PDF Rendering Error",
          description: "Could not create PDF preview. Browser security settings may be blocking the preview.",
          variant: "destructive",
        });
      }
      
      // Silent refresh - no toast notification to avoid spam
      // Only show toast when manually refreshing
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      toast({
        title: "Preview Generation Failed",
        description: "Could not generate PDF preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [sampleRequest, pdfSettings, pdfUrl, toast, useBlankTemplate, generateBlankTemplate]);
  
  // Generate preview on initial load and when pdfSettings change
  useEffect(() => {
    const loadPreview = async () => {
      await generatePreviewPDF();
    };
    
    loadPreview();
    
    // Clean up on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfSettings, pdfSettings?.headerImage, pdfSettings?.footerImage, pdfSettings?.logo]);
  
  // Handle zoom in and out
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 2));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };
  
  // Handle download
  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = 'E3-Purchase-Request-Preview.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  // Handle print
  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };
  
  // Handle refresh with notification
  const handleRefresh = () => {
    // Generate the PDF first
    generatePreviewPDF().then(() => {
      // Show toast notification only on manual refresh
      toast({
        title: "Preview Updated",
        description: "PDF preview has been refreshed with current settings.",
      });
      
      // Call the onRefresh callback if provided
      if (onRefresh) onRefresh();
    });
  };
  
  // Toggle design mode settings and refresh preview
  const toggleBlankTemplate = (value: boolean) => {
    setUseBlankTemplate(value);
    // Refresh the preview after changing setting
    setTimeout(() => generatePreviewPDF(), 0);
  };
  
  const toggleGridLines = (value: boolean) => {
    setShowGridLines(value);
    // Refresh the preview after changing setting
    setTimeout(() => generatePreviewPDF(), 0);
  };
  
  return (
    <div className="flex flex-col h-full w-full">
      <div className="mb-4 flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 2}
          >
            <ZoomIn className="h-4 w-4" />
            Zoom In
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
            Zoom Out
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleDownload}
            disabled={!pdfUrl || isLoading}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handlePrint}
            disabled={!pdfUrl || isLoading}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
      
      {/* Design mode controls */}
      {isDesignMode && (
        <div className="mb-4 p-3 border rounded-md bg-muted/30 space-y-2">
          <h3 className="text-sm font-medium mb-2">Design Mode Controls</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="blankTemplate"
                checked={useBlankTemplate}
                onCheckedChange={toggleBlankTemplate}
              />
              <Label htmlFor="blankTemplate">Blank Template</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showGridLines"
                checked={showGridLines}
                onCheckedChange={toggleGridLines}
                disabled={!useBlankTemplate}
              />
              <Label 
                htmlFor="showGridLines"
                className={!useBlankTemplate ? "text-muted-foreground" : ""}
              >
                Show Grid Lines
              </Label>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-1">
            Using a blank template with branding allows you to focus on layout without content.
          </p>
        </div>
      )}
      
      <div className="flex-1 overflow-auto border rounded-lg bg-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Generating preview...</span>
          </div>
        ) : pdfUrl ? (
          <div 
            className="pdf-container" 
            style={{ 
              transformOrigin: 'top center', 
              transform: `scale(${zoomLevel})`,
              transition: 'transform 0.2s ease-in-out'
            }}
          >
            <iframe 
              src={pdfUrl} 
              className="w-full h-[800px]"
              title="PDF Preview"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileText className="h-16 w-16 mb-4" />
            <p>No preview available. Click refresh to generate a preview.</p>
          </div>
        )}
      </div>
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          .pdf-container iframe {
            height: 100%;
            width: 100%;
          }
        }
        `
      }} />
    </div>
  );
}