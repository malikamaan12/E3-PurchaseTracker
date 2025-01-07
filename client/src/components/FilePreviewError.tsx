import { Button } from "@/components/ui/button";
import { AlertCircle, Download, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FilePreviewErrorProps {
  error: string;
  fileType: string;
  fileName: string;
  onRetry?: () => void;
  onDownload?: () => void;
}

export function FilePreviewError({
  error,
  fileType,
  fileName,
  onRetry,
  onDownload
}: FilePreviewErrorProps) {
  const getErrorGuidance = () => {
    if (fileType === 'application/pdf') {
      return "The PDF viewer might be blocked by your browser settings. Try downloading the file or check your browser settings.";
    }
    if (fileType.startsWith('image/')) {
      return "The image might be corrupted or in an unsupported format. Try downloading the file or converting it to a different format.";
    }
    return "The file preview is not available. You can download the file to view it locally.";
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Preview Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <div className="text-sm text-gray-600">
        <p className="font-medium mb-2">Troubleshooting guidance:</p>
        <p>{getErrorGuidance()}</p>
      </div>

      <div className="flex gap-3 mt-4">
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Retry Preview
          </Button>
        )}
        {onDownload && (
          <Button onClick={onDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download {fileName}
          </Button>
        )}
      </div>
    </div>
  );
}
