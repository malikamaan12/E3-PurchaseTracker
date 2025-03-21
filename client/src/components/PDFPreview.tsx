import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PdfSettings } from '../services/pdfService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Eye, Download, RefreshCw, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PDFPreviewProps {
  settings: Partial<PdfSettings>;
  previewData?: any;
  isLoading?: boolean;
  requestId?: number;
  onRefresh?: () => void;
}

const defaultPreviewData = {
  requestNumber: 'PR-PREVIEW-12345',
  title: 'Sample Purchase Request',
  description: 'This is a preview of how your PDF will look',
  status: 'Draft',
  requester: {
    name: 'John Doe',
    department: 'IT Department'
  },
  createdAt: new Date().toISOString(),
  items: [
    {
      name: 'Sample Item 1',
      quantity: 2,
      description: 'This is a sample item for preview purposes',
      estimatedCost: 100
    },
    {
      name: 'Sample Item 2',
      quantity: 1,
      description: 'Another sample item to demonstrate how items appear in the preview',
      estimatedCost: 150
    }
  ],
  approvals: [
    {
      department: 'Finance',
      status: 'Pending',
      approver: { name: 'Jane Smith' }
    },
    {
      department: 'Management',
      status: 'Pending',
      approver: { name: 'Mike Johnson' }
    }
  ]
};

export function PDFPreview({ settings, previewData = defaultPreviewData, isLoading = false, requestId, onRefresh }: PDFPreviewProps) {
  const [activePreview, setActivePreview] = useState<'desktop' | 'mobile'>('desktop');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate a new preview when settings change
  useEffect(() => {
    if (Object.keys(settings).length > 0) {
      generatePreview();
    }
  }, [settings]);

  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      // Generate preview based on current settings
      if (requestId) {
        // If we have a real request ID, we can generate a true preview
        const response = await fetch(`/api/requests/${requestId}/pdf?preview=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settings }),
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } else {
          throw new Error('Failed to generate PDF preview');
        }
      } else {
        // Use the canvas-based preview renderer for live preview without server calls
        setPreviewUrl(null);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: 'Preview Error',
        description: 'Failed to generate PDF preview. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefresh = () => {
    generatePreview();
    if (onRefresh) onRefresh();
  };

  const handleDownload = async () => {
    if (!requestId) {
      toast({
        title: 'Cannot Download',
        description: 'This is just a preview. Please save your settings first.',
        variant: 'default',
      });
      return;
    }

    try {
      const response = await fetch(`/api/requests/${requestId}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `request-${requestId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Download Error',
        description: 'Failed to download PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">PDF Preview</h3>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isGenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              disabled={!requestId}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <Tabs value={activePreview} onValueChange={(v) => setActivePreview(v as 'desktop' | 'mobile')}>
          <TabsList className="mb-4">
            <TabsTrigger value="desktop">Desktop</TabsTrigger>
            <TabsTrigger value="mobile">Mobile</TabsTrigger>
          </TabsList>
          
          <TabsContent value="desktop" className="border rounded-md p-2">
            {isLoading || isGenerating ? (
              <PreviewSkeleton />
            ) : (
              <div className="preview-container">
                {previewUrl ? (
                  <iframe 
                    src={previewUrl} 
                    className="w-full h-[600px] border rounded"
                    title="PDF Preview"
                  />
                ) : (
                  <CanvasPreview settings={settings} data={previewData} />
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="mobile" className="border rounded-md p-2">
            {isLoading || isGenerating ? (
              <PreviewSkeleton />
            ) : (
              <div className="preview-container max-w-[375px] mx-auto">
                {previewUrl ? (
                  <iframe 
                    src={previewUrl} 
                    className="w-full h-[600px] border rounded"
                    title="PDF Preview"
                  />
                ) : (
                  <CanvasPreview settings={settings} data={previewData} isMobile={true} />
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <p>This is a realtime preview. Changes to settings are reflected immediately. Some complex features may only appear in the final PDF.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="w-full h-16" />
      <Skeleton className="w-full h-32" />
      <Skeleton className="w-full h-64" />
      <Skeleton className="w-full h-32" />
    </div>
  );
}

interface CanvasPreviewProps {
  settings: Partial<PdfSettings>;
  data: any;
  isMobile?: boolean;
}

function CanvasPreview({ settings, data, isMobile = false }: CanvasPreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    renderPreview();
  }, [settings, data, isMobile]);
  
  const renderPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = isMobile ? 375 : 800;
    canvas.height = 900;
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Get settings with defaults for missing values
    const {
      headerTitle = 'Company Name',
      headerSubtitle = 'Purchase Request',
      headerColor = '#f3f4f6',
      footerText = '© Company Name. All rights reserved.',
      footerColor = '#f3f4f6',
      showLogo = true,
      logoPosition = 'left',
      useWatermark = false,
      watermarkText = 'CONFIDENTIAL',
      watermarkOpacity = 0.2,
      watermarkPosition = 'center',
      watermarkRotation = 45,
      fontSize = 12,
      showBasicInfo = true,
      showRequesterDetails = true,
      showApprovals = true,
      showItems = true,
    } = settings;
    
    // Helper function to convert hex to rgb
    const hexToRgb = (hex: string) => {
      // Remove # if present
      hex = hex.replace('#', '');
      
      // Parse hex values
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      return { r, g, b };
    };
    
    // Draw header
    const headerRgb = hexToRgb(headerColor);
    ctx.fillStyle = `rgba(${headerRgb.r}, ${headerRgb.g}, ${headerRgb.b}, 0.8)`;
    ctx.fillRect(0, 0, canvas.width, 80);
    
    // Draw logo if enabled
    if (showLogo) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      let logoX = 20;
      if (logoPosition === 'center') {
        logoX = canvas.width / 2 - 40;
      } else if (logoPosition === 'right') {
        logoX = canvas.width - 100;
      }
      ctx.fillText('LOGO', logoX, 40);
      ctx.strokeRect(logoX, 20, 80, 40);
    }
    
    // Draw header text
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px Arial';
    let headerX = 20;
    if (logoPosition === 'left' && showLogo) {
      headerX = 120;
    } else if (logoPosition === 'center' && showLogo) {
      headerX = 20;
    } else if (logoPosition === 'right' && showLogo) {
      headerX = 20;
    }
    ctx.fillText(headerTitle, headerX, 30);
    
    ctx.font = '16px Arial';
    ctx.fillText(headerSubtitle, headerX, 50);
    
    // Draw watermark if enabled
    if (useWatermark) {
      ctx.save();
      ctx.globalAlpha = watermarkOpacity;
      ctx.font = 'bold 36px Arial';
      ctx.fillStyle = '#999';
      
      if (watermarkPosition === 'center') {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((watermarkRotation * Math.PI) / 180);
        ctx.fillText(watermarkText, -ctx.measureText(watermarkText).width / 2, 0);
      } else if (watermarkPosition === 'tile') {
        // Draw tiled watermark
        for (let x = 0; x < canvas.width; x += 200) {
          for (let y = 100; y < canvas.height - 100; y += 200) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((watermarkRotation * Math.PI) / 180);
            ctx.fillText(watermarkText, -ctx.measureText(watermarkText).width / 2, 0);
            ctx.restore();
          }
        }
      } else if (watermarkPosition === 'corner') {
        // Draw in corners
        const cornerPositions = [
          [100, 200],
          [canvas.width - 100, 200],
          [100, canvas.height - 200],
          [canvas.width - 100, canvas.height - 200]
        ];
        
        for (const [x, y] of cornerPositions) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((watermarkRotation * Math.PI) / 180);
          ctx.fillText(watermarkText, -ctx.measureText(watermarkText).width / 2, 0);
          ctx.restore();
        }
      }
      
      if (watermarkPosition !== 'tile' && watermarkPosition !== 'corner') {
        ctx.restore();
      }
    }
    
    // Draw basic info section
    let yPos = 100;
    
    if (showBasicInfo) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Purchase Request Details', 20, yPos);
      
      yPos += 30;
      ctx.font = '14px Arial';
      ctx.fillText(`Request Number: ${data.requestNumber}`, 20, yPos);
      
      yPos += 25;
      ctx.fillText(`Title: ${data.title}`, 20, yPos);
      
      yPos += 25;
      ctx.fillText(`Status: ${data.status}`, 20, yPos);
      
      yPos += 25;
      ctx.fillText(`Date: ${new Date(data.createdAt).toLocaleDateString()}`, 20, yPos);
      
      yPos += 40;
    }
    
    // Draw requester details
    if (showRequesterDetails && data.requester) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Requester Information', 20, yPos);
      
      yPos += 30;
      ctx.font = '14px Arial';
      ctx.fillText(`Name: ${data.requester.name}`, 20, yPos);
      
      yPos += 25;
      ctx.fillText(`Department: ${data.requester.department}`, 20, yPos);
      
      yPos += 40;
    }
    
    // Draw items section
    if (showItems && data.items && data.items.length > 0) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Items', 20, yPos);
      
      yPos += 30;
      
      // Draw table header
      const colWidths = isMobile 
        ? [40, 150, 60, 80] 
        : [40, canvas.width - 280, 60, 80, 80];
      
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(20, yPos - 20, canvas.width - 40, 25);
      
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      
      let xPos = 20;
      ctx.fillText('#', xPos + 10, yPos);
      xPos += colWidths[0];
      
      ctx.fillText('Description', xPos, yPos);
      xPos += colWidths[1];
      
      ctx.fillText('Qty', xPos, yPos);
      xPos += colWidths[2];
      
      if (!isMobile) {
        ctx.fillText('Unit Price', xPos, yPos);
        xPos += colWidths[3];
      }
      
      ctx.fillText('Total', xPos, yPos);
      
      // Draw table rows
      yPos += 10;
      data.items.slice(0, 3).forEach((item: any, index: number) => {
        yPos += 25;
        
        ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        ctx.fillRect(20, yPos - 20, canvas.width - 40, 25);
        
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        
        xPos = 20;
        ctx.fillText((index + 1).toString(), xPos + 10, yPos);
        xPos += colWidths[0];
        
        // Truncate description if needed
        let description = item.name;
        if (description.length > (isMobile ? 15 : 40)) {
          description = description.substring(0, isMobile ? 15 : 40) + '...';
        }
        ctx.fillText(description, xPos, yPos);
        xPos += colWidths[1];
        
        ctx.fillText(item.quantity.toString(), xPos, yPos);
        xPos += colWidths[2];
        
        if (!isMobile) {
          ctx.fillText(`$${item.estimatedCost.toFixed(2)}`, xPos, yPos);
          xPos += colWidths[3];
        }
        
        ctx.fillText(`$${(item.quantity * item.estimatedCost).toFixed(2)}`, xPos, yPos);
      });
      
      yPos += 40;
    }
    
    // Draw approvals section
    if (showApprovals && data.approvals && data.approvals.length > 0) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Approval Flow', 20, yPos);
      
      yPos += 30;
      
      // Draw approvals
      data.approvals.forEach((approval: any, index: number) => {
        const color = approval.status === 'Approved' 
          ? '#10b981' 
          : approval.status === 'Rejected' 
            ? '#ef4444' 
            : '#f59e0b';
            
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(30, yPos - 5, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.fillText(`${approval.department}: ${approval.status}`, 50, yPos);
        
        if (approval.approver && approval.approver.name) {
          ctx.fillStyle = '#6b7280';
          ctx.font = '12px Arial';
          ctx.fillText(`(${approval.approver.name})`, 250, yPos);
        }
        
        yPos += 25;
      });
      
      yPos += 20;
    }
    
    // Draw footer
    const footerRgb = hexToRgb(footerColor);
    ctx.fillStyle = `rgba(${footerRgb.r}, ${footerRgb.g}, ${footerRgb.b}, 0.8)`;
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText(footerText, 20, canvas.height - 20);
    
    // Page number
    ctx.fillText('Page 1 of 1', canvas.width - 80, canvas.height - 20);
  };
  
  return (
    <div className="canvas-preview-container">
      <canvas 
        ref={canvasRef} 
        className="w-full border rounded shadow-sm"
      />
    </div>
  );
}