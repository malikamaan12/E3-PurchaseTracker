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