import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { File } from "@/types";

interface FilePreviewProps {
  file: File;
}

export function FilePreview({ file }: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handlePreview = () => {
    try {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setIsOpen(true);
      setError("");
    } catch (err) {
      setError("Failed to generate preview");
      console.error("Preview generation error:", err);
    }
  };

  const handleClose = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl("");
    }
    setIsOpen(false);
  };

  const renderPreview = () => {
    if (error) {
      return <div className="text-center p-8 text-red-500">{error}</div>;
    }

    if (file.type.startsWith('image/')) {
      return (
        <img 
          src={objectUrl} 
          alt={file.name} 
          className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
          onError={() => setError("Failed to load image")}
        />
      );
    } 

    if (file.type === 'application/pdf') {
      return (
        <iframe
          src={objectUrl}
          title={file.name}
          className="w-full h-[70vh] rounded-lg shadow-lg"
          onError={() => setError("Failed to load PDF")}
        />
      );
    } 

    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">Preview not available for this file type.</p>
        <Button 
          variant="outline" 
          className="mt-4 border-[#7058a3] text-[#7058a3] hover:bg-[#7058a3]/10"
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
        className="text-[#7058a3] hover:text-[#7058a3]/80 hover:bg-[#7058a3]/10 transition-colors"
        title="Preview file"
      >
        <Eye className="h-4 w-4" />
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