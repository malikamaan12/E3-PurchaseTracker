import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { File } from "@/types";

interface FilePreviewProps {
  file: File;
}

export function FilePreview({ file }: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
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

      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setIsOpen(true);
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
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl("");
    }
    setError("");
    setIsOpen(false);
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
          <Loader2 className="h-8 w-8 animate-spin text-[#7058a3]" />
        </div>
      );
    }

    if (file.type.startsWith('image/')) {
      return (
        <img 
          src={objectUrl} 
          alt={file.name} 
          className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
          onError={() => {
            setError("Failed to load image");
            toast({
              title: "Preview Error",
              description: "Failed to load image",
              variant: "destructive",
            });
          }}
        />
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
        <p className="text-gray-600 mb-4">Preview not available for this file type.</p>
        <Button 
          variant="outline" 
          className="mt-4 border-[#7058a3] text-[#7058a3] hover:bg-[#7058a3]/10 transition-colors"
          onClick={() => window.open(objectUrl, '_blank')}
        >
          Download to View
        </Button>
      </div>
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handlePreview}
        disabled={isLoading}
        className="text-[#7058a3] hover:text-[#7058a3]/80 hover:bg-[#7058a3]/10 transition-colors relative interactive-bounce"
        title="Preview file"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl w-[90vw] p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#7058a3]">
              <span className="font-medium">{file.name}</span>
              <span className="text-sm text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 relative bg-white rounded-lg overflow-hidden">
            {renderPreview()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}