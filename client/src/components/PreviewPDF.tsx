import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ZoomIn, ZoomOut, Move } from "lucide-react";
import { CompanyBranding } from "@db/schema";

interface PreviewPDFProps {
  branding?: CompanyBranding;
  formData: any;
  onPositionChange?: (type: 'header' | 'footer', position: { x: number, y: number }) => void;
}

export default function PreviewPDF({ branding, formData, onPositionChange }: PreviewPDFProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<'header' | 'footer' | null>(null);
  const [headerPosition, setHeaderPosition] = useState({ x: 0, y: 0 });
  const [footerPosition, setFooterPosition] = useState({ x: 0, y: 0 });

  // A4 dimensions in pixels at 72 DPI
  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw page border
    ctx.strokeStyle = '#ccc';
    ctx.strokeRect(0, 0, PAGE_WIDTH * zoom, PAGE_HEIGHT * zoom);

    // Draw header image if available
    if (branding?.headerImage) {
      const headerImg = new Image();
      headerImg.onload = () => {
        ctx.drawImage(
          headerImg,
          headerPosition.x * zoom,
          headerPosition.y * zoom,
          PAGE_WIDTH * zoom,
          (PAGE_HEIGHT * 0.15) * zoom
        );
      };
      headerImg.src = `data:${branding.headerImageMimeType};base64,${branding.headerImage}`;
    }

    // Draw footer image if available
    if (branding?.footerImage) {
      const footerImg = new Image();
      footerImg.onload = () => {
        ctx.drawImage(
          footerImg,
          footerPosition.x * zoom,
          (PAGE_HEIGHT - PAGE_HEIGHT * 0.1) * zoom + footerPosition.y * zoom,
          PAGE_WIDTH * zoom,
          (PAGE_HEIGHT * 0.1) * zoom
        );
      };
      footerImg.src = `data:${branding.footerImageMimeType};base64,${branding.footerImage}`;
    }

    // Draw sample content
    ctx.fillStyle = '#333';
    ctx.font = `${12 * zoom}px Arial`;
    ctx.fillText('Request Details', 20 * zoom, 120 * zoom);

    // Draw table headers
    const tableY = 150 * zoom;
    ctx.beginPath();
    ctx.moveTo(20 * zoom, tableY);
    ctx.lineTo((PAGE_WIDTH - 20) * zoom, tableY);
    ctx.stroke();

  }, [zoom, headerPosition, footerPosition, branding]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if clicking on header or footer
    if (y <= PAGE_HEIGHT * 0.15) {
      setDragTarget('header');
      setIsDragging(true);
    } else if (y >= PAGE_HEIGHT * 0.9) {
      setDragTarget('footer');
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragTarget) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (dragTarget === 'header') {
      setHeaderPosition({ x, y });
      onPositionChange?.('header', { x, y });
    } else {
      setFooterPosition({ x, y });
      onPositionChange?.('footer', { x, y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragTarget(null);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between mb-4">
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Move className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Drag header and footer images to adjust position
            </span>
          </div>
        </div>

        <div className="overflow-auto border rounded-lg">
          <canvas
            ref={canvasRef}
            width={PAGE_WIDTH * zoom}
            height={PAGE_HEIGHT * zoom}
            className="cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </CardContent>
    </Card>
  );
}
