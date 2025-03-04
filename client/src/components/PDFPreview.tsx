import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { FileText, Download, Printer, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { generateRequestPDF } from "@/lib/pdfGenerator";
import { PurchaseRequestWithRelations } from "@/types/requests";

interface PDFPreviewProps {
  pdfSettings: any;
  onRefresh?: () => void;
}

export function PDFPreview({ pdfSettings, onRefresh }: PDFPreviewProps) {
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
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

  const generatePreviewPDF = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Apply any PDF settings from props to the sample request
      const requestWithSettings = {
        ...sampleRequest,
        pdfSettings: pdfSettings || {}
      };
      
      // Use the real PDF generator function with our settings
      const doc = await generateRequestPDF(requestWithSettings as any, 'admin');
      
      // Convert to blob URL
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      // Clean up previous URL if it exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      
      setPdfUrl(url);
      
      toast({
        title: "Preview Updated",
        description: "PDF preview has been refreshed with current settings.",
      });
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
  }, [sampleRequest, pdfSettings, pdfUrl, toast]);
  
  // Generate preview on initial load
  useEffect(() => {
    generatePreviewPDF();
    
    // Clean up on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);
  
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
  
  // Handle refresh
  const handleRefresh = () => {
    generatePreviewPDF();
    if (onRefresh) onRefresh();
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