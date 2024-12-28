import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppError } from './errors';

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

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif/i;
  if (!file.originalname.match(allowedTypes)) {
    return cb(new AppError('Only image files (jpg, jpeg, png, gif) are allowed!', 400, 'warning'));
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
