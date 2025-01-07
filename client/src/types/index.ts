export interface File extends Blob {
  readonly lastModified: number;
  readonly name: string;
  readonly webkitRelativePath: string;
}

export interface UploadedFile {
  id?: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
}

export interface AttachmentFile extends UploadedFile {
  uploadedAt: string;
  requestId?: number;
}

export interface FileWithPreview {
  file: File;
  preview?: string;
}

export interface PreviewableFile {
  name: string;
  size: number;
  type: string;
  preview?: string;
  fileUrl: string; 
  lastModified?: number;
  webkitRelativePath?: string;
}

// Add conversion-related types
export interface ConversionFormat {
  mimeType: string;
  extension: string;
  label: string;
}

export interface ConversionResult {
  success: boolean;
  fileUrl: string;
  outputType: string;
  size: number;
  error?: string;
}