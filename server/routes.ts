import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { upload } from "./utils/upload";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { setupAuth } from "./auth";
import { debug } from "./utils/debug";
import { logAuditEvent } from "./utils/audit-logger";
import {
  users,
  purchaseRequests,
  notifications,
  notificationPreferences,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES
} from "@db/schema";
import { eq, and, desc, or, isNull, inArray } from "drizzle-orm";
import XLSX from 'xlsx';
import fs from 'fs/promises';
import fsSync from 'fs';

// Error Classes 
class AppError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

class ValidationError extends Error {
  details: any;
  constructor(message: string, details: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Notification functions
async function createNotification(userId: number, title: string, message: string, type: string = 'general', resourceId?: number) {
  return db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    resourceId,
    isRead: false,
    createdAt: new Date()
  }).returning();
}

async function getNotifications(userId: number, lastFetchTime?: Date) {
  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));

  if (lastFetchTime) {
    query = query.where(and(
      eq(notifications.userId, userId),
      gte(notifications.createdAt, lastFetchTime)
    ));
  }

  return query;
}

async function markNotificationAsRead(notificationId: number, userId: number) {
  const [notification] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ))
    .returning();

  return notification;
}

export function registerRoutes(app: Express): Server {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploaded files with proper content types
  app.use('/uploads', (req, res, next) => {
    // Set cache control headers for better performance
    res.set({
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'"
    });

    // For PDF files, set additional headers
    if (req.path.toLowerCase().endsWith('.pdf')) {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline'
      });
    }
    next();
  }, express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.pdf':
          res.set('Content-Type', 'application/pdf');
          break;
        case '.png':
          res.set('Content-Type', 'image/png');
          break;
        case '.jpg':
        case '.jpeg':
          res.set('Content-Type', 'image/jpeg');
          break;
        case '.gif':
          res.set('Content-Type', 'image/gif');
          break;
        case '.doc':
          res.set('Content-Type', 'application/msword');
          break;
        case '.docx':
          res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          break;
      }
    }
  }));

  // Add file attachment routes
  app.get("/api/attachments/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const attachmentId = parseInt(req.params.id);
      if (isNaN(attachmentId)) {
        throw new ValidationError('Invalid attachment ID', { id: 'Must be a number' });
      }

      // Get file attachment details
      const [attachment] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, attachmentId))
        .limit(1);

      if (!attachment) {
        throw new AppError('Attachment not found', 404);
      }

      // Verify file exists
      const filePath = path.join(process.cwd(), attachment.fileUrl.replace(/^\/uploads\//, 'uploads/'));

      try {
        await fs.access(filePath);
      } catch (error) {
        throw new AppError('File not found on server', 404);
      }

      // Determine if it should be a forced download
      const forceDownload = req.query.download === 'true';

      // Set appropriate headers using middleware helpers
      res.set({
        'Content-Type': getContentType(attachment.fileName),
        'Content-Disposition': getContentDisposition(attachment.fileName, forceDownload),
        'Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff'
      });

      // Stream the file
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  });

  // Add file conversion endpoints
  app.get("/api/conversion/formats", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      if (!type || typeof type !== 'string') {
        throw new ValidationError('Invalid input', { type: ['Source type is required'] });
      }

      const formats = await conversionService.getAvailableFormats(type);
      res.json(formats);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/conversion/convert", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceFormat, targetFormat, filePath } = req.body;

      if (!sourceFormat || !targetFormat || !filePath) {
        throw new ValidationError('Invalid input', {
          details: 'Source format, target format, and file path are required'
        });
      }

      // Get absolute path from relative URL
      const absolutePath = path.join(process.cwd(), filePath.replace(/^\/uploads\//, 'uploads/'));

      // Ensure the file exists
      await fs.access(absolutePath);

      // Perform the conversion
      const result = await conversionService.convertFile(
        absolutePath,
        targetFormat,
        sourceFormat
      );

      // Return the converted file information
      res.json({
        success: true,
        fileUrl: `/uploads/converted/${path.basename(result.outputPath)}`,
        outputType: result.outputType,
        size: (await fs.stat(result.outputPath)).size
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        next(new AppError('Source file not found', 404));
      } else {
        next(error);
      }
    }
  });

  // Put this at the very beginning of the routes file, before other routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Initialize auth second
  setupAuth(app);

  // Add notification endpoints
  app.get("/api/notifications", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const lastFetchTime = req.query.lastFetchTime
        ? new Date(req.query.lastFetchTime as string)
        : undefined;

      debug(req, 'Fetching notifications', { lastFetchTime });
      const results = await getNotifications(req.user!.id, lastFetchTime);
      debug(req, `Found ${results.length} notifications`);

      res.json(results);
    } catch (error) {
      debug(req, 'Error fetching notifications:', error);
      next(error);
    }
  });

  app.put("/api/notifications/:id/read", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        throw new ValidationError('Invalid notification ID', { id: 'Must be a number' });
      }

      debug(req, 'Marking notification as read:', notificationId);
      const updatedNotification = await markNotificationAsRead(notificationId, req.user!.id);
      debug(req, 'Notification updated successfully');

      res.json(updatedNotification);
    } catch (error) {
      debug(req, 'Error marking notification as read:', error);
      next(error);
    }
  });

  // Add notification preferences endpoints
  app.get("/api/notification-preferences", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, req.user!.id))
        .orderBy(notificationPreferences.category, notificationPreferences.type);

      // If no preferences exist, create defaults
      if (preferences.length === 0) {
        const defaultPreferences = Object.keys(NOTIFICATION_CATEGORIES).flatMap(category =>
          Object.keys(NOTIFICATION_TYPES)
            .filter(type => type.startsWith(category.toLowerCase()))
            .map(type => ({
              userId: req.user!.id,
              category,
              type,
              enabled: true,
              inAppEnabled: true,
              emailEnabled: false,
            }))
        );

        const insertedPreferences = await db
          .insert(notificationPreferences)
          .values(defaultPreferences)
          .returning();

        return res.json(insertedPreferences);
      }

      res.json(preferences);
    } catch (error) {
      debug(req, 'Error fetching notification preferences:', error);
      next(error);
    }
  });


  app.get("/api/notification-preferences/metadata", (_req: Request, res: Response) => {
    res.json({
      categories: NOTIFICATION_CATEGORIES,
      types: NOTIFICATION_TYPES
    });
  });

  app.put("/api/notification-preferences/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const preferenceId = parseInt(req.params.id);
      if (isNaN(preferenceId)) {
        throw new ValidationError('Invalid preference ID', { id: 'Must be a number' });
      }

      const validationResult = insertNotificationPreferenceSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError('Invalid input data', validationResult.error.format());
      }

      // Verify the preference belongs to the user
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.id, preferenceId),
          eq(notificationPreferences.userId, req.user!.id)
        ))
        .limit(1);

      if (!existing) {
        throw new AppError('Notification preference not found', 404);
      }

      const [updated] = await db
        .update(notificationPreferences)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(notificationPreferences.id, preferenceId))
        .returning();

      res.json(updated);
    } catch (error) {
      debug(req, 'Error updating notification preference:', error);
      next(error);
    }
  });
  // Account Request endpoint with proper error handling
  app.post("/api/auth/request-account", async (req: Request, res: Response, next: NextFunction) => {
    try {
      debug(req, 'Received account request:', {
        ...req.body,
        password: '[REDACTED]'
      });

      // Validate the request data
      const validationResult = insertAccountRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        throw new ValidationError('Invalid input data', validationResult.error.format());
      }

      // Check for existing username
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, validationResult.data.username))
        .limit(1);

      if (existingUser) {
        throw new ValidationError('Username already exists', {
          username: ['Username is already taken']
        });
      }

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(validationResult.data.password, 10);

      // Create the account request
      const [newRequest] = await db
        .insert(accountRequests)
        .values({
          ...validationResult.data,
          password: hashedPassword,
          status: 'pending'
        })
        .returning();

      debug(req, 'Account request created successfully:', newRequest.id);

      // Notify admins about new account request
      const admins = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'),
          eq(users.isActive, true)
        ));

      // Create notifications for admins
      await Promise.all(admins.map(admin =>
        createNotification(
          admin.id,
          'New Account Request',
          `New account request from ${newRequest.username} for ${newRequest.department} department`,
          'account_request'
        )
      ));

      res.status(201).json({
        message: 'Account request submitted successfully',
        requestId: newRequest.id
      });
    } catch (error) {
      debug(req, 'Error processing account request:', error);
      next(error);
    }
  });
  // Update the create purchase request endpoint
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const { data: requestData, action } = req.body;
      console.log('Creating purchase request:', {
        action,
        requestData
      });

      // Generate a unique request number
      const requestNumber = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Ensure items is an array before stringifying
      const items = Array.isArray(requestData.items) ? requestData.items : [];

      // Prepare request data
      let finalRequestData = {
        ...requestData,
        requestNumber,
        requesterId: req.user!.id,
        status: action === 'draft' ? 'draft' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        // Properly stringify the items array
        items: JSON.stringify(items)
      };

      // If saving as draft, make sure required fields are not enforced
      if (action === 'draft') {
        // Allow empty or partial data for drafts
        finalRequestData = {
          ...finalRequestData,
          items: finalRequestData.items || '[]',
          totalEstimatedCost: finalRequestData.totalEstimatedCost || 0,
          freightAmount: finalRequestData.freightAmount || 0
        };
      } else {
        // Validate required fields for submissions
        const validationResult = insertPurchaseRequestSchema.safeParse({
          ...requestData,
          items: items // Pass the original array for validation
        });

        if (!validationResult.success) {
          console.error('Validation failed:', validationResult.error.format());
          return res.status(400).json({
            message: 'Invalid request data',
            errors: validationResult.error.format()
          });
        }
      }

      console.log('Final request data:', JSON.stringify(finalRequestData, null, 2));

      // Create purchase request
      const [request] = await db
        .insert(purchaseRequests)
        .values(finalRequestData)
        .returning();

      // Handle attachments if any
      if (requestData.attachments?.length) {
        await db.insert(fileAttachments).values(
          requestData.attachments.map((attachment: any) => ({
            requestId: request.id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            fileUrl: attachment.fileUrl,
            uploadedAt: new Date()
          }))
        );
      }

      console.log(`Purchase request ${action === 'draft' ? 'draft saved' : 'submitted'} successfully:`, request.id);

      // Return detailed response with parsed items
      res.status(201).json({
        ...request,
        items: items, // Return the original array
        message: `Request ${action === 'draft' ? 'saved as draft' : 'submitted'} successfully`
      });
    } catch (error) {
      console.error('Error creating purchase request:', error);
      next(error);
    }
  });

  // Enhanced sub-purposes endpoint with proper error handling and logging
  app.get("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const { purposeType } = req.query;
      debug(req, 'Fetching sub-purposes with filters:', { purposeType });

      const baseQuery = db.select({
        id: subPurposes.id,
        name: subPurposes.name,
        purpose_type: subPurposes.purpose_type,
        is_frozen: subPurposes.is_frozen,
        valid_from: subPurposes.valid_from,
        valid_to: subPurposes.valid_to,
        created_at: subPurposes.created_at,
        updated_at: subPurposes.updated_at
      })
        .from(subPurposes)
        .where(
          purposeType
            ? eq(subPurposes.purpose_type, purposeType as string)
            : undefined
        )
        .orderBy(desc(subPurposes.created_at));

      const results = await baseQuery;
      debug(req, `Found ${results.length} sub-purposes`);

      // Add debug logging for the query results
      debug(req, 'Raw sub-purposes data:', results);

      // Format dates consistently and ensure all fields are present
      const formattedResults = results.map(sp => ({
        id: sp.id,
        name: sp.name,
        purpose_type: sp.purpose_type,
        is_frozen: sp.is_frozen,
        valid_from: sp.valid_from ? new Date(sp.valid_from).toISOString() : null,
        valid_to: sp.valid_to ? new Date(sp.valid_to).toISOString() : null,
        created_at: sp.created_at ? new Date(sp.created_at).toISOString() : null,
        updated_at: sp.updated_at ? new Date(sp.updated_at).toISOString() : null,
        // Add any additional fields needed by the frontend
        label: sp.name, // Add label field for dropdown compatibility
        value: sp.id.toString() // Add value field for dropdown compatibility
      }));

      debug(req, 'Formatted sub-purposes data:', formattedResults);
      res.json(formattedResults);
    } catch (error) {
      debug(req, 'Error fetching sub-purposes:', error);
      next(error);
    }
  });

  // Admin route for sub-purposes
  app.get("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const allSubPurposes = await db
        .select({
          id: subPurposes.id,
          name: subPurposes.name,
          purpose_type: subPurposes.purpose_type,
          is_frozen: subPurposes.is_frozen,
          valid_from: subPurposes.valid_from,
          valid_to: subPurposes.valid_to,
          created_at: subPurposes.created_at,
          updated_at: subPurposes.updated_at
        })
        .from(subPurposes)
        .orderBy(desc(subPurposes.created_at));

      debug(req, `Found ${allSubPurposes.length} sub-purposes`);
      res.json(allSubPurposes);
    } catch (error) {
      debug(req, 'Error fetching sub-purposes:', error);
      next(error);
    }
  });


  // Add sub-purposes endpoint
  app.get("/api/subpurposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const { purposeType } = req.query;
      debug(req, 'Fetching sub-purposes with filters:', { purposeType });

      let query = db.select().from(subPurposes);

      // Apply purpose type filter if provided
      if (purposeType) {
        query = query.where(eq(subPurposes.purpose_type, purposeType as string));
      }

      // Only return non-frozen and valid sub-purposes
      const now = new Date();
      query = query.where(
        and(
          eq(subPurposes.is_frozen, false),
          or(
            isNull(subPurposes.valid_from),
            lte(subPurposes.valid_from, now)
          ),
          or(
            isNull(subPurposes.valid_to),
            gte(subPurposes.valid_to, now)
          )
        )
      );

      const results = await query.orderBy(desc(subPurposes.created_at));
      debug(req, `Found ${results.length} sub-purposes`);

      // Format the response to match frontend expectations
      const formattedResults = results.map(sp => ({
        id: sp.id,
        name: sp.name,
        purpose_type: sp.purpose_type,
        is_frozen: sp.is_frozen,
        valid_from: sp.valid_from ? new Date(sp.valid_from).toISOString() : null,
        valid_to: sp.valid_to ? new Date(sp.valid_to).toISOString() : null
      }));

      res.json(formattedResults);
    } catch (error) {
      debug(req, 'Error fetching sub-purposes:', error);
      next(error);
    }
  });

  // Account requests management - UPDATED
  app.get("/api/admin/account-requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const { status, department, role } = req.query;
      debug(req, 'Fetching account requests with filters:', { status, department, role });

      // Build the where clause based on filters
      const whereConditions = [];
      if (status && typeof status === 'string') {
        whereConditions.push(eq(accountRequests.status, status));
      }
      if (department && typeof department === 'string') {
        whereConditions.push(eq(accountRequests.department, department));
      }
      if (role && typeof role === 'string') {
        whereConditions.push(eq(accountRequests.role, role));
      }

      // Debug log for query construction
      debug(req, 'Constructed where conditions:', whereConditions);

      // Execute the query with proper type safety
      const accountRequestsResult = await db
        .select({
          id: accountRequests.id,
          username: accountRequests.username,
          email: accountRequests.email,
          department: accountRequests.department,
          role: accountRequests.role,
          status: accountRequests.status,
          contact_number: accountRequests.contact_number,
          createdAt: accountRequests.createdAt,
          updatedAt: accountRequests.updatedAt
        })
        .from(accountRequests)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(accountRequests.createdAt));

      debug(req, `Found ${accountRequestsResult.length} account requests`);

      // Debug log for results
      debug(req, 'Account requests after filtering:',
        accountRequestsResult.map(r => ({
          id: r.id,
          username: r.username,
          status: r.status,
          department: r.department,
          role: r.role
        }))
      );

      res.json(accountRequestsResult);
    } catch (error) {
      debug(req, 'Error fetching account requests:', error);
      next(error);
    }
  });

  // Add file upload endpoint with improved error handling
  app.post("/api/attachments", upload.array("files", 5), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        throw new AppError('No files uploaded', 400);
      }

      const uploadedFiles = req.files.map(file => ({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/${file.filename}`
      }));

      debug(req, 'Files uploaded successfully:', uploadedFiles);
      res.status(201).json(uploadedFiles);
    } catch (error) {
      debug(req, 'Error uploading files:', error);
      next(error);
    }
  });

  // Add PUT endpoint for updating requests
  app.put("/api/requests/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const requestId = parseInt(req.params.id);
      const updateData = req.body;

      debug(req, 'Updating request:', { requestId, updateData });

      // Verify the request exists and belongs to the user
      const [existingRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(and(
          eq(purchaseRequests.id, requestId),
          eq(purchaseRequests.requesterId, req.user!.id)
        ))
        .limit(1);

      if (!existingRequest) {
        throw new AppError('Request not found or unauthorized', 404);
      }

      // Prevent updates to locked requests unless it's a status update from an approver
      if (existingRequest.isLocked &&
        updateData.status !== 'changes_requested' &&
        req.user!.role !== 'approver') {
        throw new AppError('Request is locked', 403);
      }

      // Enhanced validation for submissions
      if (updateData.status === 'pending') {
        const validationErrors = [];

        if (!existingRequest.vendorId) {
          validationErrors.push('Vendor selection is required before submitting');
        }
        if (!existingRequest.items || existingRequest.items.length === 0) {
          validationErrors.push('At least one item is required');
        }
        if (!existingRequest.title?.trim()) {
          validationErrors.push('Title is required');
        }
        if (!existingRequest.description?.trim()) {
          validationErrors.push('Description is required');
        }
        if (!existingRequest.purposeType) {
          validationErrors.push('Purpose type is required');
        }

        if (validationErrors.length > 0) {
          const error = new ValidationError('Validation failed', { errors: validationErrors });

          // Analyze validation errors
          const analysis = await analyzeError(error, {
            requestData: updateData,
            validationErrors,
            userId: req.user!.id,
            requestId
          });

          // Log error with analysis
          await db.insert(errorLogs).values({
            message: error.message,
            severity: 'error',
            userId: req.user!.id,
            details: { validationErrors },
            aiAnalysis: analysis,
            path: req.path,
            createdAt: new Date()
          });

          throw error;
        }
      }

      // Update the request with proper validation
      const [updatedRequest] = await db
        .update(purchaseRequests)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(purchaseRequests.id, requestId))
        .returning();

      // If transitioning to pending, create notification for approvers
      if (updateData.status === 'pending') {
        const approvers = await db
          .select()
          .from(users)
          .where(and(
            eq(users.role, 'approver'),
            eq(users.isActive, true)
          ));

        await Promise.all(approvers.map(approver =>
          createNotification(
            approver.id,
            'New Purchase Request',
            `A new purchase request "${updatedRequest.title}" requires your approval`,
            'request',
            updatedRequest.id
          )
        ));
      }

      debug(req, 'Request updated successfully:', updatedRequest);
      res.json(updatedRequest);
    } catch (error) {
      debug(req, 'Error updating request:', error);

      // Analyze unexpected errors
      if (!(error instanceof ValidationError)) {
        const analysis = await analyzeError(error as Error, {
          requestId: req.params.id,
          userId: req.user?.id,
          path: req.path
        });

        // Log unexpected errors with analysis
        await db.insert(errorLogs).values({
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
          userId: req.user?.id,
          path: req.path,
          aiAnalysis: analysis,
          createdAt: new Date()
        });
      }

      next(error);
    }
  });

  // Enhanced sub-purpose creation endpoint
  app.post("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      debug(req, 'Creating new sub-purpose - Raw request body:', req.body);

      const validPurposeTypes = ["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"];
      const purposeType = req.body.purposeType || req.body.purpose_type;

      if (!purposeType || !validPurposeTypes.includes(purposeType)) {
        throw new ValidationError('Invalid purpose type', {
          details: {
            allowed: validPurposeTypes,
            received: purposeType
          }
        });
      }

      // Parse and validate dates
      const validFrom = req.body.validFrom || req.body.valid_from;
      const validTo = req.body.validTo || req.body.valid_to;

      const requestData = {
        name: req.body.name,
        purpose_type: purposeType,
        is_frozen: req.body.isFrozen || req.body.is_frozen || false,
        valid_from: validFrom ? new Date(validFrom) : null,
        valid_to: validTo ? new Date(validTo) : null,
        created_at: new Date(),
        updated_at: new Date()
      };

      debug(req, 'Transformed request data:', requestData);

      // Validate the data
      const [newSubPurpose] = await db
        .insert(subPurposes)
        .values(requestData)
        .returning();

      debug(req, 'Successfully created sub-purpose:', newSubPurpose);
      res.json(newSubPurpose);
    } catch (error) {
      debug(req, 'Error creating sub-purpose:', error);
      next(error);
    }
  });

  // Add user management endpoint
  app.get("/api/admin/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      debug(req, 'Fetching users');

      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          department: users.department,
          role: users.role,
          contact_number: users.contact_number,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      debug(req, `Found ${allUsers.length} users`);
      res.json(allUsers);
    } catch (error) {
      debug(req, 'Error fetching users:', error);
      next(error);
    }
  });

  // Enhanced approvers endpoint with proper query building
  app.get("/api/approvers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { department } = req.query;
      debug(req, 'Fetching approvers', { department });

      let query = db
        .select({
          id: purchaseApprovers.id,
          departmentId: purchaseApprovers.departmentId,
          approverId: purchaseApprovers.approverId,
          isMandatory: purchaseApprovers.isMandatory,
          level: purchaseApprovers.level,
          approver: {
            id: users.id,
            username: users.username,
            email: users.email,
            department: users.department,
          },
        })
        .from(purchaseApprovers)
        .innerJoin(users, eq(users.id, purchaseApprovers.approverId))
        .where(eq(users.isActive, true));

      if (department) {
        query = query.where(eq(purchaseApprovers.departmentId, department as string));
      }

      const approvers = await query.orderBy(purchaseApprovers.level);
      debug(req, `Found ${approvers.length} approvers`);
      res.json(approvers);
    } catch (error) {
      debug(req, 'Error fetching approvers:', error);
      next(new DatabaseError('Failed to fetch approvers'));
    }
  });

  // Account Request endpoint with proper error handling (already included above)

  // Add better error handling for request fetching
  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Fetching requests with filters:', req.query);

      // Build query conditions based on filters
      const queryConditions = [];

      // Add status filter
      if (req.query.status) {
        const statuses = Array.isArray(req.query.status)
          ? req.query.status
          : [req.query.status];
        queryConditions.push(inArray(purchaseRequests.status, statuses as string[]));
      }

      // Add department filter
      if (req.query.department) {
        const departments = Array.isArray(req.query.department)
          ? req.query.department
          : [req.query.department];
        queryConditions.push(inArray(purchaseRequests.department, departments as string[]));
      }

      // Add date range filter
      if (req.query.startDate) {
        queryConditions.push(
          gte(purchaseRequests.createdAt, new Date(req.query.startDate as string))
        );
      }
      if (req.query.endDate) {
        queryConditions.push(
          lte(purchaseRequests.createdAt, new Date(req.query.endDate as string))
        );
      }

      // Execute query with proper error handling
      try {
        const requests = await db
          .select({
            id: purchaseRequests.id,
            title: purchaseRequests.title,
            status: purchaseRequests.status,
            createdAt: purchaseRequests.createdAt,
            requesterId: purchaseRequests.requesterId,
            // Add other fields as needed
          })
          .from(purchaseRequests)
          .where(queryConditions.length > 0 ? and(...queryConditions) : undefined)
          .orderBy(desc(purchaseRequests.createdAt));

        debug(req, `Found ${requests.length} requests matching filters`);
        res.json(requests);
      } catch (dbError) {
        debug(req, 'Database error while fetching requests:', dbError);
        throw new DatabaseError('Failed to fetch requests from database');
      }
    } catch (error) {
      debug(req, 'Error in /api/requests:', error);
      next(error);
    }
  });

  // Add better error handling for single request fetching
  app.get("/api/requests/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        throw new ValidationError('Invalid request ID', { id: 'Must be a number' });
      }

      debug(req, 'Fetching request details:', requestId);

      try {
        const [request] = await db
          .select({
            id: purchaseRequests.id,
            title: purchaseRequests.title,
            status: purchaseRequests.status,
            description: purchaseRequests.description,
            createdAt: purchaseRequests.createdAt,
            requesterId: purchaseRequests.requesterId,
            // Add other fields as needed
          })
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        if (!request) {
          throw new AppError('Request not found', 404);
        }

        debug(req, 'Found request:', request.id);
        res.json(request);
      } catch (dbError) {
        debug(req, 'Database error while fetching request:', dbError);
        throw new DatabaseError('Failed to fetch request details from database');
      }
    } catch (error) {
      debug(req, 'Error in /api/requests/:id:', error);
      next(error);
    }
  });

  // Update the GET /api/requests endpoint

  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Fetching requests with filters:', req.query);

      // Build filter conditions
      const whereConditions = [];

      // Date range filter
      if (req.query.dateFrom || req.query.dateTo) {
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : null;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : null;

        if (dateFrom && dateTo) {
          whereConditions.push(and(
            gte(purchaseRequests.createdAt, dateFrom),
            lte(purchaseRequests.createdAt, dateTo)
          ));
        } else if (dateFrom) {
          whereConditions.push(gte(purchaseRequests.createdAt, dateFrom));
        } else if (dateTo) {
          whereConditions.push(lte(purchaseRequests.createdAt, dateTo));
        }
      }

      // Department filter
      if (req.query.department) {
        whereConditions.push(eq(users.department, req.query.department as string));
      }

      // Vendor filter
      if (req.query.vendor) {
        whereConditions.push(eq(purchaseRequests.vendorId, parseInt(req.query.vendor as string)));
      }

      // Purpose filter
      if (req.query.purpose) {
        whereConditions.push(eq(purchaseRequests.purposeType, req.query.purpose as string));
      }

      // Sub-purpose filter
      if (req.query.subPurpose) {
        whereConditions.push(eq(purchaseRequests.subPurposeId, parseInt(req.query.subPurpose as string)));
      }

      // Status filter (including rejected/approved)
      if (req.query.status) {
        const statuses = (req.query.status as string).split(',');
        whereConditions.push(inArray(purchaseRequests.status, statuses));
      }

      // Get all requests with requester information and filters
      const requests = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          requesterId: purchaseRequests.requesterId,
          title: purchaseRequests.title,
          description: purchaseRequests.description,
          status: purchaseRequests.status,
          items: purchaseRequests.items,
          totalEstimatedCost: purchaseRequests.totalEstimatedCost,
          createdAt: purchaseRequests.createdAt,
          updatedAt: purchaseRequests.updatedAt,
          purposeType: purchaseRequests.purposeType,
          priority: purchaseRequests.priority,
          isLocked: purchaseRequests.isLocked,
          vendorId: purchaseRequests.vendorId,
          subPurposeId: purchaseRequests.subPurposeId,
          requester: {
            id: users.id,
            username: users.username,
            email: users.email,
            department: users.department,
            role: users.role,
            contact_number: users.contact_number
          }
        })
        .from(purchaseRequests)
        .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(purchaseRequests.createdAt));

      debug(req, 'Raw requests data:', JSON.stringify(requests, null, 2));

      // Parse JSON fields and get additional details for each request
      const requestsWithDetails = await Promise.all(requests.map(async (request) => {
        // Get attachments for this request
        const attachments = await db
          .select()
          .from(fileAttachments)
          .where(eq(fileAttachments.requestId, request.id));

        // Get approvals for this request
        const requestApprovals = await db
          .select()
          .from(approvals)
          .where(eq(approvals.requestId, request.id));

        // Get vendor details if vendorId exists
        let vendorDetails = null;
        if (request.vendorId) {
          const [vendor] = await db
            .select()
            .from(vendors)
            .where(eq(vendors.id, request.vendorId))
            .limit(1);
          vendorDetails = vendor;
        }

        // Get sub-purpose details if subPurposeId exists
        let subPurposeDetails = null;
        if (request.subPurposeId) {
          const [subPurpose] = await db
            .select()
            .from(subPurposes)
            .where(eq(subPurposes.id, request.subPurposeId))
            .limit(1);
          subPurposeDetails = subPurpose;
        }

        // Parse JSON fields
        return {
          ...request,
          items: typeof request.items === 'string' ? JSON.parse(request.items) : request.items,
          attachments: attachments || [],
          approvals: requestApprovals || [],
          vendor: vendorDetails,
          subPurpose: subPurposeDetails
        };
      }));

      debug(req, `Found ${requestsWithDetails.length} requests after filtering`);
      return res.json(requestsWithDetails);
    } catch (error) {
      debug(req, 'Error fetching requests:', error);
      next(error);
    }
  });

  // Add approval endpoint with proper validation and mandatory approver logic - UPDATED
  app.post("/api/requests/:requestId/approvals", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      if (!req.user || !req.user.id) {
        throw new AppError('Invalid user session', 401);
      }

      const requestId = parseInt(req.params.requestId);
      const { status, department, comments } = req.body;

      debug(req, 'Creating approval with data:', {
        requestId,
        status,
        comments,
        department,
        userId: req.user.id
      });

      // Validate required fields
      if (!requestId || !status || !department) {
        throw new ValidationError('Missing required fields', {
          message: 'requestId, status, and department are required'
        });
      }

      // Check if request exists and getrequester info
      const [request] = await db
        .select({
          id: purchaseRequests.id,
          requesterId: purchaseRequests.requesterId,
          title: purchaseRequests.title,
          status: purchaseRequests.status,
          isLocked: purchaseRequests.isLocked
        })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);
      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Check if request is already finalized
      if (request.status === 'approved' || request.status === 'rejected') {
        throw new AppError('Request is already finalized', 400);
      }

      // Check if request is locked
      if (request.isLocked && status !== 'changes_requested') {
        throw new AppError('Request is locked', 403);
      }

      // Create the approval record
      const [approval] = await db
        .insert(approvals)
        .values({
          requestId,
          approverId: req.user.id,
          status,
          comments: comments || null,
          department,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      debug(req, 'Approval created successfully:', {
        approvalId: approval.id,
        requestStatus: request.status,
        isLocked: request.isLocked
      });

      res.status(201).json({
        ...approval,
        message: `Approval submitted successfully`
      });
    } catch (error) {
      debug(req, 'Error creating approval:', error);
      next(error);
    }
  });

  // Account requests management (already included above)
  app.post("/api/admin/account-requests/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const requestId = parseInt(req.params.id);

      // Find the account request
      const [accountRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.id, requestId))
        .limit(1);

      if (!accountRequest) {
        throw new AppError('Account request not found', 404);
      }

      if (accountRequest.status !== 'pending') {
        throw new AppError('Account request is not pending', 400);
      }

      // Check if username already exists in users table
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, accountRequest.username))
        .limit(1);

      if (existingUser) {
        throw new AppError('Username already exists', 400);
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          username: accountRequest.username,
          password: accountRequest.password, // // Password is already properly hashed
          email: accountRequest.email,
          contact_number: accountRequest.contact_number,
          department: accountRequest.department,
          role: accountRequest.role,
          isActive: true
        })
        .returning();

      // Update request status
      await db
        .update(accountRequests)
        .set({ status: 'approved' })
        .where(eq(accountRequests.id, requestId));

      res.json({ message: 'Account request approved',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          department: newUser.department,
          role: newUser.role
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/account-requests/:id/reject", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const requestId = parseInt(req.params.id);

      // Update request status
      const [updatedRequest] = await db
        .update(accountRequests)
        .set({ status: 'rejected' })
        .where(eq(accountRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        throw new AppError('Account request not found', 404);
      }

      res.json({ message: 'Account request rejected' });
    } catch (error) {
      next(error);
    }
  });

  // Add vendor management routes to the existing routes
  app.get("/api/vendors", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Fetching vendors');

      const allVendors = await db
        .select()
        .from(vendors)
        .orderBy(desc(vendors.createdAt));

      debug(req, `Found ${allVendors.length} vendors`);
      res.json(allVendors);
    } catch (error) {
      debug(req, 'Error fetching vendors:', error);
      next(error);
    }
  });
  app.post("/api/vendors", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Creating new vendor - Raw request body:', req.body);

      // Validate vendor data
      const validationResult = insertVendorSchema.safeParse(req.body);

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationResult.error.format()
        });
      }

      // Check if vendor with same name already exists
      const [existingVendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.companyName, validationResult.data.companyName))
        .limit(1);

      if (existingVendor) {
        return res.status(400).json({
          message: 'Vendor with this company name already exists'
        });
      }

      // Create new vendor
      const [newVendor] = await db
        .insert(vendors)
        .values({
          ...validationResult.data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      debug(req, 'Successfully created vendor:', newVendor);
      res.status(201).json(newVendor);
    } catch (error) {
      debug(req, 'Error creating vendor:', error);
      next(error);
    }
  });

  app.get("/api/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const vendorId = parseInt(req.params.id);
      debug(req, `Fetching vendor details for ID: ${vendorId}`);

      if (isNaN(vendorId)) {
        throw new ValidationError('Invalid vendor ID', { id: 'Must be a number' });
      }

      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);

      if (!vendor) {
        throw new AppError('Vendor not found', 404);
      }

      debug(req, 'Found vendor:', vendor);
      res.json(vendor);
    } catch (error) {
      debug(req, 'Error fetching vendor:', error);
      next(error);
    }
  });

  // Add password update endpoint after the account requests management section
  app.post("/api/admin/users/:id/update-password", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);
      const { password } = req.body;

      if (!password || password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters');
      }

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password
      const [updatedUser] = await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      res.json({
        message: 'Password updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          updatedAt: updatedUser.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Add role update endpoint after the account requests management section
  app.post("/api/admin/users/:id/update-role", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!role || !['user', 'approver', 'admin'].includes(role)) {
        throw new ValidationError('Invalid role specified');
      }

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Update user role
      const [updatedUser] = await db
        .update(users)
        .set({ role: role })
        .where(eq(users.id, userId))
        .returning();

      res.json({
        message: 'User role updated successfully',
        user: updatedUser
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/users/:id/toggle-activation", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Update user status
      const [updatedUser] = await db
        .update(users)
        .set({ isActive: isActive })
        .where(eq(users.id, userId))
        .returning();

      res.json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: updatedUser
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/users/:id/check-deletion", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if user has any associated purchase requests
      const [purchaseRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.requesterId, userId))
        .limit(1);

      const canDelete = !purchaseRequest;
      const reason = purchaseRequest
        ? 'Cannot delete user with associated purchase requests. Please deactivate instead.'
        : null;

      res.json({ canDelete, reason });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if user can be deleted
      const [purchaseRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.requesterId, userId))
        .limit(1);

      if (purchaseRequest) {
        throw new AppError(
          'Cannot delete user with associated purchase requests. Please deactivate instead.',
          400
        );
      }

      // Delete user
      const [deletedUser] = await db
        .delete(users)
        .where(eq(users.id, userId))
        .returning();

      res.json({
        message: 'User deleted successfully',
        user: deletedUser
      });
    } catch (error) {
      next(error);
    }
  });

  // Get company branding settings
  // app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated()) {
  //       throw new AppError('Not authenticated', 401);
  //     }
  //
  //     // Only admins can access branding settings
  //     if (req.user?.role !== 'admin') {
  //       throw new AppError('Admin access required', 403);
  //     }
  //
  //     const [settings] = await db
  //       .select()
  //       .from(companyBranding)
  //       .orderBy(desc(companyBranding.updatedAt))
  //       .limit(1);
  //
  //     res.json(settings || null);
  //   } catch (error) {
  //     next(error);
  //   }
  // });
  //
  // Add POST endpoint for updating branding with enhanced file handling
  // app.post("/api/branding", upload.fields([
  //   { name: 'logo', maxCount: 1 },
  //   { name: 'headerImage', maxCount: 1 },
  //   { name: 'footerImage', maxCount: 1 }
  // ]), async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated() || req.user?.role !== 'admin') {
  //       throw new AppError('Admin access required', 403);
  //     }
  //
  //     const formData = req.body;
  //     const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  //
  //     // Process uploaded files
  //     const processFile = (fieldName: string) => {
  //       const file = files[fieldName]?.[0];
  //       if (!file) return null;
  //       return file.buffer.toString('base64');
  //     };
  //
  //     // Parse JSON strings back to objects
  //     if (typeof formData.headerConfig === 'string') {
  //       formData.headerConfig = JSON.parse(formData.headerConfig);
  //     }
  //     if (typeof formData.footerConfig === 'string') {
  //       formData.footerConfig = JSON.parse(formData.footerConfig);
  //     }
  //
  //     // Add file data to form data
  //     const logo = processFile('logo');
  //     const headerImage = processFile('headerImage');
  //     const footerImage = processFile('footerImage');
  //
  //     const brandingData = {
  //       companyName: formData.companyName,
  //       description: formData.description,
  //       primaryColor: formData.primaryColor,
  //       secondaryColor: formData.secondaryColor,
  //       accentColor: formData.accentColor,
  //       fontFamily: formData.fontFamily,
  //       theme: formData.theme,
  //       headerConfig: formData.headerConfig,
  //       footerConfig: formData.footerConfig,
  //       logo: logo || formData.logo,
  //       logoMimeType: files.logo?.[0]?.mimetype || formData.logoMimeType,
  //       headerImage: headerImage || formData.headerImage,
  //       headerImageMimeType: files.headerImage?.[0]?.mimetype || formData.headerImageMimeType,
  //       footerImage: footerImage || formData.footerImage,
  //       footerImageMimeType: files.footerImage?.[0]?.mimetype || formData.footerImageMimeType,
  //       updatedAt: new Date()
  //     };
  //
  //     // Get existing branding record if any
  //     const [existingBranding] = await db
  //       .select()
  //       .from(companyBranding)
  //       .orderBy(desc(companyBranding.updatedAt))
  //       .limit(1);
  //
  //     let updatedBranding;
  //
  //     if (existingBranding) {
  //       [updatedBranding] = await db
  //         .update(companyBranding)
  //         .set(brandingData)
  //         .where(eq(companyBranding.id, existingBranding.id))
  //         .returning();
  //     } else {
  //       [updatedBranding] = await db
  //         .insert(companyBranding)
  //         .values({
  //           ...brandingData,
  //           createdAt: new Date()
  //         })
  //         .returning();
  //     }
  //
  //     res.json(updatedBranding);
  //   } catch (error) {
  //     next(error);
  //   }
  // });
  //
  // Get notifications endpoint
  app.get("/api/notifications", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user!.id))
        .orderBy(desc(notifications.createdAt));

      res.json(userNotifications);
    } catch (error) {
      next(error);
    }
  });

  // Mark notification as read endpoint
  app.put("/api/notifications/:id/read", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const notificationId = parseInt(req.params.id);

      // Verify notification belongs to user
      const [notification] = await db
        .select()
        .from(notifications)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, req.user!.id)
        ))
        .limit(1);

      if (!notification) {
        throw new AppError('Notification not found', 404);
      }

      // Update notification
      await db
                .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId));

      res.json({ message: 'Notification markedas read' });
    } catch (error) {
      next(error);    }
  });

  // Add request export endpoint with proper TypeScript typing
  app.get("/api/requests/export", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const format = req.query.format as string;
if (!format || !['xlsx', 'csv'].includes(format)) {
        throw new ValidationError('Invalid format', { format: 'Must be xlsx or csv' });
      }

      debug(req, 'Exporting requests in format:', format);

      // Fetch all requests with related data
      const requests = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          title: purchaseRequests.title,
          description: purchaseRequests.description,
          status: purchaseRequests.status,
          priority: purchaseRequests.priority,
          purposeType: purchaseRequests.purposeType,
          totalEstimatedCost: purchaseRequests.totalEstimatedCost,
          createdAt: purchaseRequests.createdAt,
          updatedAt: purchaseRequests.updatedAt,
        })
        .from(purchaseRequests)
        .orderBy(desc(purchaseRequests.createdAt));

      if (requests.length === 0) {
        throw new AppError('No requests found to export', 404);
      }

      // Transform dates and format data
      const formattedRequests = requests.map(request => ({
        'Request ID': request.id,
        'Request Number': request.requestNumber || '',
        'Title': request.title || '',
        'Description': request.description || '',
        'Status': request.status || '',
        'Priority': request.priority || '',
        'Purpose Type': request.purposeType || '',
        'Total Cost': request.totalEstimatedCost ? `${request.totalEstimatedCost.toFixed(2)}` : '0.00',
        'Created Date': request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '',
        'Last Updated': request.updatedAt ? new Date(request.updatedAt).toLocaleDateString() : ''
      }));

      const filename = `purchase_requests_${new Date().toISOString().split('T')[0]}`;

      // Set response headers for download
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      if (format === 'csv') {
        // Generate CSV
        const fields = Object.keys(formattedRequests[0]);
        const csv = [
          fields.join(','), // Header row
          ...formattedRequests.map(row =>
            fields.map(field => {
              const value = row[field as keyof typeof row];
              // Properly escape and quote values containing commas or quotes
              return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                ? `"${value.replace(/"/g, '""')}"` // Escape quotes by doubling them
                : value;
            }).join(',')
          )
        ].join('\n');

        res.set({
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        });

        return res.send(csv);
      } else {
        // Generate Excel
        const worksheet = XLSX.utils.json_to_sheet(formattedRequests);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Requests');

        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
          'Content-Length': excelBuffer.length
        });

        return res.send(Buffer.from(excelBuffer));
      }
    } catch (error) {
      debug(req, 'Error exporting requests:', error);
      next(error);
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}

// Helper function for analyzing errors
async function analyzeError(error: Error, context: any) {
  return {
    timestamp: new Date().toISOString(),
    errorType: error.constructor.name,
    message: error.message,
    context
  };
}

async function updateRequestStatus(requestId: number) {
  try {
    const approvalsList = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    const mandatoryApprovals = approvalsList.filter(a => a.isMandatory);
    const allApproved = mandatoryApprovals.every(a => a.status === 'approved');
    const allRejected = mandatoryApprovals.every(a => a.status === 'rejected');
    const anyChangesRequested = mandatoryApprovals.some(a => a.status === 'changes_requested');

    let newStatus: string;
    if (allApproved) {
      newStatus = 'approved';
    } else if (allRejected) {
      newStatus = 'rejected';
    } else if (anyChangesRequested) {
      newStatus = 'changes_requested';
    } else {
      newStatus = 'pending';
    }

    await db
      .update(purchaseRequests)
      .set({ status: newStatus })
      .where(eq(purchaseRequests.id, requestId));
  } catch (error) {
    console.error('Error updating request status:', error);
    throw error;
  }
}