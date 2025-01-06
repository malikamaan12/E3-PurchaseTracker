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

export interface FileWithPreview extends File {
  preview?: string;
}

export interface PreviewableFile {
  name: string;
  size: number;
  type: string;
  fileUrl?: string;
  lastModified?: number;
  webkitRelativePath?: string;
  slice?: (start?: number, end?: number, contentType?: string) => Blob;
  stream?: () => ReadableStream;
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}