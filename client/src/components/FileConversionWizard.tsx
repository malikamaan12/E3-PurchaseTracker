import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileType } from "lucide-react";
import type { PreviewableFile, ConversionResult } from "@/types";

interface FileConversionWizardProps {
  file: PreviewableFile;
  onClose: () => void;
  onConversionComplete?: (convertedFile: PreviewableFile) => void;
}

export function FileConversionWizard({
  file,
  onClose,
  onConversionComplete
}: FileConversionWizardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [targetFormat, setTargetFormat] = useState<string>('');
  const [availableFormats, setAvailableFormats] = useState<string[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  // Fetch available formats when component mounts
  React.useEffect(() => {
    async function fetchFormats() {
      try {
        const response = await fetch(`/api/conversion/formats?type=${encodeURIComponent(file.type)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch available formats');
        }
        const formats = await response.json();
        setAvailableFormats(formats);
      } catch (error) {
        console.error('Error fetching formats:', error);
        toast({
          title: 'Error',
          description: 'Failed to load available conversion formats',
          variant: 'destructive',
        });
      }
    }
    fetchFormats();
  }, [file.type, toast]);

  const handleConvert = async () => {
    if (!targetFormat) {
      toast({
        title: 'Error',
        description: 'Please select a target format',
        variant: 'destructive',
      });
      return;
    }

    setIsConverting(true);
    try {
      const formData = new FormData();
      formData.append('sourceFormat', file.type);
      formData.append('targetFormat', targetFormat);
      formData.append('filePath', file.fileUrl);

      const response = await fetch('/api/conversion/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceFormat: file.type,
          targetFormat,
          filePath: file.fileUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Conversion failed');
      }

      const result = await response.json() as ConversionResult;

      if (result.success) {
        toast({
          title: 'Success',
          description: 'File converted successfully',
        });

        if (onConversionComplete) {
          onConversionComplete({
            name: `${file.name.split('.')[0]}_converted${getExtensionForType(targetFormat)}`,
            type: targetFormat,
            size: result.size,
            fileUrl: result.fileUrl,
          });
        }

        handleClose();
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        title: 'Conversion Failed',
        description: error instanceof Error ? error.message : 'Failed to convert file',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const getExtensionForType = (mimeType: string): string => {
    const extensions: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    return extensions[mimeType] || '';
  };

  const formatLabel = (mimeType: string): string => {
    const labels: Record<string, string> = {
      'image/png': 'PNG Image',
      'image/jpeg': 'JPEG Image',
      'image/webp': 'WebP Image',
      'application/pdf': 'PDF Document',
      'application/msword': 'Word Document (DOC)',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (DOCX)',
    };
    return labels[mimeType] || mimeType;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convert File</DialogTitle>
          <DialogDescription>
            Select the desired format to convert "{file.name}" to:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <FileType className="h-8 w-8 text-gray-400" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {formatLabel(file.type)} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          <Select
            value={targetFormat}
            onValueChange={setTargetFormat}
            disabled={isConverting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select target format" />
            </SelectTrigger>
            <SelectContent>
              {availableFormats.map((format) => (
                <SelectItem key={format} value={format}>
                  {formatLabel(format)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isConverting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={!targetFormat || isConverting}
            >
              {isConverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}