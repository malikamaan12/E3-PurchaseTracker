import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, purchaseRequests, subPurposes, notifications, companyBranding, accountRequests } from "@db/schema";
import { eq } from "drizzle-orm";
import path from 'path';
import fs from 'fs';
import { AppError, handleError } from './utils/errors';
import { createNotification } from './utils/notifications';
import { analyzePurchaseRequestPriority, type PurchaseRequestInput } from './utils/anthropic';
import { logoUpload, attachmentUpload, handleUploadError } from './utils/middleware';
import passport from 'passport';
import { hash } from 'bcrypt';
import { insertAccountRequestSchema } from './validation/accountRequest';
import { mandatoryDepartments } from './utils/auth';

// Authorization middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Admin routes with enhanced security
  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Fetching all users');
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          department: users.department,
          role: users.role,
          contactNumber: users.contactNumber,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        })
        .from(users)
        .orderBy(users.username);

      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      next(new AppError('Failed to fetch users', 500));
    }
  });

  app.get("/api/admin/account-requests", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await db
        .select()
        .from(accountRequests)
        .orderBy(accountRequests.createdAt);
      res.json(requests);
    } catch (error) {
      next(new AppError('Failed to fetch account requests', 500));
    }
  });

  // Authentication routes
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      passport.authenticate('local', (err: any, user: Express.User | false, info: any) => {
        if (err) {
          console.error('Authentication error:', err);
          return next(err);
        }

        if (!user) {
          console.log('Login failed:', info?.message);
          return res.status(401).json({ message: info?.message || 'Invalid username or password' });
        }

        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('Login error:', loginErr);
            return next(loginErr);
          }

          return res.json({
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              department: user.department,
              role: user.role,
              contactNumber: user.contactNumber
            }
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error('Unexpected login error:', error);
      next(error);
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
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

  // Account request endpoint with enhanced error handling
  app.post("/api/auth/request-account", async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Processing account request:', req.body);
      const validationResult = insertAccountRequestSchema.safeParse({
        ...req.body,
        contact_number: req.body.contactNumber, // Map the incoming field
        role: req.body.role || 'user',
        status: 'pending'
      });

      if (!validationResult.success) {
        console.error('Validation failed:', validationResult.error.issues);
        return res.status(400).json({
          message: 'Invalid input',
          errors: validationResult.error.issues
        });
      }

      const { username, password, email, contact_number, department, role } = validationResult.data;

      // Check if username already exists in users
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        console.log('Username already exists:', username);
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if there's a pending request
      const [existingRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.username, username))
        .limit(1);

      if (existingRequest) {
        console.log('Pending request exists for:', username);
        return res.status(400).json({ message: "An account request with this username is already pending" });
      }

      // Hash password
      const hashedPassword = await hash(password, 10);

      // Create account request
      console.log('Creating account request for:', username);
      const [newRequest] = await db
        .insert(accountRequests)
        .values({
          username,
          password: hashedPassword,
          email,
          contact_number,
          department,
          role,
          status: 'pending',
        })
        .returning();

      // Notify admins
      const admins = await db
        .select()
        .from(users)
        .where(eq(users.role, 'admin'));

      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          title: 'New Account Request',
          message: `${username} has requested an account`,
          type: 'account_request'
        });
      }

      console.log('Account request created successfully:', newRequest.username);
      res.status(201).json({
        message: "Account request submitted successfully",
        request: {
          username: newRequest.username,
          email: newRequest.email,
          department: newRequest.department,
          status: newRequest.status
        }
      });

    } catch (error) {
      console.error('Account request error:', error);
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
        attachmentUpload.array('files')(req, res, (err) => {
          if (err) reject(handleUploadError(err));
          else resolve();
        });
      });

      const { title, description, purposeType, items, totalEstimatedCost, companyName, contactNumber, accountNumber, priority } = req.body;

      // Validate required fields
      if (!title || !description || !purposeType) {
        throw new AppError('Missing required fields', 400, 'warning');
      }

      // Generate request number
      const requestNumber = `REQ-${Date.now().toString().slice(-6)}`;

      // Parse items safely
      let parsedItems;
      try {
        parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
      } catch (e) {
        throw new AppError('Invalid items format', 400, 'warning');
      }

      // Create new purchase request
      const [newRequest] = await db
        .insert(purchaseRequests)
        .values({
          requestNumber,
          requesterId: req.user!.id,
          title,
          description,
          purposeType,
          items: parsedItems,
          totalEstimatedCost: parseFloat(totalEstimatedCost || '0'),
          companyName: companyName || '',
          contactNumber: contactNumber || '',
          accountNumber: accountNumber || '',
          status: 'draft',
          priority: priority || 'low',
          freightAmount: 0,
          isLocked: false,
          mandatoryApproversCount: 0,
          currency: 'QAR'
        })
        .returning();

      // Handle file attachments if any
      if (req.files?.length) {
        const files = req.files as Express.Multer.File[];

        for (const file of files) {
          await db.insert(fileAttachments).values({
            requestId: newRequest.id,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            fileUrl: file.path
          });
        }
      }

      res.status(201).json(newRequest);
    } catch (error) {
      // Clean up uploaded files if request fails
      if (req.files?.length) {
        const files = req.files as Express.Multer.File[];
        await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
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

    // Convert error to AppError
    const error = err instanceof AppError ? err : new AppError(
      err.message || 'Internal Server Error',
      err.status || 500,
      err.severity || 'error'
    );

    const status = error.status;
    res.status(status).json({
      status: 'error',
      message: error.message,
      severity: error.severity,
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