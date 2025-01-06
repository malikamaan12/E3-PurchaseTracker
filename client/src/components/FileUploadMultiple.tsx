import { useState, useCallback } from "react";
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
}

export function FileUploadMultiple({
  onUploadComplete,
  maxFiles = 5,
  maxSizeInMB = 10
}: FileUploadMultipleProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    // Check number of files
    if (selectedFiles.length + files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can only upload up to ${maxFiles} files at a time`,
        variant: "destructive"
      });
      return;
    }

    // Check file sizes
    const oversizedFiles = selectedFiles.filter(
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

    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
  }, [files, maxFiles, maxSizeInMB, toast]);

  const removeFile = useCallback((index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = async () => {
    if (files.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Failed to upload files");
      }

      const uploadedFiles: UploadedFile[] = await response.json();
      onUploadComplete(uploadedFiles);
      setFiles([]);
      toast({
        title: "Success",
        description: "Files uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
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
          disabled={files.length === 0 || uploading}
          className="min-w-[100px]"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="ml-2">Upload</span>
        </Button>
      </div>

      {files.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file, index) => (
            <div key={index} className="relative group">
              <FilePreview file={file} />
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
