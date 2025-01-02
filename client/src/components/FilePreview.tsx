import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilePreviewProps {
  file: File;
}

export function FilePreview({ file }: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string>("");

  const handlePreview = () => {
    // Create object URL for preview
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setIsOpen(true);
  };

  const handleClose = () => {
    // Clean up object URL
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl("");
    }
    setIsOpen(false);
  };

  const renderPreview = () => {
    if (file.type.startsWith('image/')) {
      return (
        <img 
          src={objectUrl} 
          alt={file.name} 
          className="max-w-full max-h-[70vh] object-contain"
        />
      );
    } else if (file.type === 'application/pdf') {
      return (
        <iframe
          src={objectUrl}
          title={file.name}
          className="w-full h-[70vh]"
        />
      );
    } else {
      return (
        <div className="text-center p-8">
          <p>Preview not available for this file type.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.open(objectUrl, '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Download to View
          </Button>
        </div>
      );
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handlePreview}
        className="text-[#7058a3] hover:text-[#7058a3]/80 hover:bg-[#7058a3]/10"
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-[#7058a3]">{file.name}</span>
              <span className="text-sm text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {renderPreview()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
