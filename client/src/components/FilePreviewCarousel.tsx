import { useState } from "react";
import ImageGallery from "react-image-gallery";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RotateCw, ZoomIn, ZoomOut, X } from "lucide-react";
import "react-image-gallery/styles/css/image-gallery.css";

interface FilePreviewCarouselProps {
  files: Array<{
    id: number;
    fileName: string;
    fileType: string;
    fileUrl: string;
  }>;
  onClose: () => void;
}

export default function FilePreviewCarousel({ files, onClose }: FilePreviewCarouselProps) {
  const [rotation, setRotation] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const images = files
    .filter(file => file.fileType.startsWith('image/'))
    .map(file => ({
      original: `/api/attachments/${file.id}`,
      thumbnail: `/api/attachments/${file.id}?thumbnail=true`,
      description: file.fileName,
    }));

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl w-full h-[80vh] p-0">
        <div className="relative h-full flex flex-col">
          {/* Controls */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
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

          {/* Main Preview */}
          <div className="flex-1 bg-black/95">
            <TransformWrapper>
              {({ zoomIn, zoomOut }) => (
                <>
                  <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => zoomIn()}
                      className="bg-white/90 hover:bg-white"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => zoomOut()}
                      className="bg-white/90 hover:bg-white"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </div>
                  <TransformComponent>
                    <ImageGallery
                      items={images}
                      showPlayButton={false}
                      showFullscreenButton={false}
                      showNav={true}
                      thumbnailPosition="bottom"
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
                          />
                        </div>
                      )}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>

          {/* File Info */}
          <div className="absolute bottom-20 left-4 z-50 bg-white/90 p-2 rounded-lg">
            <p className="text-sm font-medium">
              {files[currentIndex]?.fileName}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
