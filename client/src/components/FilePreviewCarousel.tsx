import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCw, ZoomIn, ZoomOut, X, Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { UploadedFile } from "@/types";

interface FilePreviewCarouselProps {
  files: UploadedFile[];
  onClose: () => void;
  startIndex?: number;
}

export default function FilePreviewCarousel({ files, onClose, startIndex = 0 }: FilePreviewCarouselProps) {
  const [rotation, setRotation] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleDownload = async (file: UploadedFile) => {
    try {
      // Ensure the URL is absolute
      const absoluteUrl = file.fileUrl.startsWith('http') 
        ? file.fileUrl 
        : `${window.location.origin}${file.fileUrl}`;

      console.log('Downloading file:', { name: file.fileName, url: absoluteUrl });

      const response = await fetch(absoluteUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('File content type:', contentType);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      setPreviewError("Failed to download file. Please try again.");
    }
  };

  const renderContent = (file: UploadedFile) => {
    if (previewError) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] bg-gray-50">
          <FileText className="w-20 h-20 text-red-400 mb-4" />
          <p className="text-lg font-medium text-red-600">{previewError}</p>
          <Button variant="outline" onClick={() => setPreviewError(null)} className="mt-4">
            Try Again
          </Button>
        </div>
      );
    }

    // Ensure the URL is absolute
    const absoluteUrl = file.fileUrl.startsWith('http') 
      ? file.fileUrl 
      : `${window.location.origin}${file.fileUrl}`;

    console.log('Rendering preview for:', { type: file.fileType, url: absoluteUrl });

    if (file.fileType.startsWith('image/')) {
      return (
        <div className="transform-wrapper">
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
                      src={absoluteUrl}
                      alt={file.fileName}
                      onError={(e) => {
                        console.error('Image load error:', e);
                        setPreviewError("Failed to load image. Please try again.");
                      }}
                      style={{
                        maxHeight: rotation % 180 === 0 ? '60vh' : '80vh',
                        maxWidth: rotation % 180 === 0 ? '100%' : '80vh',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      );
    }

    if (file.fileType === 'application/pdf') {
      return (
        <object
          data={absoluteUrl}
          type="application/pdf"
          className="w-full h-[60vh]"
          onError={() => setPreviewError("Failed to load PDF. Please try downloading instead.")}
        >
          <div className="flex flex-col items-center justify-center h-[60vh] bg-gray-50">
            <FileText className="w-20 h-20 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900">Unable to preview PDF</p>
            <Button variant="outline" onClick={() => handleDownload(file)} className="mt-4">
              Download Instead
            </Button>
          </div>
        </object>
      );
    }

    // Fallback for other file types
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-gray-50">
        <FileText className="w-20 h-20 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-900">{file.fileName}</p>
        <p className="text-sm text-gray-500 mt-2">
          {file.fileSize ? `${Math.round(file.fileSize / 1024)} KB` : ''}
        </p>
      </div>
    );
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  if (files.length === 0) return null;

  const currentFile = files[currentIndex];
  const isImage = currentFile.fileType.startsWith('image/');

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
    setRotation(0); // Reset rotation when changing files
    setPreviewError(null); // Clear any previous errors
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));
    setRotation(0); // Reset rotation when changing files
    setPreviewError(null); // Clear any previous errors
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl w-full h-[80vh] p-0">
        <div className="relative h-full flex flex-col bg-black/95">
          {/* Controls */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            {isImage && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleRotate}
                className="bg-white/90 hover:bg-white"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleDownload(currentFile)}
              className="bg-white/90 hover:bg-white"
            >
              <Download className="h-4 w-4" />
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

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4">
            {renderContent(currentFile)}
          </div>

          {/* Navigation Controls */}
          {files.length > 1 && (
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                className="bg-white/90 hover:bg-white"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                className="bg-white/90 hover:bg-white"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* File Info */}
          <div className="absolute bottom-4 left-4 z-50 bg-white/90 p-2 rounded-lg">
            <p className="text-sm font-medium text-gray-900">
              {currentFile.fileName}
              {currentFile.fileSize && (
                <span className="ml-2 text-gray-500">
                  ({Math.round(currentFile.fileSize / 1024)} KB)
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {currentIndex + 1} of {files.length}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}