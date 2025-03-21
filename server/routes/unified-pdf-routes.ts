/**
 * Unified PDF Routes
 * 
 * This file registers all PDF-related routes using the centralized PdfService.
 * It replaces the previous scattered PDF route implementations with a consistent approach.
 */

import { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pdfService } from '../services/PdfService';
import { ValidationError } from '../utils/errors';

// Setup multer storage for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Register all PDF-related routes
 */
export function registerUnifiedPdfRoutes(app: Express) {
  // Get PDF print settings
  app.get("/api/pdf/print-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await pdfService.getPdfSettings();
      return res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // Get login logo
  app.get("/api/login-logo", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await pdfService.getPdfSettings();
      return res.json({ loginLogo: settings.loginLogo });
    } catch (error) {
      next(error);
    }
  });

  // Save PDF settings
  app.post("/api/pdf/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || null;
      const settings = await pdfService.savePdfSettings(req.body, userId);
      return res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // Upload PDF images (header, footer, logo)
  app.post("/api/pdf/upload-images", upload.array("files", 5), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new ValidationError("No files were uploaded");
      }

      const type = req.body.type || 'header';
      const userId = req.user?.id || null;
      const result = await pdfService.processUploadedImages(
        files,
        type as 'header' | 'footer' | 'logo' | 'loginLogo',
        userId
      );

      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Log PDF audit events
  app.post("/api/pdf/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId, action, details, type } = req.body;
      
      if (!requestId || !action) {
        throw new ValidationError("Request ID and action are required");
      }

      // Validate resource ID using improved validation
      const result = await pdfService.logPdfAudit(
        req,
        action,
        { 
          requestId: parseInt(requestId), 
          userType: type || 'user',
          ...details 
        }
      );

      return res.json({ success: true, result });
    } catch (error) {
      // Don't throw here, just return an error response
      return res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Generate and download PDF for a request
  app.get("/api/requests/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = parseInt(req.params.id);
      
      if (isNaN(requestId)) {
        throw new ValidationError("Invalid request ID");
      }

      const isPreview = req.query.preview === 'true';
      const download = req.query.download === 'true';

      const response = await pdfService.getPurchaseRequestForPdf(requestId, isPreview);
      const pdf = response.data;
      const fileName = `request-${requestId}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName || `request-${requestId}.pdf`}"`);
      }

      return res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  // Generate and download ZIP for a request
  app.get("/api/requests/:id/zip", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = parseInt(req.params.id);
      
      if (isNaN(requestId)) {
        throw new ValidationError("Invalid request ID");
      }

      const includeAttachments = req.query.includeAttachments !== 'false';
      
      const result = await pdfService.generateRequestZip(requestId, includeAttachments);
      // Read file from disk and convert to buffer
      const zipBuffer = fs.readFileSync(result.filePath);
      const fileName = result.fileName;
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName || `request-${requestId}.zip`}"`);
      
      return res.send(zipBuffer);
    } catch (error) {
      next(error);
    }
  });

  // Generate bulk export ZIP
  app.get("/api/requests/export/bulk", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestIds = req.query.ids 
        ? Array.isArray(req.query.ids) 
          ? req.query.ids.map(id => parseInt(id as string)).filter(id => !isNaN(id))
          : [parseInt(req.query.ids as string)].filter(id => !isNaN(id))
        : [];
      
      if (requestIds.length === 0) {
        throw new ValidationError("No valid request IDs provided");
      }

      const includeAttachments = req.query.includeAttachments !== 'false';
      
      const result = await pdfService.generateBulkExport(requestIds, includeAttachments);
      // Read file from disk and convert to buffer
      const zipBuffer = fs.readFileSync(result.filePath);
      const fileName = result.fileName;
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'bulk-export.zip'}"`);
      
      return res.send(zipBuffer);
    } catch (error) {
      next(error);
    }
  });

  // Analyze PDF template issues
  app.post("/api/pdf/analyze-template", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateConfig, requestId } = req.body;
      
      if (!templateConfig) {
        throw new ValidationError("Template configuration is required");
      }

      const analysis = await pdfService.analyzePdfTemplateIssue(
        templateConfig,
        requestId ? parseInt(requestId) : undefined
      );

      return res.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  // Analyze images for PDF compatibility
  app.post("/api/pdf/analyze-images", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { images, logoSize, headerSize, footerSize } = req.body;
      
      if (!images || !Array.isArray(images)) {
        throw new ValidationError("Images array is required");
      }

      const options = {
        logoSize,
        headerSize,
        footerSize
      };

      const analysis = await pdfService.analyzeImages(images, options);

      return res.json(analysis);
    } catch (error) {
      next(error);
    }
  });
}