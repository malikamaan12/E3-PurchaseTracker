import { useState, useCallback, useEffect } from "react";
import { FilePreview } from "@/components/FilePreview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Upload } from "lucide-react";
import type { UploadedFile } from "@/types";

interface FileUploadMultipleProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  uploadedFiles?: UploadedFile[];
}

export function FileUploadMultiple({
  onUploadComplete,
  maxFiles = 5,
  maxSizeInMB = 10,
  uploadedFiles = []
}: FileUploadMultipleProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  // Clean up any object URLs when component unmounts
  useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        if ('preview' in file && (file as any).preview) {
          URL.revokeObjectURL((file as any).preview);
        }
      });
    };
  }, [selectedFiles]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);

    // Check total number of files
    if (newFiles.length + selectedFiles.length + uploadedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can only upload up to ${maxFiles} files at a time`,
        variant: "destructive"
      });
      return;
    }

    // Check file sizes
    const oversizedFiles = newFiles.filter(
      file => file.size > maxSizeInMB * 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      toast({
        title: "Files too large",
        description: `Some files exceed the ${maxSizeInMB}MB limit`,
        variant: "destructive"
      });
      return;
    }

    // Create preview URLs for selected files
    const filesWithPreviews = newFiles.map(file => {
      if (file.type.startsWith('image/')) {
        return Object.assign(file, {
          preview: URL.createObjectURL(file)
        });
      }
      return file;
    });

    setSelectedFiles(prev => [...prev, ...filesWithPreviews]);
  }, [selectedFiles, uploadedFiles.length, maxFiles, maxSizeInMB, toast]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const file = prev[index];
      if ('preview' in file && (file as any).preview) {
        URL.revokeObjectURL((file as any).preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      selectedFiles.forEach(file => formData.append("files", file));

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text() || "Failed to upload files");
      }

      const newUploadedFiles: UploadedFile[] = await response.json();

      // Clean up any preview URLs
      selectedFiles.forEach(file => {
        if ('preview' in file && (file as any).preview) {
          URL.revokeObjectURL((file as any).preview);
        }
      });

      setSelectedFiles([]);
      onUploadComplete(newUploadedFiles);

      toast({
        title: "Success",
        description: `${newUploadedFiles.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Input
          type="file"
          multiple
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx"
          className="flex-1"
          disabled={uploading}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={uploadFiles}
          disabled={selectedFiles.length === 0 || uploading}
          className="min-w-[100px] bg-[#7156a2] hover:bg-[#7156a2]/90 text-white"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="ml-2">Upload</span>
        </Button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <FilePreview 
                file={file}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFile(index)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {uploadedFiles.map((file) => (
            <div key={file.fileUrl} className="relative">
              <FilePreview 
                file={{
                  name: file.fileName,
                  size: file.fileSize,
                  type: file.fileType,
                  fileUrl: file.fileUrl,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}