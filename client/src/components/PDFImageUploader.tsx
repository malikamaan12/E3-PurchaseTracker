import React, { useState, useRef } from 'react';
import { useToast } from '../hooks/use-toast';
import { 
  Card, 
  CardContent,
} from './ui/card';
import { Button } from './ui/button';
import { FileUploadMultiple } from './FileUploadMultiple';
import { 
  Upload, 
  X, 
  Image as ImageIcon,
  RefreshCw,
  Trash,
} from 'lucide-react';
import axios from 'axios';

export interface PDFImageUploaderProps {
  type: 'header' | 'footer' | 'logo';
  currentImage: string | null;
  onUploadComplete: (fileUrl: string) => void;
  maxSizeInMB?: number;
}

export function PDFImageUploader({ 
  type, 
  currentImage, 
  onUploadComplete,
  maxSizeInMB = 5
}: PDFImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Convert MB to bytes for validation
  const maxSize = maxSizeInMB * 1024 * 1024;

  const handleFileChange = async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0]; // Take only the first file
    
    // Validate file type
    if (!file.type.includes('image/jpeg') && !file.type.includes('image/png')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload JPG or PNG images only',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate file size
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Please upload images smaller than ${maxSizeInMB}MB`,
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('files', file); // Backend expects 'files' as the field name
      formData.append('type', type);
      
      // Use the correct endpoint from our backend
      const response = await axios.post('/api/pdf/upload-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true, // Important for auth sessions
      });
      
      if (response.data && response.data.fileUrl) {
        onUploadComplete(response.data.fileUrl);
        toast({
          title: 'Upload successful',
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} image uploaded successfully`,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      // Update settings in the database to remove the image reference
      const updateData: Record<string, any> = {};
      
      if (type === 'header') updateData.headerImage = null;
      if (type === 'footer') updateData.footerImage = null;
      if (type === 'logo') updateData.logo = null;
      
      // Save the updated settings to the database
      await axios.post('/api/pdf/settings', updateData, {
        withCredentials: true,
      });
      
      // Clear the image locally
      onUploadComplete('');
      
      toast({
        title: 'Image removed',
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} image has been removed`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to remove image:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-2">
      {currentImage ? (
        <div className="relative border rounded-lg overflow-hidden">
          <img 
            src={currentImage} 
            alt={`${type} image`} 
            className="w-full h-auto max-h-36 object-contain"
          />
          <div className="absolute top-2 right-2 flex space-x-1">
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleRemoveImage}
              className="h-8 w-8"
            >
              <Trash className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full p-6 border-dashed border-2 rounded-lg flex flex-col items-center justify-center text-center relative">
          <FileUploadMultiple
            onFilesSelected={handleFileChange}
            accept=".jpg,.jpeg,.png"
            maxFiles={1}
            maxSizeBytes={maxSize}
            isUploading={isUploading}
            className="absolute inset-0"
          />
          <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="rounded-full bg-primary/10 p-2">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              JPG or PNG up to {maxSizeInMB}MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}