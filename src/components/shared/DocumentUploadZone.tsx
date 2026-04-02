"use client";

import { useState, useCallback } from "react";
import { 
  Upload, 
  File, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface UploadedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  id?: number;
}

interface DocumentUploadZoneProps {
  onUploadComplete: (files: UploadedFile[]) => void;
}

export default function DocumentUploadZone({ onUploadComplete }: DocumentUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: FileList | File[]) => {
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append("files", file);
    });

    try {
      // Direct fetch for multipart/form-data as apiClient.request handles JSON by default
      const res = await fetch("/api/backend/attachments", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const results = await res.json();
      const newFiles = [...uploadedFiles, ...results];
      setUploadedFiles(newFiles);
      onUploadComplete(newFiles);
      toast.success(`${results.length} files uploaded successfully`);
    } catch (error: any) {
      toast.error("File upload failed: " + error.message);
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  }, [uploadedFiles]);

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUploadComplete(newFiles);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-primary" />
          Supporting Documents
        </h3>
        <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mt-1">Quotes, Specs, or PDF Reports</p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 flex flex-col items-center justify-center text-center group ${
          isDragging ? "border-brand-primary bg-brand-primary/5 scale-[0.99]" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]"
        }`}
      >
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className={`w-16 h-16 rounded-2xl mb-4 flex items-center justify-center transition-all duration-500 ${
          isDragging ? "bg-brand-primary text-white rotate-12" : "bg-white/5 text-zinc-600 group-hover:scale-110 group-hover:text-zinc-400"
        }`}>
          {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-white">
            {isUploading ? "Uploading files..." : "Click or drag files here to upload"}
          </p>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Max 10MB per file (PDF, JPG, PNG)</p>
        </div>
      </div>

      {/* File List */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {uploadedFiles.map((file, i) => (
              <motion.div
                key={i}
                layout
                className="glass p-3 rounded-xl border border-white/5 flex items-center gap-3 group relative"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <p className="text-xs font-bold text-white truncate">{file.fileName}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-700 hover:text-rose-500 hover:bg-rose-500/5 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
