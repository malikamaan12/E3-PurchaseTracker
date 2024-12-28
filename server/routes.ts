import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, purchaseRequests, subPurposes, notifications, companyBranding } from "@db/schema";
import { eq, and } from "drizzle-orm";
import path from 'path';
import fs from 'fs';
import { AppError, handleError } from './utils/errors';
import { createNotification, cleanupUploads } from './utils/notifications';
import { analyzePurchaseRequestPriority, type PurchaseRequestInput } from './utils/anthropic';
import { logoUpload, attachmentUpload, handleUploadError } from './utils/middleware';
import session from 'express-session';
import passport from 'passport';
import { configurePassport } from './utils/auth';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport(passport);

  // Add request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // Authentication routes
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info.message || 'Authentication failed' });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Basic health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Sub-purposes endpoints
  app.post("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      const { name, purposeType, validFrom, validTo } = req.body;

      // Validate input
      if (!name || !purposeType) {
        throw new AppError('Name and purpose type are required', 400, 'warning');
      }

      // Create new sub-purpose
      const [newSubPurpose] = await db.insert(subPurposes)
        .values({
          name,
          purposeType,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
          isFrozen: false,
        })
        .returning();

      res.status(201).json(newSubPurpose);
    } catch (error) {
      next(error);
    }
  });

  // Purchase requests endpoints with file upload
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      // Handle file uploads first
      await new Promise<void>((resolve, reject) => {
        attachmentUpload(req, res, (err) => {
          if (err) reject(handleUploadError(err));
          else resolve();
        });
      });

      const { title, description, purposeType, items, totalEstimatedCost } = req.body;

      // Validate required fields
      if (!title || !description || !purposeType) {
        throw new AppError('Missing required fields', 400, 'warning');
      }

      // Generate request number
      const requestNumber = `REQ-${Date.now().toString().slice(-6)}`;

      // Create new purchase request with correct types
      const [newRequest] = await db.insert(purchaseRequests)
        .values({
          requestNumber,
          title,
          description,
          purposeType,
          requesterId: req.user!.id,
          status: 'draft',
          items: JSON.parse(items || '[]'),
          totalEstimatedCost: parseFloat(totalEstimatedCost || '0'),
          attachments: (req.files as Express.Multer.File[])?.map(f => f.path) || [],
          priority: 'low', // Default priority
          contactNumber: '', // Empty string as default
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.status(201).json(newRequest);
    } catch (error) {
      // Clean up uploaded files if request fails
      if (req.files) {
        await cleanupUploads(req.files as Express.Multer.File[]);
      }
      next(error);
    }
  });

  app.get("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      const allSubPurposes = await db.query.subPurposes.findMany({
        orderBy: [subPurposes.name]
      });

      res.json(allSubPurposes);
    } catch (error) {
      next(error);
    }
  });

  // Purchase requests endpoints
  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      const requests = await db.query.purchaseRequests.findMany({
        with: {
          requester: true,
          approvals: {
            with: {
              approver: true
            }
          },
          subPurpose: true,
        },
        where: req.user!.role === 'admin' ? undefined : eq(purchaseRequests.requesterId, req.user!.id)
      });

      res.json(requests);
    } catch (error) {
      next(error);
    }
  });

  // User data endpoint
  app.get("/api/user", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user!.id)
      });

      if (!user) {
        throw new AppError('User not found', 404, 'error');
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  // Company branding endpoint
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

      // Delete existing branding if it exists
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

  // Priority analysis endpoint
  app.post("/api/analyze-priority", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401, 'error');
      }

      const purchaseRequest = req.body as PurchaseRequestInput;
      const analysis = await analyzePurchaseRequestPriority(purchaseRequest);
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
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