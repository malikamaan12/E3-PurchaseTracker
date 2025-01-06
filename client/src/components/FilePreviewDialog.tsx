import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Download, FileText } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { UploadedFile } from "@/types";

interface FilePreviewDialogProps {
  file: UploadedFile;
  onClose: () => void;
}

export function FilePreviewDialog({ file, onClose }: FilePreviewDialogProps) {
  const [rotation, setRotation] = useState(0);
  const isImage = file.fileType.startsWith('image/');
  const isPDF = file.fileType === 'application/pdf';

  const handleRotate = (direction: 'left' | 'right') => {
    setRotation(prev => {
      const newRotation = direction === 'left' ? prev - 90 : prev + 90;
      return ((newRotation % 360) + 360) % 360;
    });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(file.fileUrl);
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
      console.error('Error downloading file:', error);
    }
  };

  const renderContent = () => {
    if (isImage) {
      return (
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRotate('left')}
                  className="bg-white/90 hover:bg-white"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRotate('right')}
                  className="bg-white/90 hover:bg-white"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
              <TransformComponent>
                <div
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                  className="flex items-center justify-center"
                >
                  <img
                    src={file.fileUrl}
                    alt={file.fileName}
                    className="max-h-[70vh] w-auto object-contain"
                  />
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      );
    }

    if (isPDF) {
      return (
        <div className="w-full h-[70vh] bg-white rounded-lg overflow-hidden">
          <embed
            src={`${file.fileUrl}#toolbar=0&navpanes=0`}
            type="application/pdf"
            width="100%"
            height="100%"
            className="w-full h-full"
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="w-20 h-20 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">{file.fileName}</p>
        <p className="text-sm text-gray-500 mb-4">
          {file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
        </p>
        <Button onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{file.fileName}</span>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogTitle>
          <DialogDescription>
            Preview of {file.fileName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 relative overflow-hidden bg-gray-50 rounded-lg">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}