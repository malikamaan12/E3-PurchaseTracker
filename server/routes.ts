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
import passport from 'passport';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Authentication routes with enhanced error handling
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Login request received:', { username: req.body.username });

      if (!req.body.username || !req.body.password) {
        console.log('Login failed: Missing credentials');
        return res.status(400).json({ message: 'Username and password are required' });
      }

      passport.authenticate('local', async (err: any, user: any, info: any) => {
        if (err) {
          console.error('Authentication error:', err);
          return next(err);
        }

        if (!user) {
          console.log('Login failed:', { 
            username: req.body.username, 
            reason: info?.message || 'Unknown reason'
          });
          return res.status(401).json({ 
            message: info?.message || 'Invalid username or password'
          });
        }

        // Log successful authentication
        console.log('Authentication successful:', { 
          userId: user.id,
          username: user.username 
        });

        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('Login session error:', loginErr);
            return next(loginErr);
          }

          console.log('Login session created successfully');
          return res.json({ 
            user: {
              id: user.id,
              username: user.username,
              department: user.department,
              role: user.role,
              email: user.email
            }
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error('Unexpected login error:', error);
      next(error);
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response, next: NextFunction) => {
    try {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return next(err);
        }
        res.json({ message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Unexpected logout error:', error);
      next(error);
    }
  });

  app.get("/api/auth/user", (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      res.json(req.user);
    } catch (error) {
      console.error('User fetch error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

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