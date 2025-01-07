import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppError } from './errors';
import type { Request } from 'express';

// Configure multer for file uploads
export const createStorage = (uploadDir: string) => {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
  });
};

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/i;

  // Check file type
  if (!file.originalname.match(allowedTypes)) {
    return cb(new AppError('Only image files (jpg, jpeg, png, gif) and documents (pdf, doc, docx) are allowed!', 400, 'warning'));
  }

  // Check file size before upload
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (parseInt((_req.headers['content-length'] || '0')) > maxSize) {
    return cb(new AppError('File size exceeds 5MB limit!', 400, 'warning'));
  }

  cb(null, true);
};

// Create multer instances for different upload types
export const logoUpload = multer({
  storage: createStorage('uploads/logos'),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one logo at a time
  }
}).single('logo');

export const attachmentUpload = multer({
  storage: createStorage('uploads/attachments'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files at a time
  }
}).array('attachments', 5);

// Error handling middleware for file uploads
export const handleUploadError = (err: any, _req: Request, next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('File size limit exceeded', 400, 'warning'));
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      next(new AppError('Too many files', 400, 'warning'));
    } else {
      next(new AppError(`File upload error: ${err.message}`, 400, 'error'));
    }
  } else if (err) {
    next(err);
  } else {
    next();
  }
};