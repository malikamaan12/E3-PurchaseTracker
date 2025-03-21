/**
 * Unified PDF Routes
 * 
 * This file registers all PDF-related routes using the centralized PdfService.
 * It replaces the previous scattered PDF route implementations with a consistent approach.
 */

import { Express, Request, Response, NextFunction } from 'express';
import { pdfService } from '../services/PdfService';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { AppError, NotFoundError } from '../utils/errors';
import { z } from 'zod';

// Set up multer storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'pdf-images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Create upload middleware
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG and SVG files are allowed'));
    }
    cb(null, true);
  }
});

// Schemas for request validation
const pdfAuditSchema = z.object({
  requestId: z.number(),
  action: z.enum(['pdf_generated', 'pdf_downloaded', 'pdf_viewed', 'pdf_analyzed']),
  details: z.record(z.any()).optional(),
  type: z.enum(['user', 'approver', 'admin']).optional()
});

const pdfSettingsSchema = z.object({
  headerTitle: z.string().optional(),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().optional(),
  footerText: z.string().optional(),
  footerColor: z.string().optional(),
  pageNumbering: z.boolean().optional(),
  fontSize: z.number().optional(),
  marginTop: z.number().optional(),
  marginBottom: z.number().optional(),
  marginLeft: z.number().optional(),
  marginRight: z.number().optional(),
  headerHeight: z.number().optional(),
  footerHeight: z.number().optional(),
  watermarkOpacity: z.number().optional(),
  templateConfig: z.record(z.any()).optional()
});

const analyzeTemplateSchema = z.object({
  templateConfig: z.record(z.any()),
  requestId: z.number().optional()
});

/**
 * Register all PDF-related routes
 */
export function registerUnifiedPdfRoutes(app: Express) {
  // Get PDF settings
  app.get("/api/pdf/print-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await pdfService.getPdfSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // Get login logo
  app.get("/api/login-logo", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await pdfService.getPdfSettings();
      res.json({ loginLogo: settings.loginLogo });
    } catch (error) {
      next(error);
    }
  });

  // Save PDF settings
  app.post("/api/pdf/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsedData = pdfSettingsSchema.safeParse(req.body);
      if (!parsedData.success) {
        throw new AppError('Invalid PDF settings data', 400);
      }

      // Get user ID from session
      const userId = req.user ? (req.user as any).id : null;
      
      // Save settings
      const settings = await pdfService.savePdfSettings(req.body, userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // Upload PDF images
  app.post("/api/pdf/upload-images", upload.array("files", 5), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError('No files uploaded', 400);
      }

      // Get image type from request (header, footer, logo)
      const imageType = req.body.type || 'header';
      
      // Process uploaded images and update settings
      const userId = req.user ? (req.user as any).id : null;
      const result = await pdfService.processUploadedImages(files, imageType, userId);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Log PDF audit events
  app.post("/api/pdf/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsedData = pdfAuditSchema.safeParse(req.body);
      if (!parsedData.success) {
        throw new AppError('Invalid PDF audit data', 400);
      }

      // Get user ID from session
      const userId = req.user ? (req.user as any).id : null;
      
      // Log audit event
      const { requestId, action, details, type } = req.body;
      const auditResult = await pdfService.logPdfAudit(req, action, {
        resourceId: requestId,
        details,
        userType: type || 'user'
      });
      
      res.json(auditResult);
    } catch (error) {
      next(error);
    }
  });

  // Generate PDF for a purchase request
  app.get("/api/requests/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = parseInt(req.params.id, 10);
      if (isNaN(requestId)) {
        throw new AppError('Invalid request ID', 400);
      }

      // Check if it's a preview request
      const isPreview = req.query.preview === 'true';
      
      // Get request data with settings for PDF
      const result = await pdfService.getPurchaseRequestForPdf(requestId, isPreview);
      
      // Log viewing event if not a preview
      if (!isPreview) {
        await pdfService.logPdfAudit(req, 'pdf_viewed', {
          resourceId: requestId,
          details: { timestamp: new Date().toISOString() }
        });
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Generate ZIP file for a purchase request
  app.get("/api/requests/:id/zip", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = parseInt(req.params.id, 10);
      if (isNaN(requestId)) {
        throw new AppError('Invalid request ID', 400);
      }

      // Get include attachments parameter
      const includeAttachments = req.query.includeAttachments === 'true';
      
      // Generate ZIP file
      const result = await pdfService.generateRequestZip(requestId, includeAttachments);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      
      // Send file
      res.sendFile(result.filePath, {
        root: process.cwd(),
        dotfiles: 'deny'
      }, (err) => {
        if (err) {
          console.error('Error sending ZIP file:', err);
        }
        
        // Delete temporary file after sending
        if (fs.existsSync(result.filePath)) {
          fs.unlinkSync(result.filePath);
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Bulk export requests
  app.get("/api/requests/export/bulk", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse request IDs from query
      const ids = req.query.ids 
        ? Array.isArray(req.query.ids) 
          ? req.query.ids.map(id => parseInt(id as string, 10)) 
          : [parseInt(req.query.ids as string, 10)]
        : [];
      
      if (ids.length === 0 || ids.some(id => isNaN(id))) {
        throw new AppError('Invalid request IDs', 400);
      }

      // Get include attachments parameter
      const includeAttachments = req.query.includeAttachments === 'true';
      
      // Generate bulk export ZIP
      const result = await pdfService.generateBulkExport(ids, includeAttachments);
      
      // Return download link
      res.json({
        downloadUrl: `/download/${result.fileName}`,
        fileName: result.fileName
      });
    } catch (error) {
      next(error);
    }
  });

  // Analyze PDF template
  app.post("/api/pdf/analyze-template", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsedData = analyzeTemplateSchema.safeParse(req.body);
      if (!parsedData.success) {
        throw new AppError('Invalid template configuration', 400);
      }
      
      // Analyze template with AI
      const { templateConfig, requestId } = req.body;
      const result = await pdfService.analyzePdfTemplateIssue(templateConfig, requestId);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Analyze PDF images
  app.post("/api/pdf/analyze-images", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { images, logoSize, headerSize, footerSize } = req.body;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        throw new AppError('Invalid image data', 400);
      }
      
      // Analyze images for PDF compatibility
      const result = await pdfService.analyzeImages(images, {
        logoSize,
        headerSize,
        footerSize
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}