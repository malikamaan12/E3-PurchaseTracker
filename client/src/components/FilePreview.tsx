import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Loader2, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { PreviewableFile } from "@/types";
import FilePreviewCarousel from "./FilePreviewCarousel";

interface FilePreviewProps {
  file: PreviewableFile;
  showPreview?: boolean;
}

export function FilePreview({ file, showPreview = true }: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const { toast } = useToast();

  const handlePreview = async () => {
    try {
      if (!file.preview && !file.fileUrl) {
        throw new Error("No preview available for this file");
      }

      // For images and PDFs, show carousel
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        setShowCarousel(true);
        return;
      }

      // For other files
      setIsOpen(true);
    } catch (err: any) {
      console.error("Preview error:", err);
      toast({
        title: "Preview Error",
        description: err.message || "Failed to generate preview",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowCarousel(false);
  };

  const getFileIcon = () => {
    if (file.type?.startsWith('image/')) {
      if (file.preview || file.fileUrl) {
        return (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
            <img 
              src={file.preview || file.fileUrl} 
              alt={file.name}
              className="w-full h-full object-cover"
            />
          </div>
        );
      }
      return <ImageIcon className="w-12 h-12 text-gray-400" />;
    } else if (file.type === 'application/pdf') {
      return <FileText className="w-12 h-12 text-red-400" />;
    } else if (
      file.type === 'application/msword' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return <FileText className="w-12 h-12 text-blue-400" />;
    }
    return <File className="w-12 h-12 text-gray-400" />;
  };

  return (
    <>
      <div 
        className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors cursor-pointer"
        onClick={showPreview ? handlePreview : undefined}
      >
        {getFileIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        {showPreview && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handlePreview();
            }}
            className="flex-shrink-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Regular file preview dialog */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon()}
              <div>
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-6 relative bg-white rounded-lg overflow-hidden">
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600">Preview not available for this file type</p>
              <p className="text-xs text-gray-500 mt-2">{file.type}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image/PDF carousel preview */}
      {showCarousel && (
        <FilePreviewCarousel
          files={[{
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: file.fileUrl || file.preview || '',
          }]}
          onClose={handleClose}
        />
      )}
    </>
  );
}