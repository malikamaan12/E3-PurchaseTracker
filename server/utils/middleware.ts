import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppError } from './errors';
import type { Request, Response, NextFunction } from 'express';
import { isR2Configured } from '../services/R2StorageService';

/**
 * Require a valid authenticated session.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return next(new AppError("Not authenticated", 401));
  }
  if (!req.user.isActive) {
    return next(new AppError("Account is deactivated. Contact admin.", 403));
  }
  next();
};

/**
 * Require the user to have one of the specified roles.
 * Usage: requireRole('admin') or requireRole('admin', 'manager')
 */
export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return next(new AppError("Not authenticated", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403));
    }
    next();
  };

/**
 * Require admin role OR membership in an approver department.
 * Approver status is determined dynamically during login and stored in the session.
 */
export const requireApproverOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return next(new AppError("Not authenticated", 401));
  }
  
  const isAdmin = req.user.role === 'admin';
  const isApprover = (req.user as any).isApprover === true;

  if (!isAdmin && !isApprover) {
    return next(new AppError("Approval authority required", 403));
  }
  next();
};

// Configure multer for file uploads
export const createStorage = (uploadDir: string) => {
  if (isR2Configured) {
    return multer.memoryStorage();
  }
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}-${encodeURIComponent(file.originalname)}`);
    }
  });
};

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/i;
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // Check file extension
  if (!file.originalname.match(allowedTypes)) {
    return cb(new AppError('Only image files (jpg, jpeg, png, gif) and documents (pdf, doc, docx) are allowed!', 400, 'warning'));
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new AppError(`Invalid file type: ${file.mimetype}. Only images and documents are allowed.`, 400, 'warning'));
  }

  // Check file size before upload
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (parseInt((_req.headers['content-length'] || '0')) > maxSize) {
    return cb(new AppError('File size exceeds 10MB limit!', 400, 'warning'));
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

// Helper function to get correct content type for document downloads
export const getContentType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  };
  return contentTypes[ext] || 'application/octet-stream';
};

// Helper function to determine content disposition
export const getContentDisposition = (filename: string, forceDownload: boolean = false): string => {
  const encodedFilename = encodeURIComponent(filename);
  const disposition = forceDownload ? 'attachment' : 'inline';
  return `${disposition}; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`;
};