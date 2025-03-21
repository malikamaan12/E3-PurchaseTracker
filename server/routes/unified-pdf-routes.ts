/**
 * Unified PDF Routes
 * 
 * This file registers all PDF-related routes using the centralized PdfService.
 * It replaces the previous scattered PDF route implementations with a consistent approach.
 */

import { Request, Response, NextFunction, Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { pdfService } from '../services/PdfService';
import { AppError, AuthorizationError, ValidationError } from '../utils/errors';
import { analyzeError } from '../utils/error-analysis';
import JSZip from 'jszip';
import { anthropicClient, MODEL } from '../utils/anthropic-config';

/**
 * Register all PDF-related routes
 */
export function registerUnifiedPdfRoutes(app: Express) {
  // Get PDF settings endpoint
  app.get("/api/pdf/print-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      const settings = await pdfService.getPdfSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });
  
  // Login logo endpoint (public)
  app.get("/api/login-logo", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await pdfService.getPdfSettings();
      return res.json({ 
        loginLogo: settings.loginLogo || null 
      });
    } catch (error) {
      console.error('Error fetching login logo:', error);
      next(error);
    }
  });
  
  // Save PDF settings endpoint
  app.post("/api/pdf/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      if (req.user?.role !== 'admin') {
        return next(new AuthorizationError('Only administrators can modify PDF settings'));
      }
      
      const result = await pdfService.savePdfSettings(req.body, req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  
  // Image upload endpoint
  app.post("/api/pdf/upload-images", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      if (req.user?.role !== 'admin') {
        return next(new AuthorizationError('Only administrators can upload branding images'));
      }
      
      // Set up the upload using disk storage
      const storage = multer.diskStorage({
        destination: async (_, __, cb) => {
          // Ensure the logos directory exists
          const uploadDir = path.join(process.cwd(), 'uploads/logos');
          try {
            await fs.mkdir(uploadDir, { recursive: true });
          } catch (err) {
            // Directory might already exist, which is fine
            console.log("Directory creation status:", err);
          }
          cb(null, uploadDir);
        },
        filename: (_, file, cb) => {
          // Generate unique filename with field name, timestamp and random number
          const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
          const extension = path.extname(file.originalname) || '.jpg';
          cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
        }
      });
      
      // Create the multer middleware for this specific route
      const upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
        fileFilter: (_, file, cb) => {
          const allowedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png'
          ];
          if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'));
          }
        }
      });
      
      // Handle the file upload - supporting both single file and array format
      upload.any()(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return next(new AppError('File size limit exceeded (5MB maximum)', 400));
            } else {
              return next(new AppError(`File upload error: ${err.message}`, 400));
            }
          }
          return next(err);
        }
        
        try {
          const files = req.files as Express.Multer.File[];
          
          if (!files || files.length === 0) {
            return next(new AppError('No file uploaded', 400));
          }
          
          // Get the image type from the request
          const type = req.body.type || 'unknown';
          
          // Generate URL for the uploaded file - use the first file
          const file = files[0];
          const fileUrl = `/${file.path.replace(/\\/g, '/')}`;
          
          // Update PDF settings based on the type
          if (['header', 'footer', 'logo', 'loginLogo'].includes(type)) {
            const updateData: any = {};
            
            if (type === 'header') updateData.headerImage = fileUrl;
            if (type === 'footer') updateData.footerImage = fileUrl;
            if (type === 'logo') updateData.logo = fileUrl;
            if (type === 'loginLogo') updateData.loginLogo = fileUrl;
            
            await pdfService.savePdfSettings(updateData, req.user!.id);
          }
          
          // Return success response
          res.json({
            success: true,
            fileUrl,
            message: `${type} image uploaded successfully`
          });
        } catch (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  });
  
  // PDF audit logging endpoint
  app.post("/api/pdf/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action, requestId, details, type } = req.body;
      
      // Validate action type is one of the allowed values
      const validActions = ['pdf_generated', 'pdf_downloaded', 'pdf_viewed', 'pdf_analyzed'];
      if (!action || !validActions.includes(action)) {
        return next(new ValidationError('Invalid action type', {
          action: `Must be one of: ${validActions.join(', ')}`
        }));
      }
      
      // Log the audit event
      const success = await pdfService.logPdfAudit(
        req,
        action,
        requestId,
        details,
        type
      );
      
      // Always return success even if audit logging fails
      return res.status(201).json({ 
        success, 
        timestamp: new Date().toISOString(),
        message: `PDF ${action} audit logged successfully`
      });
    } catch (error) {
      // Don't let audit errors block the API - just log and continue
      console.error('PDF Audit Error:', error);
      // Return success anyway
      return res.status(201).json({ success: true });
    }
  });
  
  // PDF generation endpoint
  app.get("/api/requests/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      const requestId = parseInt(req.params.id, 10);
      if (isNaN(requestId)) {
        return next(new ValidationError('Invalid request ID', {
          id: 'Must be a number'
        }));
      }
      
      // Check if this is a preview
      const isPreview = req.query.preview === 'true';
      
      // Get purchase request data with all relations
      const { data, pdfSettings } = await pdfService.getPurchaseRequestForPdf(requestId, isPreview);
      
      // Log the audit event (only for non-preview requests)
      if (!isPreview) {
        try {
          await pdfService.logPdfAudit(
            req,
            'pdf_downloaded',
            requestId,
            { reportType: 'consolidated' }
          );
        } catch (auditError) {
          console.warn('Failed to log PDF audit event:', auditError);
          // Continue even if audit logging fails
        }
      }
      
      // Return both the request data and PDF settings
      res.status(200).json({
        success: true,
        message: 'Request data for PDF generation',
        data,
        pdfSettings
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      next(error);
    }
  });
  
  // ZIP export endpoint
  app.get("/api/requests/:id/zip", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      const requestId = parseInt(req.params.id, 10);
      if (isNaN(requestId)) {
        return next(new ValidationError('Invalid request ID', {
          id: 'Must be a number'
        }));
      }
      
      // Check if attachments should be included
      const includeAttachments = req.query.includeAttachments === 'true';
      
      // Get purchase request data with all relations
      const { data } = await pdfService.getPurchaseRequestForPdf(requestId);
      
      // Create a ZIP file
      const zip = new JSZip();
      
      // Add request data as JSON
      zip.file('request-data.json', JSON.stringify(data, null, 2));
      
      // Add any attachments if requested
      if (includeAttachments && data.attachments && data.attachments.length > 0) {
        const attachmentsFolder = zip.folder('attachments');
        
        for (const attachment of data.attachments) {
          try {
            // Get the file path
            const filePath = path.join(process.cwd(), attachment.fileUrl);
            
            // Read the file
            const fileBuffer = await fs.readFile(filePath);
            
            // Add to ZIP
            attachmentsFolder?.file(attachment.fileName, fileBuffer);
          } catch (err) {
            console.warn(`Failed to include attachment ${attachment.fileName}:`, err);
            
            // Add a placeholder explaining the error
            const errorText = `This attachment could not be included due to an error.
File name: ${attachment.fileName}
Error: ${err instanceof Error ? err.message : String(err)}
Please download this attachment individually from the request details page.`;
            
            attachmentsFolder?.file(`${attachment.fileName}.error.txt`, errorText);
          }
        }
      }
      
      // Generate the ZIP file
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
      const fileName = `purchase-request-${data.requestNumber || data.id}-${timestamp}.zip`;
      
      // Generate the ZIP content
      const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Log the audit event
      try {
        await pdfService.logPdfAudit(
          req,
          'pdf_downloaded',
          requestId,
          {
            exportType: 'zip',
            fileName,
            fileSize: zipContent.length,
            includesAttachments,
            timestamp: new Date().toISOString()
          }
        );
      } catch (auditError) {
        console.warn('Failed to log ZIP audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      // Set headers
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipContent.length
      });
      
      // Send the ZIP file
      res.send(zipContent);
    } catch (error) {
      console.error('Error generating ZIP:', error);
      
      // Analyze error with Anthropic
      try {
        const errorAnalysis = await anthropicClient.messages.create({
          model: MODEL,
          max_tokens: 500,
          system: "You're an expert in troubleshooting PDF and ZIP export issues. Analyze the error message and suggest practical solutions.",
          messages: [{
            role: 'user',
            content: `I encountered an error when generating a ZIP export:
            
            Error: ${error instanceof Error ? error.message : String(error)}
            Stack: ${error instanceof Error ? error.stack : 'No stack trace available'}
            
            Please provide a simple, user-friendly explanation of what might have gone wrong and how to fix it.`
          }]
        });
        
        const content = errorAnalysis.content[0];
        const explanation = content.type === 'text' ? content.text : 'Error analysis not available';
        
        next(new AppError(`ZIP export failed: ${error instanceof Error ? error.message : String(error)}. ${explanation}`, 500));
      } catch (analysisError) {
        // If AI analysis fails, just return the original error
        next(error);
      }
    }
  });
  
  // Bulk export endpoint
  app.get("/api/requests/export/bulk", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      // Get request IDs from query parameters
      const ids = req.query.ids;
      const requestIds = Array.isArray(ids) 
        ? ids.map(id => parseInt(id as string, 10)).filter(id => !isNaN(id))
        : typeof ids === 'string'
          ? [parseInt(ids, 10)].filter(id => !isNaN(id))
          : [];
      
      if (requestIds.length === 0) {
        return next(new ValidationError('No valid request IDs provided', {
          ids: 'Must provide at least one valid request ID'
        }));
      }
      
      // Check if attachments should be included
      const includeAttachments = req.query.includeAttachments === 'true';
      
      // Create a ZIP file
      const zip = new JSZip();
      
      // Process each request
      for (const requestId of requestIds) {
        try {
          // Get request data
          const { data } = await pdfService.getPurchaseRequestForPdf(requestId);
          
          // Add request data as JSON
          const requestFolder = zip.folder(`request-${requestId}`);
          requestFolder?.file('request-data.json', JSON.stringify(data, null, 2));
          
          // Add attachments if requested
          if (includeAttachments && data.attachments && data.attachments.length > 0) {
            const attachmentsFolder = requestFolder?.folder('attachments');
            
            for (const attachment of data.attachments) {
              try {
                // Get the file path
                const filePath = path.join(process.cwd(), attachment.fileUrl);
                
                // Read the file
                const fileBuffer = await fs.readFile(filePath);
                
                // Add to ZIP
                attachmentsFolder?.file(attachment.fileName, fileBuffer);
              } catch (err) {
                console.warn(`Failed to include attachment ${attachment.fileName}:`, err);
                
                // Add a placeholder explaining the error
                const errorText = `This attachment could not be included due to an error.
File name: ${attachment.fileName}
Error: ${err instanceof Error ? err.message : String(err)}
Please download this attachment individually from the request details page.`;
                
                attachmentsFolder?.file(`${attachment.fileName}.error.txt`, errorText);
              }
            }
          }
        } catch (err) {
          console.warn(`Failed to process request ${requestId}:`, err);
          
          // Add an error file
          zip.file(`request-${requestId}-error.txt`, `Failed to process request ${requestId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      // Generate the ZIP file
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
      const fileName = `bulk-export-${timestamp}.zip`;
      
      // Generate the ZIP content
      const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Log the audit event
      try {
        await pdfService.logPdfAudit(
          req,
          'pdf_downloaded',
          requestIds[0], // Use the first ID as reference
          {
            exportType: 'bulk_zip',
            fileName,
            fileSize: zipContent.length,
            requestCount: requestIds.length,
            includesAttachments,
            timestamp: new Date().toISOString()
          }
        );
      } catch (auditError) {
        console.warn('Failed to log bulk export audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      // Set headers
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipContent.length
      });
      
      // Send the ZIP file
      res.send(zipContent);
    } catch (error) {
      console.error('Error generating bulk export:', error);
      next(error);
    }
  });
  
  // Template analysis endpoint
  app.post("/api/pdf/analyze-template", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      if (req.user?.role !== 'admin') {
        return next(new AuthorizationError('Only administrators can analyze templates'));
      }
      
      const { templateConfig, errorMessage } = req.body;
      
      if (!templateConfig) {
        return next(new ValidationError('Template configuration is required', {
          templateConfig: 'Required'
        }));
      }
      
      // Analyze the template
      const analysis = await pdfService.analyzePdfTemplateIssue(
        templateConfig,
        errorMessage || 'General template optimization'
      );
      
      res.json(analysis);
    } catch (error) {
      // Analyze the error if possible
      try {
        const errorAnalysis = await analyzeError(
          error instanceof Error ? error : new Error(String(error)),
          { component: 'pdf-template-analysis' }
        );
        next(new AppError(`Template analysis failed: ${errorAnalysis.analysis || 'Unknown error'}`, 500));
      } catch (analysisError) {
        next(error);
      }
    }
  });
  
  // Image analysis endpoint
  app.post("/api/pdf/analyze-images", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      if (req.user?.role !== 'admin') {
        return next(new AuthorizationError('Only administrators can access this feature'));
      }
      
      const { imageUrl, colors } = req.body;
      
      if (!imageUrl) {
        return next(new ValidationError('Image URL is required', { imageUrl: 'Required' }));
      }
      
      // For now, return a simple analysis
      // This could be enhanced with AI image analysis in the future
      res.json({
        imageUrl,
        analysis: {
          dominant_colors: colors || [
            { color: '#6F2AE6', percentage: 65 }, // Purple
            { color: '#1FD3DB', percentage: 25 }, // Teal
            { color: '#FFFFFF', percentage: 10 }  // White
          ],
          recommendations: [
            'Use colors that complement your brand palette',
            'Ensure adequate contrast for text readability',
            'Keep file size optimized for faster PDF generation'
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  });
}