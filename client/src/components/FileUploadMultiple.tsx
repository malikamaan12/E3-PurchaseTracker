import React, { useCallback, useEffect, useState, ReactNode } from 'react';
import { useToast } from '../hooks/use-toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Upload, Loader2, FileIcon, Eye, Download, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileWithPreview, UploadedFile, PreviewableFile } from '../types';

export interface FileUploadMultipleProps {
  onFilesSelected: (files: File[]) => void;
  onUploadComplete?: (files: UploadedFile[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeBytes?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  previewFile?: UploadedFile | null;
  className?: string;
  children?: ReactNode;
}

export function FileUploadMultiple({
  onFilesSelected,
  onUploadComplete,
  accept = "image/*,.pdf,.doc,.docx",
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB default
  isUploading = false,
  uploadProgress = 0,
  previewFile = null,
  className,
  children
}: FileUploadMultipleProps) {
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  
  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  // Triggered when files are dropped
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      // Validation
      if (files.length > maxFiles) {
        toast({
          title: "Too many files",
          description: `You can only upload up to ${maxFiles} files at a time`,
          variant: "destructive"
        });
        return;
      }
      
      for (const file of files) {
        if (file.size > maxSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the maximum size limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
            variant: "destructive"
          });
          return;
        }
      }
      
      onFilesSelected(files);
    }
  }, [maxFiles, maxSizeBytes, onFilesSelected, toast]);
  
  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      // Validation
      if (files.length > maxFiles) {
        toast({
          title: "Too many files",
          description: `You can only upload up to ${maxFiles} files at a time`,
          variant: "destructive"
        });
        return;
      }
      
      for (const file of files) {
        if (file.size > maxSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the maximum size limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
            variant: "destructive"
          });
          return;
        }
      }
      
      onFilesSelected(files);
    }
  }, [maxFiles, maxSizeBytes, onFilesSelected, toast]);
  
  return (
    <div 
      className={cn(
        "relative border rounded-md transition-colors",
        dragActive ? "border-primary border-dashed bg-primary/5" : "border-input",
        className
      )}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <Input
        type="file"
        multiple={maxFiles > 1}
        accept={accept}
        onChange={handleFileChange}
        className="absolute inset-0 cursor-pointer opacity-0 w-full h-full"
        disabled={isUploading}
      />
      
      <div className="p-4 flex flex-col items-center justify-center">
        {children ? (
          children
        ) : (
          <>
            <div className="rounded-full bg-primary/10 p-3 mb-2">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">Drag & drop or click to upload</p>
            <p className="text-xs text-muted-foreground">
              Accepted files: {accept.split(',').join(', ')}
            </p>
            {maxFiles > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Up to {maxFiles} files, max {Math.round(maxSizeBytes / (1024 * 1024))}MB each
              </p>
            )}
          </>
        )}
      </div>
      
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm">Uploading...</p>
            {uploadProgress > 0 && (
              <div className="w-48 mt-2 bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}