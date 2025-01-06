import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Loader2, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { File as FileType } from "@/types";
import FilePreviewCarousel from "./FilePreviewCarousel";

interface FilePreviewProps {
  file: FileType;
  showPreview?: boolean;
}

export function FilePreview({ file, showPreview = true }: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const { toast } = useToast();

  const handlePreview = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Validate file type and size
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (file.size > maxFileSize) {
        throw new Error("File is too large to preview (max 10MB)");
      }

      if (!allowedTypes.includes(file.type)) {
        throw new Error("File type not supported for preview");
      }

      // For images, show carousel
      if (file.type.startsWith('image/')) {
        if ('fileUrl' in file) {
          setShowCarousel(true);
        } else if (file instanceof Blob) {
          const url = URL.createObjectURL(file);
          setObjectUrl(url);
          setShowCarousel(true);
        }
      } else {
        // For non-image files
        let url: string;
        if ('fileUrl' in file) {
          url = (file as any).fileUrl;
        } else if (file instanceof Blob) {
          url = URL.createObjectURL(file);
        } else {
          throw new Error("Invalid file object");
        }
        setObjectUrl(url);
        setIsOpen(true);
      }
    } catch (err: any) {
      console.error("Preview generation error:", err);
      setError(err.message || "Failed to generate preview");
      toast({
        title: "Preview Error",
        description: err.message || "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (objectUrl && !('fileUrl' in file)) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl("");
    }
    setError("");
    setIsOpen(false);
    setShowCarousel(false);
  };

  const getFileIcon = () => {
    if (file.type.startsWith('image/')) {
      if ('fileUrl' in file) {
        return (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
            <img 
              src={(file as any).fileUrl} 
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

  const renderPreview = () => {
    if (error) {
      return (
        <div className="text-center p-8 bg-red-50 rounded-lg">
          <p className="text-red-500">{error}</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (file.type === 'application/pdf') {
      return (
        <iframe
          src={objectUrl}
          title={file.name}
          className="w-full h-[70vh] rounded-lg shadow-lg"
          onError={() => {
            setError("Failed to load PDF");
            toast({
              title: "Preview Error",
              description: "Failed to load PDF",
              variant: "destructive",
            });
          }}
        />
      );
    }

    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">Preview not available for this file type</p>
      </div>
    );
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
            disabled={isLoading}
            className="flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
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
            {renderPreview()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image carousel preview */}
      {showCarousel && (
        <FilePreviewCarousel
          files={[{
            fileName: file.name,
            fileType: file.type,
            fileUrl: 'fileUrl' in file ? (file as any).fileUrl : objectUrl,
          }]}
          onClose={handleClose}
        />
      )}
    </>
  );
}