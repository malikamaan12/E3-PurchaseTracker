import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Loader2, FileText, Image as ImageIcon, File, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PreviewableFile } from "@/types";
import FilePreviewCarousel from "./FilePreviewCarousel";
import { FileConversionWizard } from "./FileConversionWizard";
import { FileType } from "lucide-react";
import { FilePreviewError } from "./FilePreviewError";

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
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handlePreview = async () => {
    try {
      setIsLoading(true);
      setPreviewError(null);

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
      setPreviewError(err.message || "Failed to generate preview");
      toast({
        title: "Preview Error",
        description: err.message || "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (retryCount >= 3) {
      toast({
        title: "Too many retry attempts",
        description: "Please try downloading the file instead",
        variant: "destructive",
      });
      return;
    }
    setRetryCount(prev => prev + 1);
    setPreviewError(null);
    await handlePreview();
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

      let downloadUrl = file.fileUrl;
      // If it's a file ID, use the attachments endpoint
      if (file.id) {
        downloadUrl = `/api/attachments/${file.id}`;
      }

      // Add force download parameter for document types
      const shouldForceDownload = file.type === 'application/pdf' ||
                                  file.type === 'application/msword' ||
                                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (shouldForceDownload) {
        downloadUrl += '?download=true';
      }

      // Construct the absolute URL
      const absoluteUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : `${window.location.origin}${downloadUrl}`;

      const response = await fetch(absoluteUrl, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Get the blob with the correct type
      const blob = await response.blob();
      const blobWithType = new Blob([blob], { type: file.type || 'application/octet-stream' });

      // Create a download link
      const url = window.URL.createObjectURL(blobWithType);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();

      // Clean up
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

  const renderPreview = () => {
    if (!file.fileUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900">Preview not available</p>
        </div>
      );
    }

    let previewUrl = file.fileUrl;
    // If it's a file ID, use the attachments endpoint
    if (file.id) {
      previewUrl = `/api/attachments/${file.id}`;
    }

    const absoluteUrl = previewUrl.startsWith('http')
      ? previewUrl
      : `${window.location.origin}${previewUrl}`;

    if (previewError) {
      return (
        <FilePreviewError
          error={previewError}
          fileType={file.type}
          fileName={file.name}
          onRetry={retryCount < 3 ? handleRetry : undefined}
          onDownload={handleDownload}
        />
      );
    }

    if (file.type === 'application/pdf') {
      return (
        <div className="w-[595px] h-[842px] relative rounded-lg overflow-hidden shadow-lg bg-white"> {/* A4 dimensions in pixels */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-white border-b z-10">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
              <h2 className="text-lg font-semibold text-gray-700">PURCHASE REQUEST</h2>
            </div>
          </div>
          <div className="mt-16 h-[calc(100%-88px)]"> {/* Adjusted for header and footer height */}
            <iframe
              src={`${absoluteUrl}#toolbar=0&navpanes=0&view=FitH`}
              className="w-full h-full border-0"
              title={file.name}
              onError={() => {
                const error = "Failed to load PDF preview. The file might be corrupted or your browser settings might be blocking the preview.";
                setPreviewError(error);
                toast({
                  title: "Preview Error",
                  description: error,
                  variant: "destructive",
                });
              }}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t z-10 flex justify-between items-center">
            <p className="text-sm text-gray-600">ALL RIGHTS RESERVED BY E3</p>
            <Button onClick={handleDownload} variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      );
    }

    if (file.type.startsWith('image/')) {
      return (
        <div className="relative">
          <img
            src={absoluteUrl}
            alt={file.name}
            className="max-w-full h-auto rounded-lg"
            onError={() => {
              const error = "Failed to load image preview. The image might be corrupted or in an unsupported format.";
              setPreviewError(error);
              toast({
                title: "Preview Error",
                description: error,
                variant: "destructive",
              });
            }}
          />
        </div>
      );
    }

    // For other document types (Word, etc.)
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

  const handleClose = () => {
    setIsOpen(false);
    setShowCarousel(false);
    setShowConvertWizard(false);
    setPreviewError(null);
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
                  ({file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''})
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