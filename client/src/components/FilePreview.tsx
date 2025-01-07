import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Loader2, FileText, Image as ImageIcon, File, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PreviewableFile } from "@/types";
import FilePreviewCarousel from "./FilePreviewCarousel";
import { FileConversionWizard } from "./FileConversionWizard";
import { FileType } from "lucide-react";

interface FilePreviewProps {
  file: PreviewableFile;
  showPreview?: boolean;
  showConvert?: boolean;
  onDownload?: () => void;
  onConvert?: (convertedFile: PreviewableFile) => void;
}

export function FilePreview({ 
  file, 
  showPreview = true, 
  showConvert = true,
  onDownload,
  onConvert 
}: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showConvertWizard, setShowConvertWizard] = useState(false);

  const handlePreview = async () => {
    try {
      setIsLoading(true);

      if (!file.preview && !file.fileUrl) {
        throw new Error("No preview available for this file");
      }

      if (file.type.startsWith('image/')) {
        setShowCarousel(true);
        return;
      }

      setIsOpen(true);
    } catch (err: any) {
      console.error("Preview error:", err);
      toast({
        title: "Preview Error",
        description: err.message || "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      setIsLoading(true);
      if (!file.fileUrl) {
        throw new Error("File URL not available");
      }

      const absoluteUrl = file.fileUrl.startsWith('http') 
        ? file.fileUrl 
        : `${window.location.origin}${file.fileUrl}`;

      console.log('Downloading from URL:', absoluteUrl);

      const response = await fetch(absoluteUrl, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': file.type || '*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobWithType = new Blob([blob], { type: file.type || 'application/octet-stream' });

      const url = window.URL.createObjectURL(blobWithType);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "File downloaded successfully",
      });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({
        title: "Download Failed",
        description: err.message || "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowCarousel(false);
    setShowConvertWizard(false);
  };

  const getFileIcon = () => {
    if (file.type?.startsWith('image/')) {
      if (file.preview || file.fileUrl) {
        const imageUrl = file.preview || file.fileUrl;
        return (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50">
            <img 
              src={imageUrl}
              alt={file.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Image load error:', e);
                e.currentTarget.src = '';
                e.currentTarget.classList.add('bg-gray-100');
              }}
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
    if (!file.fileUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900">Preview not available</p>
        </div>
      );
    }

    const absoluteUrl = file.fileUrl.startsWith('http') 
      ? file.fileUrl 
      : `${window.location.origin}${file.fileUrl}`;

    console.log('Preview URL:', absoluteUrl);
    console.log('File type:', file.type);

    if (file.type === 'application/pdf') {
      return (
        <div className="w-full h-[600px] relative bg-white rounded-lg overflow-hidden shadow-lg">
          <div className="absolute inset-0">
            <iframe
              src={`${absoluteUrl}#view=FitH&toolbar=0&navpanes=0`}
              className="w-full h-full border-0"
              title={file.name}
              onError={(e) => {
                console.error('PDF preview error:', e);
                toast({
                  title: "Preview Error",
                  description: "Failed to load PDF preview. You can download the file instead.",
                  variant: "destructive",
                });
              }}
              style={{ backgroundColor: 'white' }}
            />
          </div>
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button 
              onClick={() => window.open(absoluteUrl, '_blank')}
              variant="secondary"
            >
              <Eye className="w-4 h-4 mr-2" />
              Open PDF
            </Button>
            <Button onClick={handleDownload} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
        <FileText className="w-16 h-16 text-blue-400 mb-4" />
        <p className="text-lg font-medium text-gray-900">{file.name}</p>
        <p className="text-sm text-gray-500 mt-2">
          {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
        </p>
        <Button 
          variant="outline"
          onClick={handleDownload}
          className="mt-4"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download Document
        </Button>
      </div>
    );
  };

  const handleConversionComplete = (convertedFile: PreviewableFile) => {
    if (onConvert) {
      onConvert(convertedFile);
    }
  };

  return (
    <>
      <div 
        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors cursor-pointer group"
        onClick={showPreview ? handlePreview : undefined}
      >
        {getFileIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">
            {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          {showConvert && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowConvertWizard(true);
              }}
              className="flex-shrink-0"
              disabled={isLoading}
            >
              <FileType className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="flex-shrink-0"
            disabled={isLoading}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
      {showConvertWizard && (
        <FileConversionWizard
          file={file}
          onClose={() => setShowConvertWizard(false)}
          onConversionComplete={handleConversionComplete}
        />
      )}
    </>
  );
}