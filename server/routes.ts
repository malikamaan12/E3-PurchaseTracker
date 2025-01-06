import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import path from "path";
import { setupAuth } from "./auth";
import { upload } from "./utils/upload";
import { debug } from "./utils/debug";
import {
  getNotifications,
  markNotificationAsRead,
  createNotification
} from "./utils/notifications";
import {
  users,
  notifications,
  purchaseRequests,
  approvals,
  fileAttachments,
  vendors,
  errorLogs,
  subPurposes,
  accountRequests,
  insertPurchaseRequestSchema,
  insertAccountRequestSchema,
  insertErrorLogSchema,
  companyBranding,
  insertCompanyBrandingSchema,
  notificationPreferences,
  insertNotificationPreferenceSchema,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES
} from "@db/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import express from 'express';
import bcrypt from 'bcrypt';

// Error Classes
class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

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

export function registerRoutes(app: Express): Server {
  // Setup static files serving first
  app.use('/uploads', express.static('uploads'));

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

      const notifications = await getNotifications(req.user!.id, lastFetchTime);
      res.json(notifications);
    } catch (error) {
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

      const updatedNotification = await markNotificationAsRead(notificationId, req.user!.id);
      res.json(updatedNotification);
    } catch (error) {
      next(error);
    }
  });

  // Add after the existing notification endpoints
  app.get("/api/notification-preferences/metadata", (_req: Request, res: Response) => {
    res.json({
      categories: NOTIFICATION_CATEGORIES,
      types: NOTIFICATION_TYPES
    });
  });

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
        const defaultPreferences = Object.values(NOTIFICATION_CATEGORIES).flatMap(category =>
          Object.values(NOTIFICATION_TYPES)
            .filter(type => type.startsWith(category.split('_')[0].toLowerCase()))
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
      next(error);
    }
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
      next(error);
    }
  });
  // Test route to verify API is working
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
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
  app.get("/api/subpurposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { purposeType } = req.query;
      console.log('[SubPurposes API] Request received:', { purposeType });

      let query = db
        .select({
          id: subPurposes.id,
          name: subPurposes.name,
          purpose_type: subPurposes.purpose_type,
          is_frozen: subPurposes.is_frozen,
          created_at: subPurposes.created_at,
          updated_at: subPurposes.updated_at
        })
        .from(subPurposes)
        .orderBy(desc(subPurposes.created_at));

      if (purposeType) {
        query = query.where(eq(subPurposes.purpose_type, purposeType as string));
      }

      const results = await query;
      console.log('[SubPurposes API] Found results:', results.length);

      // Format the response
      const formattedResults = results.map(sp => ({
        id: sp.id,
        name: sp.name,
        purpose_type: sp.purpose_type,
        is_frozen: sp.is_frozen,
        created_at: sp.created_at ? new Date(sp.created_at).toISOString() : null,
        updated_at: sp.updated_at ? new Date(sp.updated_at).toISOString() : null
      }));

      res.json(formattedResults);
    } catch (error) {
      console.error('[SubPurposes API] Error:', error);
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
      res.status(201).json(newSubPurpose);
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

      // Parse JSON fields and get approvals for each request
      const requestsWithDetails = await Promise.all(requests.map(async (request) => {
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
      const { status, comments, department } = req.body;

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

      // Check if request exists and get requester info
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
        .values({          requestId,
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
  app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      // Only admins can access branding settings
      if (req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const [settings] = await db
        .select()
        .from(companyBranding)
        .orderBy(desc(companyBranding.updatedAt))
        .limit(1);

      res.json(settings || null);
    } catch (error) {
      next(error);
    }
  });

  // Add POST endpoint for updating branding with enhanced file handling
  app.post("/api/branding", upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'headerImage', maxCount: 1 },
    { name: 'footerImage', maxCount: 1 }
  ]), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const formData = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Process uploaded files
      const processFile = (fieldName: string) => {
        const file = files[fieldName]?.[0];
        if (!file) return null;
        return file.buffer.toString('base64');
      };

      // Parse JSON strings back to objects
      if (typeof formData.headerConfig === 'string') {
        formData.headerConfig = JSON.parse(formData.headerConfig);
      }
      if (typeof formData.footerConfig === 'string') {
        formData.footerConfig = JSON.parse(formData.footerConfig);
      }

      // Add file data to form data
      const logo = processFile('logo');
      const headerImage = processFile('headerImage');
      const footerImage = processFile('footerImage');

      const brandingData = {
        companyName: formData.companyName,
        description: formData.description,
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        accentColor: formData.accentColor,
        fontFamily: formData.fontFamily,
        theme: formData.theme,
        headerConfig: formData.headerConfig,
        footerConfig: formData.footerConfig,
        logo: logo || formData.logo,
        logoMimeType: files.logo?.[0]?.mimetype || formData.logoMimeType,
        headerImage: headerImage || formData.headerImage,
        headerImageMimeType: files.headerImage?.[0]?.mimetype || formData.headerImageMimeType,
        footerImage: footerImage || formData.footerImage,
        footerImageMimeType: files.footerImage?.[0]?.mimetype || formData.footerImageMimeType,
        updatedAt: new Date()
      };

      // Get existing branding record if any
      const [existingBranding] = await db
        .select()
        .from(companyBranding)
        .orderBy(desc(companyBranding.updatedAt))
        .limit(1);

      let updatedBranding;

      if (existingBranding) {
        [updatedBranding] = await db
          .update(companyBranding)
          .set(brandingData)
          .where(eq(companyBranding.id, existingBranding.id))
          .returning();
      } else {
        [updatedBranding] = await db
          .insert(companyBranding)
          .values({
            ...brandingData,
            createdAt: new Date()
          })
          .returning();
      }

      res.json(updatedBranding);
    } catch (error) {
      next(error);
    }
  });

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

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  });

  // Add mood board generation endpoint
  app.post("/api/branding/generate-mood-board", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const { companyName, primaryColor, secondaryColor, accentColor } = req.body;

      if (!companyName || !primaryColor) {
        throw new ValidationError('Company name and primary color are required');
      }

      const prompt = `Create a brand mood board for a company named "${companyName}". 
        The brand colors are:
        - Primary: ${primaryColor}
        - Secondary: ${secondaryColor || 'not specified'}
        - Accent: ${accentColor || 'not specified'}

        Generate a mood board that reflects the company's brand identity, incorporating these colors
        and creating a cohesive visual theme. The mood board should include elements that represent
        the brand's personality and values.`;

      const message = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: prompt
        }],
      });

      const suggestions = message.content[0].text;

      res.json({
        success: true,
        suggestions,
        moodBoard: {
          companyName,
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
            accent: accentColor
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  });

  // Add to the existing routes
  app.post("/api/error-logs", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Logging error:', req.body);

      const validationResult = insertErrorLogSchema.safeParse({
        ...req.body,
        userId: req.user?.id
      });

      if (!validationResult.success) {
        debug(req, 'Error log validation failed:', validationResult.error);
        throw new ValidationError('Invalid error log data', {
          errors: validationResult.error.errors
        });
      }

      // Analyze error with Claude if API key is available
      let aiAnalysis = null;
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          });

          const message = await anthropic.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 1024,
            messages: [{
              role: "user",
              content: `Analyze this error and suggest possible solutions:
                Error Message: ${validationResult.data.message}
                Error Code: ${validationResult.data.code || 'N/A'}
                Path: ${validationResult.data.path || 'N/A'}
                Details: ${JSON.stringify(validationResult.data.details || {}, null, 2)}
              `
            }]
          });

          aiAnalysis = {
            analysis: message.content,
            timestamp: new Date().toISOString()
          };
        } catch (aiError) {
          console.error('AI Analysis failed:', aiError);
        }
      }

      // Save error log with AI analysis
      const [errorLog] = await db
        .insert(errorLogs)
        .values({
          ...validationResult.data,
          aiAnalysis,
          createdAt: new Date()
        })
        .returning();

      debug(req, 'Error logged successfully:', errorLog);
      res.status(201).json(errorLog);
    } catch (error) {
      debug(req, 'Error logging error:', error);
      next(error);
    }
  });

  // Remove Redundant Branding Routes
  // app.get("/api/branding", ...); // Removed
  // app.post("/api/branding", ...); // Removed

  // Update the GET /api/requests/:id endpoint
  app.get("/api/requests/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const requestId = parseInt(req.params.id);

      // Get request with all related data
      const [request] = await db
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
          freightAmount: purchaseRequests.freightAmount,
          currency: purchaseRequests.currency
        })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Get vendor details if vendorId exists
      let vendor = null;
      if (request.vendorId) {
        const [vendorData] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, request.vendorId))
          .limit(1);
        vendor = vendorData;
      }

      // Get sub-purpose details if subPurposeId exists
      let subPurpose = null;
      if (request.subPurposeId) {
        const [subPurposeData] = await db
          .select()
          .from(subPurposes)
          .where(eq(subPurposes.id, request.subPurposeId))
          .limit(1);
        subPurpose = subPurposeData;
      }

      // Get approvals for this request
      const approvalsList = await db
        .select()
        .from(approvals)
        .where(eq(approvals.requestId, requestId));

      // Get attachments
      const attachmentsList = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.requestId, requestId));

      // Parse items JSON
      const items = typeof request.items === 'string' ? JSON.parse(request.items) : request.items;

      // Return complete response
      res.json({
        ...request,
        items,
        vendor,
        subPurpose,
        approvals: approvalsList,
        attachments: attachmentsList
      });

    } catch (error) {
      console.error('Error fetching request:', error);
      next(error);
    }
  });

  // Add new route for PDF download
  // Removed PDF generation endpoint

  // Add branding endpoint
  app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const [branding] = await db
        .select()
        .from(companyBranding)
        .orderBy(desc(companyBranding.updatedAt))
        .limit(1);

      if (!branding) {
        return res.json({
          companyName: 'Company Name',
          primaryColor: '#71569E',
          secondaryColor: '#F0F0FA',
          accentColor: '#191160',
          footerText: 'Confidential Document',
          logo: null,
          logoMimeType: null,
          headerImage: null,
          headerImageMimeType: null,
          footerImage: null,
          footerImageMimeType: null
        });
      }

      res.json(branding);
    } catch (error) {
      next(error);
    }
  });

  // Add branding management endpoints
  app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      debug(req, 'Fetching company branding data');

      const [brandingData] = await db
        .select()
        .from(companyBranding)
        .orderBy(desc(companyBranding.createdAt))
        .limit(1);

      if (!brandingData) {
        // Return default branding if none exists
        return res.json({
          companyName: "Events & Entertainment Enterprises",
          primaryColor: "#71569E",
          secondaryColor: "#F0F0FA",
          accentColor: "#191160",
          headerStyle: "modern",
          footerText: "Designed with ❤️ by E3",
          logo: null,
          logoMimeType: null,
          headerImageUrl: null,
          headerImageMimeType: null,
          footerImageUrl: null,
          footerImageMimeType: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      debug(req, 'Found branding data:', brandingData);
      res.json(brandingData);
    } catch (error) {
      debug(req, 'Error fetching branding data:', error);
      next(error);
    }
  });

  app.post("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      debug(req, 'Creating/updating company branding');

      const validationResult = insertCompanyBrandingSchema.safeParse(req.body);

      if (!validationResult.success) {
        throw new ValidationError('Invalid branding data', validationResult.error.format());
      }

      // Create new branding record
      const [newBranding] = await db
        .insert(companyBranding)
        .values({
          ...validationResult.data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      debug(req, 'Branding updated successfully:', newBranding.id);
      res.status(201).json(newBranding);
    } catch (error) {
      debug(req, 'Error updating branding:', error);
      next(error);
    }
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);

    if (err instanceof ValidationError) {
      return res.status(400).json({
        message: err.message,
        details: err.details
      });
    }

    if (err instanceof DatabaseError) {
      return res.status(500).json({
        message: 'Database error occurred',
        error: err.message
      });
    }

    if (err instanceof AppError) {
      return res.status(err.status).json({
        message: err.message
      });
    }

    res.status(500).json({
      message: 'Internal server error',
      error: err.message
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}