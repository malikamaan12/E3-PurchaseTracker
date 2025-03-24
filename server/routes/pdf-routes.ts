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
        },
        orderBy: [desc(pdfSettings.updatedAt)]
      });
      
      return res.json({ 
        loginLogo: logoSettings?.loginLogo || null 
      });
    } catch (error) {
      console.error('Error fetching login logo:', error);
      next(error);
    }
  });
  // Get PDF settings endpoint
  app.get("/api/pdf/print-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return next(new AppError('Not authenticated', 401));
      }
      
      // Check if requesting template configuration specifically
      const requestType = req.query.type;
      
      // Define default settings with template configuration as a fallback
      const defaultSettings = {
        headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
        headerSubtitle: 'PURCHASE REQUEST',
        headerColor: '#6F2AE6', // Purple
        footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
        footerColor: '#6F2AE6',
        pageNumbering: true,
        pageNumberPosition: 'bottom-right', // Default position for page numbers
        watermarkOpacity: 10,
        templateConfig: JSON.stringify({
          name: 'Standard Template',
          type: 'standard',
          layout: 'portrait',
          showHeader: true,
          showFooter: true,
          showLogo: true,
          showWatermark: true,
          securityLevel: 'internal',
          headerColor: [111, 42, 230],
          accentColor: [31, 211, 219],
          watermarkOpacity: 0.08,
          watermarkText: 'INTERNAL USE',
          showApprovalFlow: true,
          showSignatureLines: true,
          showAttachments: true,
          showTotalsTable: true
        })
      };
      
      // Fetch the latest PDF settings
      const settings = await db.query.pdfSettings.findMany({
        orderBy: [desc(pdfSettings.updatedAt)],
        limit: 1
      });
      
      // Return settings or default values based on request type
      if (settings.length > 0) {
        const settingsData = settings[0];
        
        // If templateConfig is requested, try to parse it or return default
        if (requestType === 'template') {
          try {
            // Check if templateConfig exists and is valid JSON
            if (settingsData.templateConfig) {
              const templateConfig = JSON.parse(settingsData.templateConfig);
              return res.json({
                ...settingsData,
                templateConfig
              });
            } else {
              // If templateConfig is missing, add default template configuration
              return res.json({
                ...settingsData,
                templateConfig: {
                  name: 'Standard Template',
                  type: 'standard',
                  layout: 'portrait',
                  showHeader: true,
                  showFooter: true,
                  showLogo: true,
                  showWatermark: true,
                  securityLevel: 'internal',
                  headerColor: [111, 42, 230],
                  accentColor: [31, 211, 219],
                  watermarkOpacity: 0.08,
                  watermarkText: 'INTERNAL USE',
                  showApprovalFlow: true,
                  showSignatureLines: true,
                  showAttachments: true,
                  showTotalsTable: true
                }
              });
            }
          } catch (parseError) {
            console.error('Failed to parse template configuration:', parseError);
            // Return settings with default template configuration
            return res.json({
              ...settingsData,
              templateConfig: {
                name: 'Standard Template',
                type: 'standard',
                layout: 'portrait',
                showHeader: true,
                showFooter: true,
                showLogo: true,
                showWatermark: true,
                securityLevel: 'internal',
                headerColor: [111, 42, 230],
                accentColor: [31, 211, 219],
                watermarkOpacity: 0.08,
                watermarkText: 'INTERNAL USE',
                showApprovalFlow: true,
                showSignatureLines: true,
                showAttachments: true,
                showTotalsTable: true
              }
            });
          }
        }
        
        // Return all settings for regular requests
        res.json(settingsData);
      } else {
        // Default settings
        const defaultSettings = {
          headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
          headerSubtitle: 'PURCHASE REQUEST',
          headerColor: '#1a365d',
          footerText: 'ALL RIGHTS RESERVED BY E3',
          footerColor: '#1a365d',
          pageNumbering: true,
          pageNumberPosition: 'bottom-right',
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
        };
        
        // Add templateConfig if requested
        if (requestType === 'template') {
          const defaultTemplateConfig = {
            name: 'Standard',
            type: 'standard',
            layout: 'classic',
            showHeader: true,
            showFooter: true,
            showLogo: true,
            showWatermark: false,
            securityLevel: 'public',
            headerColor: [26, 54, 93],
            accentColor: [79, 70, 229],
            showApprovalFlow: true,
            showSignatureLines: true,
            showAttachments: true,
            showTotalsTable: true
          };
          
          return res.json({
            ...defaultSettings,
            templateConfig: defaultTemplateConfig
          });
        }
        
        res.json(defaultSettings);
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
      
      // Check if this is a template configuration
      if (req.body.type === 'template' && req.body.templateConfig) {
        // Get the template configuration from the request body
        const templateConfig = req.body.templateConfig;
        
        // Find existing settings
        const existingSettings = await db.query.pdfSettings.findMany({
          orderBy: [desc(pdfSettings.updatedAt)],
          limit: 1
        });
        
        let result;
        
        if (existingSettings.length > 0) {
          // Update existing settings with template configuration
          const settingId = existingSettings[0].id;
          [result] = await db.update(pdfSettings)
            .set({
              templateConfig: JSON.stringify(templateConfig),
              updatedAt: new Date()
            })
            .where(eq(pdfSettings.id, settingId))
            .returning();
        } else {
          // Create new settings with template configuration and required fields
          [result] = await db.insert(pdfSettings).values({
            headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
            headerSubtitle: 'PURCHASE REQUEST',
            headerColor: '#6F2AE6', // Purple
            footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
            footerColor: '#6F2AE6',
            pageNumbering: true,
            pageNumberPosition: 'bottom-right',
            templateConfig: JSON.stringify(templateConfig),
            userId: req.user!.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();
        }
        
        return res.status(201).json({
          success: true,
          templateConfig: JSON.parse(result.templateConfig || '{}')
        });
      }
      
      // Regular PDF settings handling
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
          if (['header', 'footer', 'logo', 'loginLogo'].includes(type)) {
            const existingSettings = await db.query.pdfSettings.findMany({
              orderBy: [desc(pdfSettings.updatedAt)],
              limit: 1
            });
            
            const updateData: Partial<typeof pdfSettings.$inferInsert> = {};
            
            if (type === 'header') updateData.headerImage = fileUrl;
            if (type === 'footer') updateData.footerImage = fileUrl;
            if (type === 'logo') updateData.logo = fileUrl;
            if (type === 'loginLogo') updateData.loginLogo = fileUrl;
            
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
                pageNumberPosition: 'bottom-right',
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
        { name: 'logo', maxCount: 1 },
        { name: 'loginLogo', maxCount: 1 }
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
              } else if (fieldName === 'loginLogo') {
                updateData.loginLogo = fileUrl;
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
      // Accept audit logs even from unauthenticated users
      // This allows tracking PDF views from external sources
      
      const { action, requestId, details, type } = req.body;
      
      // Validate and convert requestId to a valid resourceId 
      let validatedResourceId: number | null = null;
      
      if (requestId !== null && requestId !== undefined) {
        // Convert to number if string
        const numericId = typeof requestId === 'string' ? parseInt(requestId.trim(), 10) : requestId;
        
        // Verify it's a valid positive number
        if (!isNaN(Number(numericId)) && Number(numericId) > 0) {
          validatedResourceId = Number(numericId);
        } else {
          return next(new ValidationError('Invalid request ID', { 
            requestId: 'Must be a positive number'
          }));
        }
      } else {
        return next(new ValidationError('Missing required fields', { 
          action: !action ? 'Required' : undefined,
          requestId: 'Required'
        }));
      }
      
      // Validate action type is one of the allowed values
      const validActions = ['pdf_generated', 'pdf_downloaded', 'pdf_viewed'];
      if (!action || !validActions.includes(action)) {
        return next(new ValidationError('Invalid action type', {
          action: `Must be one of: ${validActions.join(', ')}`
        }));
      }
      
      // Add timestamp to details if not provided
      const enrichedDetails = {
        ...details,
        timestamp: details?.timestamp || new Date().toISOString(),
        userType: type || 'user',
        trackingSource: details?.trackingId ? 'tracked' : 'untracked'
      };
      
      try {
        // Try to insert audit log entry with the user ID if authenticated
        if (req.isAuthenticated() && req.user) {
          await db.insert(auditLogs).values({
            userId: req.user.id,
            action,
            resourceId: validatedResourceId,
            resourceType: 'pdf',
            details: enrichedDetails,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || '',
            timestamp: new Date()
          });
          
          console.log(`[PDF Audit] Authenticated user ${req.user.id} ${action} for request ${validatedResourceId}`);
        } else {
          // Handle anonymous users - try to get user ID from details if provided
          const userIdFromDetails = details?.userId ? 
            parseInt(details.userId as string, 10) : null;
          
          await db.insert(auditLogs).values({
            userId: userIdFromDetails, // May be null for anonymous access
            action,
            resourceId: validatedResourceId,
            resourceType: 'pdf',
            details: enrichedDetails,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || '',
            timestamp: new Date()
          });
          
          console.log(`[PDF Audit] Anonymous ${action} for request ${validatedResourceId}, implied user: ${userIdFromDetails || 'none'}`);
        }
      } catch (auditError) {
        // Just log the error but don't fail the request
        console.error('[PDF Audit] Failed to save audit log:', auditError);
      }
      
      // Always return success even if audit logging fails
      return res.status(201).json({ 
        success: true, 
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