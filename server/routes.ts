import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { companyBranding } from "@db/schema";
import { eq } from "drizzle-orm";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError, handleError } from './utils/errors';
import { createNotification, cleanupUploads } from './utils/notifications';

// Configure multer for file uploads
const createStorage = (uploadDir: string) => {
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

const logoUpload = multer({
  storage: createStorage('uploads/logos'),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one logo at a time
  }
}).single('logo');

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Add request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // Basic health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Company branding routes with proper error handling
  app.post("/api/company/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      if (req.user!.role !== "admin") {
        throw new AppError('Only admin can update company branding', 403, 'error');
      }

      await new Promise<void>((resolve, reject) => {
        logoUpload(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const file = req.file;
      if (!file) {
        throw new AppError('No logo file provided', 400, 'warning');
      }

      // Delete existing branding record if it exists
      await db.delete(companyBranding);

      const [branding] = await db.insert(companyBranding)
        .values({
          companyName: req.body.companyName,
          primaryColor: req.body.primaryColor || '#191160',
          secondaryColor: req.body.secondaryColor || '#35bbba',
          accentColor: req.body.accentColor || '#7156a2',
          logoUrl: file.path,
          headerStyle: req.body.headerStyle || 'modern',
          footerText: req.body.footerText || '',
        })
        .returning();

      res.json(branding);
    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error(`Failed to delete uploaded file ${req.file.path}:`, e);
        }
      }
      next(error);
    }
  });

  // Error handling middleware - Must be after all routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    const error = handleError(err);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({
      status: 'error',
      message,
      severity: error.severity,
      code: error.code,
      details: error.details,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // Add 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ 
      status: 'error',
      message: `Cannot ${req.method} ${req.path}`,
      severity: 'warning',
      code: 'NOT_FOUND'
    });
  });

  return httpServer;
}