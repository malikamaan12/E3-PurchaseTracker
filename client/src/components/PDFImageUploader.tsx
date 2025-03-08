import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Upload, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import axios from "axios";

interface PDFImageUploaderProps {
  type: 'header' | 'footer' | 'logo';
  onUploadComplete: (imageUrl: string) => void;
  currentImage?: string | null;
  maxSizeInMB?: number;
}

export function PDFImageUploader({
  type,
  onUploadComplete,
  currentImage = null,
  maxSizeInMB = 5
}: PDFImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage);
  const { toast } = useToast();

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      
      // Validate file type
      if (!file.type.includes('image/jpeg') && !file.type.includes('image/png')) {
        toast({
          title: "Invalid file type",
          description: "Please upload JPG or PNG images only",
          variant: "destructive"
        });
        return;
      }
      
      // Validate file size
      if (file.size > maxSizeInMB * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `The file exceeds the ${maxSizeInMB}MB limit`,
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      
      // Clean up previous preview if it exists
      return () => URL.revokeObjectURL(previewUrl);
    }
  }, [maxSizeInMB, toast]);

  // Upload the file
  const uploadFile = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('files', selectedFile);
      formData.append('type', type);
      
      const response = await axios.post('/api/pdf/upload-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.fileUrl) {
        onUploadComplete(response.data.fileUrl);
        
        toast({
          title: "Success",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} image uploaded successfully`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    if (preview && preview !== currentImage) {
      URL.revokeObjectURL(preview);
    }
    setSelectedFile(null);
    setPreview(null);
    onUploadComplete('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          type="file"
          onChange={handleFileSelect}
          accept="image/jpeg,image/png"
          className="flex-1"
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={uploadFile}
          disabled={!selectedFile || uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {preview && (
        <div className="relative border rounded-md overflow-hidden">
          <img
            src={preview}
            alt={`${type} preview`}
            className="max-h-32 w-auto object-contain mx-auto"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-80 hover:opacity-100"
            onClick={removeImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}