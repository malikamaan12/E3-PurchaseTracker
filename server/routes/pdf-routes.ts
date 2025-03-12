import { Request, Response, NextFunction, Express } from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import multer from 'multer';
import { db } from '@db/index';
import { pdfSettings, auditLogs } from '@db/schema';
import { desc, eq } from 'drizzle-orm';
import { AppError, AuthorizationError, ValidationError } from '../utils/errors';
import { analyzeError } from '../utils/error-analysis';

/**
 * Registers PDF-related routes
 */
export function registerPdfRoutes(app: Express) {
  
  // Public route to get login logo without authentication
  app.get("/api/login-logo", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const logoSettings = await db.query.pdfSettings.findFirst({
        columns: {
          loginLogo: true
        }
      });
      
      return res.json({ 
        loginLogo: logoSettings?.loginLogo || null 
      });
    } catch (error) {
      next(error);
    }
  });
  // Get PDF settings endpoint
  app.get("/api/pdf/print-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      // Fetch the latest PDF settings
      const settings = await db.query.pdfSettings.findMany({
        orderBy: [desc(pdfSettings.updatedAt)],
        limit: 1
      });
      
      // Return settings or default values
      if (settings.length > 0) {
        res.json(settings[0]);
      } else {
        // Return default settings if none exist
        res.json({
          headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
          headerSubtitle: 'PURCHASE REQUEST',
          headerColor: '#1a365d',
          footerText: 'ALL RIGHTS RESERVED BY E3',
          footerColor: '#1a365d',
          pageNumbering: true,
          fontSize: 11,
          marginTop: 20,
          marginBottom: 20,
          marginLeft: 25,
          marginRight: 25,
          headerHeight: 100,
          footerHeight: 50,
          headerImage: null,
          footerImage: null,
          logo: null
        });
      }
    } catch (error) {
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
      
      // Get the settings data from the request body
      const settingsData = req.body;
      
      // Find existing settings
      const existingSettings = await db.query.pdfSettings.findMany({
        orderBy: [desc(pdfSettings.updatedAt)],
        limit: 1
      });
      
      let result;
      
      if (existingSettings.length > 0) {
        // Update existing settings
        const settingId = existingSettings[0].id;
        [result] = await db.update(pdfSettings)
          .set({
            ...settingsData,
            updatedAt: new Date()
          })
          .where(eq(pdfSettings.id, settingId))
          .returning();
      } else {
        // Create new settings
        [result] = await db.insert(pdfSettings).values({
          ...settingsData,
          userId: req.user!.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
      }
      
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
          
          // Update PDF settings if necessary based on the type
          if (['header', 'footer', 'logo'].includes(type)) {
            const existingSettings = await db.query.pdfSettings.findMany({
              orderBy: [desc(pdfSettings.updatedAt)],
              limit: 1
            });
            
            const updateData: Partial<typeof pdfSettings.$inferInsert> = {};
            
            if (type === 'header') updateData.headerImage = fileUrl;
            if (type === 'footer') updateData.footerImage = fileUrl;
            if (type === 'logo') updateData.logo = fileUrl;
            
            if (existingSettings.length > 0) {
              // Update existing settings
              const settingId = existingSettings[0].id;
              await db.update(pdfSettings)
                .set({
                  ...updateData,
                  updatedAt: new Date()
                })
                .where(eq(pdfSettings.id, settingId));
            } else {
              // Create new settings with default values
              await db.insert(pdfSettings).values({
                headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
                headerSubtitle: 'PURCHASE REQUEST',
                headerColor: '#1a365d',
                footerText: 'ALL RIGHTS RESERVED BY E3',
                footerColor: '#1a365d',
                pageNumbering: true,
                fontSize: 11,
                marginTop: 20,
                marginBottom: 20,
                marginLeft: 25,
                marginRight: 25,
                headerHeight: 100,
                footerHeight: 50,
                ...updateData,
                userId: req.user!.id,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
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
  
  // Handler for PDF branding image uploads
  app.post("/api/pdf/branding-images", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify authentication and permissions
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      if (req.user?.role !== 'admin') {
        return next(new AuthorizationError('Only administrators can modify branding settings'));
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
      
      // Handle the file upload
      upload.fields([
        { name: 'headerImage', maxCount: 1 },
        { name: 'footerImage', maxCount: 1 },
        { name: 'logo', maxCount: 1 }
      ])(req, res, async (err) => {
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
          const files = req.files as { [fieldname: string]: Express.Multer.File[] };
          
          if (!files || Object.keys(files).length === 0) {
            return next(new AppError('No files uploaded', 400));
          }
          
          // Get the existing settings or create default ones
          const existingSettings = await db.query.pdfSettings.findMany({
            orderBy: [desc(pdfSettings.updatedAt)],
            limit: 1
          });
          
          const updateData: Partial<typeof pdfSettings.$inferInsert> = {};
          
          // Process each uploaded file and update the corresponding field
          Object.entries(files).forEach(([fieldName, fieldFiles]) => {
            if (fieldFiles && fieldFiles.length > 0) {
              const file = fieldFiles[0];
              const fileUrl = `/${file.path.replace(/\\/g, '/')}`;
              
              // Handle each field specifically to avoid type errors
              if (fieldName === 'headerImage') {
                updateData.headerImage = fileUrl;
              } else if (fieldName === 'footerImage') {
                updateData.footerImage = fileUrl;
              } else if (fieldName === 'logo') {
                updateData.logo = fileUrl;
              }
            }
          });
          
          let result;
          
          if (existingSettings.length > 0) {
            // Update existing settings
            const settingId = existingSettings[0].id;
            [result] = await db.update(pdfSettings)
              .set({
                ...updateData,
                updatedAt: new Date()
              })
              .where(eq(pdfSettings.id, settingId))
              .returning();
          } else {
            // Create new settings with default values
            [result] = await db.insert(pdfSettings).values({
              headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
              headerSubtitle: 'PURCHASE REQUEST',
              headerColor: '#1a365d',
              footerText: 'ALL RIGHTS RESERVED BY E3',
              footerColor: '#1a365d',
              pageNumbering: true,
              fontSize: 11,
              marginTop: 20,
              marginBottom: 20,
              marginLeft: 25,
              marginRight: 25,
              headerHeight: 100,
              footerHeight: 50,
              ...updateData,
              userId: req.user!.id,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();
          }
          
          // Return success response with updated settings
          res.json({
            success: true,
            settings: result,
            message: 'Branding images updated successfully'
          });
        } catch (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Add PDF audit endpoint
  app.post("/api/pdf/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      const { action, resourceId, details } = req.body;
      
      if (!action || !resourceId) {
        return next(new ValidationError('Missing required fields', { 
          action: !action ? 'Required' : undefined,
          resourceId: !resourceId ? 'Required' : undefined
        }));
      }
      
      // Insert audit log entry
      if (req.user) {
        await db.insert(auditLogs).values({
          userId: req.user.id,
          action,
          resourceId,
          resourceType: 'pdf',
          details: details || {},
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date()
        });
      } else {
        await db.insert(auditLogs).values({
          action,
          resourceId,
          resourceType: 'pdf',
          details: details || {},
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date()
        });
      }
      
      return res.status(201).json({ success: true });
    } catch (error) {
      const errorAnalysis = await analyzeError(error as Error, {
        component: 'PDF Audit',
        operation: 'create',
        user: req.user?.id
      });
      
      console.error('PDF Audit Error:', errorAnalysis);
      next(error);
    }
  });
  
  // Image analysis for branding optimization
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
      // In a real implementation, you would use an image analysis library
      // or AI service to analyze the image and provide recommendations
      
      const hexToRgb = (hex: string): [number, number, number] => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
      };
      
      // If colors were provided, use them for the analysis
      let colorPalette = [];
      if (colors && Array.isArray(colors)) {
        colorPalette = colors.map((color: string) => {
          if (typeof color === 'string' && color.startsWith('#')) {
            return hexToRgb(color);
          }
          return [0, 0, 0];
        });
      } else {
        // Generate a sample color palette
        colorPalette = [
          [26, 54, 93],   // #1a365d - dark blue
          [66, 153, 225], // #4299e1 - blue
          [237, 242, 247] // #edf2f7 - light gray
        ];
      }
      
      // Return the analysis
      res.json({
        analysis: {
          colors: colorPalette,
          contrast: 'good',
          recommendations: [
            'The header image works well with the current color scheme',
            'Consider using a consistent color palette across all branding elements',
            'For better accessibility, ensure high contrast between text and background colors'
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  });
}