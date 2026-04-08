"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Upload,
  FileText,
  X,
  Loader2,
  Eye,
  Download,
  File,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface UploadedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  id?: number;
}

interface DocumentUploadZoneProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  initialFiles?: UploadedFile[];
}

function FilePreviewModal({
  files,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  files: UploadedFile[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const file = files[currentIndex];
  const isImage = file.fileType.startsWith("image/");
  const isPdf = file.fileType === "application/pdf";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden z-[201]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {isImage ? (
                <ImageIcon className="w-4 h-4 text-primary" />
              ) : (
                <FileText className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{file.fileName}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {(file.fileSize / 1024 / 1024).toFixed(2)} MB · {files.length > 1 ? `${currentIndex + 1} of ${files.length}` : "Preview"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={file.fileUrl}
              download={file.fileName}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-auto min-h-0 bg-secondary/10 flex items-center justify-center relative">
          {isImage ? (
            <img
              src={file.fileUrl}
              alt={file.fileName}
              className="max-w-full max-h-full object-contain p-4"
            />
          ) : isPdf ? (
            <iframe
              src={file.fileUrl}
              className="w-full h-full min-h-[500px]"
              title={file.fileName}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center px-8">
              <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center border border-border">
                <File className="w-10 h-10 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{file.fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">Preview not available for this file type</p>
              </div>
              <a
                href={file.fileUrl}
                download={file.fileName}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download File
              </a>
            </div>
          )}

          {/* Prev / Next arrows */}
          {files.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-card/90 border border-border text-muted-foreground hover:text-foreground hover:bg-card shadow-lg transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-card/90 border border-border text-muted-foreground hover:text-foreground hover:bg-card shadow-lg transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function DocumentUploadZone({ onUploadComplete, initialFiles }: DocumentUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(initialFiles || []);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Sync initialFiles to state if they change
  useEffect(() => {
    if (initialFiles) {
      setUploadedFiles(initialFiles);
    }
  }, [initialFiles]);

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
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const results = await res.json();
      const newFiles = [...uploadedFiles, ...results];
      setUploadedFiles(newFiles);
      onUploadComplete(newFiles);
      toast.success(`${results.length} file${results.length > 1 ? "s" : ""} uploaded`);
    } catch (error: any) {
      toast.error("File upload failed: " + error.message);
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) processFiles(files);
    },
    [uploadedFiles]
  );

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUploadComplete(newFiles);
    if (previewIndex === index) setPreviewIndex(null);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (fileType === "application/pdf") return <FileText className="w-4 h-4 text-rose-500" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Supporting Documents
          </h3>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
            Quotes · Specs · Reports
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center group ${
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border bg-secondary/20 hover:border-primary/50 hover:bg-secondary/30"
          }`}
        >
          <input
            type="file"
            multiple
            onChange={(e) => e.target.files && processFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div
            className={`w-14 h-14 rounded-2xl mb-3 flex items-center justify-center transition-all duration-500 ${
              isDragging
                ? "bg-primary text-primary-foreground rotate-12"
                : "bg-secondary text-muted-foreground group-hover:scale-110 group-hover:text-foreground"
            }`}
          >
            {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
          </div>

          <p className="text-sm font-bold text-foreground">
            {isUploading ? "Uploading..." : "Click or drag files here"}
          </p>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
            PDF · JPG · PNG · DOCX · max 10 MB
          </p>
        </div>

        {/* Uploaded File List */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest pl-1">
                {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""} attached
              </p>
              {uploadedFiles.map((file, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl group hover:border-primary/20 transition-all"
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    {getFileIcon(file.fileType)}
                  </div>

                  {/* Name + size */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{file.fileName}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(i)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={file.fileUrl}
                      download={file.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                      title="Download"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewIndex !== null && (
          <FilePreviewModal
            files={uploadedFiles}
            currentIndex={previewIndex}
            onClose={() => setPreviewIndex(null)}
            onPrev={() => setPreviewIndex((p) => (p! > 0 ? p! - 1 : uploadedFiles.length - 1))}
            onNext={() => setPreviewIndex((p) => (p! < uploadedFiles.length - 1 ? p! + 1 : 0))}
          />
        )}
      </AnimatePresence>
    </>
  );
}
