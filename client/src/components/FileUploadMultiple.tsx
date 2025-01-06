import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Upload, Eye } from "lucide-react";
import { FilePreview } from "@/components/FilePreview";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import type { UploadedFile, FileWithPreview } from "@/types";

interface FileUploadMultipleProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  uploadedFiles?: UploadedFile[];
  onRemoveFile?: (file: UploadedFile) => void;
}

export function FileUploadMultiple({
  onUploadComplete,
  maxFiles = 5,
  maxSizeInMB = 10,
  uploadedFiles = [],
  onRemoveFile
}: FileUploadMultipleProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const { toast } = useToast();

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      selectedFiles.forEach(fileObj => {
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview);
        }
      });
    };
  }, [selectedFiles]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length + selectedFiles.length + uploadedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can only upload up to ${maxFiles} files at a time`,
        variant: "destructive"
      });
      return;
    }

    const oversizedFiles = files.filter(
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

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const invalidTypeFiles = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidTypeFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload only images, PDFs, or Word documents",
        variant: "destructive"
      });
      return;
    }

    const filesWithPreviews: FileWithPreview[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setSelectedFiles(prev => [...prev, ...filesWithPreviews]);
  }, [selectedFiles, uploadedFiles.length, maxFiles, maxSizeInMB, toast]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      const removed = newFiles[index];
      if (removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      selectedFiles.forEach(fileObj => formData.append("files", fileObj.file));

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text() || "Failed to upload files");
      }

      const newUploadedFiles: UploadedFile[] = await response.json();

      // Clean up preview URLs
      selectedFiles.forEach(fileObj => {
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview);
        }
      });

      setSelectedFiles([]);
      onUploadComplete(newUploadedFiles);

      toast({
        title: "Success",
        description: `${newUploadedFiles.length} file(s) uploaded successfully`,
        variant: "success"
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

  const handlePreview = (file: UploadedFile) => {
    setPreviewFile(file);
  };

  const handleRemoveUploadedFile = (file: UploadedFile) => {
    if (onRemoveFile) {
      onRemoveFile(file);
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
          className="min-w-[100px] bg-primary hover:bg-primary/90 text-white"
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
          {selectedFiles.map((fileObj, index) => (
            <div key={index} className="relative group">
              <FilePreview 
                file={{
                  name: fileObj.file.name,
                  size: fileObj.file.size,
                  type: fileObj.file.type,
                  preview: fileObj.preview,
                }}
                showPreview={true}
              />
              <div className="absolute -top-2 -right-2 flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {uploadedFiles.map((file) => (
            <div key={file.fileUrl} className="relative group">
              <FilePreview 
                file={{
                  name: file.fileName,
                  size: file.fileSize,
                  type: file.fileType,
                  fileUrl: file.fileUrl,
                }}
                showPreview={true}
              />
              {onRemoveFile && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveUploadedFile(file)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handlePreview(file)}
              >
                <Eye className="h-4 w-4" />
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

      {previewFile && (
        <FilePreviewDialog
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}