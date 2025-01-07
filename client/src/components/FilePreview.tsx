import { useState, useEffect } from "react";
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState<'iframe' | 'object' | 'embed' | 'download'>('iframe');

  useEffect(() => {
    if (file.type === 'application/pdf' && file.fileUrl) {
      // Ensure we have an absolute URL
      const url = file.fileUrl.startsWith('http') 
        ? file.fileUrl 
        : `${window.location.origin}${file.fileUrl}`;
      setPdfUrl(url);

      // Validate PDF URL and structure
      fetch('/api/files/validate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to validate PDF');
        return res.json();
      })
      .then(data => {
        if (!data.isValid) {
          console.warn('PDF validation warnings:', data.suggestions);
          setPreviewError(data.suggestions[0]);
          // Try alternative preview method
          setFallbackMode('object');
        }
      })
      .catch(error => {
        console.error('PDF validation error:', error);
        handlePreviewError(error);
      });
    }
  }, [file]);

  const handlePreviewError = async (error: Error) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/files/analyze-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          fileType: file.type,
          preview: { url: pdfUrl, mode: fallbackMode }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze error: ${response.statusText}`);
      }

      const { analysis } = await response.json();
      console.error('Preview error analysis:', analysis);

      // Try next fallback mode
      const modes: ('iframe' | 'object' | 'embed' | 'download')[] = ['iframe', 'object', 'embed', 'download'];
      const currentIndex = modes.indexOf(fallbackMode);
      if (currentIndex < modes.length - 1) {
        const nextMode = modes[currentIndex + 1];
        setFallbackMode(nextMode);
        toast({
          title: 'Switching Preview Mode',
          description: `Trying alternative preview method (${nextMode})...`,
        });
      } else {
        setPreviewError('Unable to preview PDF. Please download or open in new tab.');
        toast({
          title: 'Preview Not Available',
          description: 'The PDF cannot be previewed directly. Please try downloading or opening in a new tab.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error analyzing preview error:', err);
      toast({
        title: 'Preview Error',
        description: 'Failed to analyze preview error. Please try downloading the file.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPDFPreview = () => {
    if (!pdfUrl) return null;

    const commonProps = {
      className: "w-full h-full border-0",
      style: { backgroundColor: 'white' },
      onError: (e: any) => handlePreviewError(new Error(e.message || 'PDF preview failed'))
    };

    switch (fallbackMode) {
      case 'iframe':
        return (
          <iframe
            {...commonProps}
            src={`${pdfUrl}#view=FitH&toolbar=0&navpanes=0`}
            title={file.name}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        );
      case 'object':
        return (
          <object
            {...commonProps}
            data={pdfUrl}
            type="application/pdf"
          >
            <p>Unable to display PDF. Try downloading instead.</p>
          </object>
        );
      case 'embed':
        return (
          <embed
            {...commonProps}
            src={pdfUrl}
            type="application/pdf"
          />
        );
      case 'download':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-4">
              Preview not available
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={handleDownload} variant="default">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        );
    }
  };

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
                {file.size && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6">
            {file.type === 'application/pdf' ? (
              <div className="w-full h-[600px] relative bg-white rounded-lg overflow-hidden shadow-lg">
                {previewError ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="w-16 h-16 text-red-400 mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-4">{previewError}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => window.open(pdfUrl!, '_blank', 'noopener,noreferrer')}>
                        Open in New Tab
                      </Button>
                      <Button onClick={handleDownload}>
                        Download
                      </Button>
                    </div>
                  </div>
                ) : (
                  renderPDFPreview()
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
                <FileText className="w-16 h-16 text-blue-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">{file.name}</p>
                {file.size && (
                  <p className="text-sm text-gray-500 mt-2">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
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
            )}
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
          onConversionComplete={onConvert}
        />
      )}
    </>
  );
}