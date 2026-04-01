import path from "path";

export const getContentType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf": return "application/pdf";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".doc": return "application/msword";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default: return "application/octet-stream";
  }
};

export const getContentDisposition = (filename: string, forceDownload: boolean): string => {
  return forceDownload ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`;
};
