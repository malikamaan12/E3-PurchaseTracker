import { useState, useCallback } from "react";
import type { ReactImageGalleryProps } from "react-image-gallery";
import ImageGallery from "react-image-gallery";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RotateCw, ZoomIn, ZoomOut, X, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { debugFilePreview } from "@/lib/debugUtils";

interface FilePreviewCarouselProps {
  files: Array<{
    id?: number;
    fileName?: string;
    fileType?: string;
    fileUrl?: string;
    preview?: string;
    file?: File;
  }>;
  onClose: () => void;
  onBack?: () => void;
}

export default function FilePreviewCarousel({ files, onClose, onBack }: FilePreviewCarouselProps) {
  const { toast } = useToast();
  const [rotation, setRotation] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomHandlers, setZoomHandlers] = useState<{
    zoomIn?: () => void;
    zoomOut?: () => void;
  }>({});

  // Filter and map only image files
  const images = files
    .filter(file => {
      const fileType = file.fileType || file.file?.type;
      return fileType?.startsWith('image/');
    })
    .map(file => ({
      original: file.fileUrl || file.preview || '',
      thumbnail: file.fileUrl || file.preview || '',
      description: file.fileName || file.file?.name || '',
    }));

  const handleError = async (error: any) => {
    const analysis = await debugFilePreview(files, error);
    toast({
      title: "Preview Error",
      description: analysis,
      variant: "destructive",
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const setZoomFunctions = useCallback(({ zoomIn, zoomOut }: { 
    zoomIn: () => void; 
    zoomOut: () => void; 
  }) => {
    setZoomHandlers({ zoomIn, zoomOut });
  }, []);

  if (images.length === 0) {
    return (
      <DialogContent className="max-w-4xl w-full p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                className="back-button"
              >
                <ChevronLeft className="back-button-icon" />
              </Button>
            )}
            <h2 className="text-lg font-semibold text-brand-primary">File Preview</h2>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            className="bg-white/90 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            This file type cannot be previewed.
          </p>
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-6xl w-full h-[80vh] p-0 bg-[#7058a3]/5">
      <div className="relative h-full flex flex-col">
        {/* Header Controls */}
        <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                className="back-button"
              >
                <ChevronLeft className="back-button-icon" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => zoomHandlers.zoomIn?.()}
              className="bg-white/90 hover:bg-white"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => zoomHandlers.zoomOut?.()}
              className="bg-white/90 hover:bg-white"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRotate}
              className="bg-white/90 hover:bg-white"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="bg-white/90 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Preview */}
        <div className="flex-1 bg-black/95">
          <TransformWrapper>
            {({ zoomIn, zoomOut }) => {
              // Update zoom handlers whenever they change
              setZoomFunctions({ zoomIn, zoomOut });

              return (
                <TransformComponent>
                  <ImageGallery
                    items={images}
                    showPlayButton={false}
                    showFullscreenButton={false}
                    showNav={true}
                    thumbnailPosition="bottom"
                    onImageError={handleError}
                    onSlide={(currentIndex) => {
                      setCurrentIndex(currentIndex);
                      setRotation(0); // Reset rotation when changing images
                    }}
                    renderItem={(item) => (
                      <div
                        style={{
                          transform: `rotate(${rotation}deg)`,
                          transition: 'transform 0.3s ease',
                          maxHeight: '60vh',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={item.original}
                          alt={item.description}
                          style={{
                            maxHeight: rotation % 180 === 0 ? '60vh' : '80vh',
                            maxWidth: rotation % 180 === 0 ? '100%' : '80vh',
                            objectFit: 'contain',
                          }}
                          onError={(e) => handleError(e)}
                        />
                      </div>
                    )}
                  />
                </TransformComponent>
              );
            }}
          </TransformWrapper>
        </div>

        {/* File Info */}
        <div className="absolute bottom-20 left-4 z-50 bg-white/90 p-2 rounded-lg border border-[#3eb6ba]/20">
          <p className="text-sm font-medium text-[#7058a3]">
            {files[currentIndex]?.fileName || files[currentIndex]?.file?.name}
          </p>
        </div>
      </div>
    </DialogContent>
  );
}