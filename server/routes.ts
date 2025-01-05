import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import multer from "multer";
import path from "path";
import { setupAuth } from "./auth";
import express from 'express';
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
  companyBranding,
  insertPurchaseRequestSchema,
  insertAccountRequestSchema,
  insertErrorLogSchema,
  insertVendorSchema,
  type InsertVendor
} from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { AppError, ValidationError } from './utils/errors';
import { analyzeError, analyzeFormSubmission } from './utils/error-analysis';
import { getNotifications, markNotificationAsRead, createNotification } from './utils/notifications';
import { hash } from 'bcrypt';
import { Anthropic } from '@anthropic-ai/sdk';

// Debug logging utility
function debug(req: Request, message: string, data?: any) {
  console.log(`[${req.method} ${req.path}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, PDF and Word documents are allowed.'));
      }
    }
  });

  // Enhanced branding endpoint with better error handling
  app.get("/api/branding/current", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const brandingResult = await db
        .select({
          company_name: companyBranding.company_name,
          header_style: companyBranding.header_style,
          primary_color: companyBranding.primary_color,
          secondary_color: companyBranding.secondary_color,
          accent_color: companyBranding.accent_color,
          logo: companyBranding.logo,
          logo_mime_type: companyBranding.logo_mime_type,
          header_image_url: companyBranding.header_image_url,
          header_image_mime_type: companyBranding.header_image_mime_type,
          footer_image_url: companyBranding.footer_image_url,
          footer_image_mime_type: companyBranding.footer_image_mime_type,
          footer_text: companyBranding.footer_text,
          created_at: companyBranding.created_at,
          updated_at: companyBranding.updated_at
        })
        .from(companyBranding)
        .orderBy(sql`${companyBranding.created_at} DESC`)
        .limit(1);

      const branding = brandingResult[0];

      if (!branding) {
        return res.json({
          company_name: "Events & Entertainment Enterprises",
          header_style: "modern",
          primary_color: "#71569E",
          secondary_color: "#F0F0FA",
          accent_color: "#191160",
          logo: null,
          logo_mime_type: null,
          header_image_url: null,
          header_image_mime_type: null,
          footer_image_url: null,
          footer_image_mime_type: null,
          footer_text: "Designed with ❤️ by E3"
        });
      }

      res.json(branding);
    } catch (error) {
      next(error);
    }
  });

  // Enhanced vendor routes
  app.get("/api/vendors", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const allVendors = await db
        .select()
        .from(vendors)
        .orderBy(sql`${vendors.created_at} DESC`);

      res.json(allVendors);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }
      const vendorId = parseInt(req.params.id);
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);

      if (!vendor) {
        throw new AppError('Vendor not found', 404);
      }

      res.json(vendor);
    } catch (error) {
      next(error);
    }
  });

  // Enhanced file upload and preview endpoints
  app.post("/api/attachments", upload.array("files", 5), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        throw new AppError('No files uploaded', 400);
      }

      const uploadedFiles = req.files.map(file => ({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/${file.filename}`,
        previewUrl: file.mimetype.startsWith('image/') ? `/uploads/${file.filename}` : null
      }));

      res.status(201).json(uploadedFiles);
    } catch (error) {
      next(error);
    }
  });

  // Serve uploaded files with proper headers for preview
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    const fileType = req.path.split('.').pop()?.toLowerCase();
    if (fileType === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    express.static('uploads')(req, res, next);
  });

  // Create purchase request endpoint with enhanced vendor detail handling
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const { data: requestData, action } = req.body;
      debug(req, 'Creating purchase request:', { action, requestData });

      const requestNumber = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let finalRequestData = {
        ...requestData,
        requestNumber,
        requesterId: req.user!.id,
        status: action === 'draft' ? 'draft' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: JSON.stringify(Array.isArray(requestData.items) ? requestData.items : [])
      };

      if (action === 'draft') {
        finalRequestData = {
          ...finalRequestData,
          items: finalRequestData.items || '[]',
          totalEstimatedCost: finalRequestData.totalEstimatedCost || 0,
          freightAmount: finalRequestData.freightAmount || 0
        };
      } else {
        const validationResult = insertPurchaseRequestSchema.safeParse({
          ...requestData,
          items: requestData.items || []
        });

        if (!validationResult.success) {
          return res.status(400).json({
            message: 'Invalid request data',
            errors: validationResult.error.format()
          });
        }
      }

      const [request] = await db
        .insert(purchaseRequests)
        .values(finalRequestData)
        .returning();

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

      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, request.vendorId))
        .limit(1);

      res.status(201).json({
        ...request,
        items: Array.isArray(requestData.items) ? requestData.items : [],
        vendor,
        message: `Request ${action === 'draft' ? 'saved as draft' : 'submitted'} successfully`
      });
    } catch (error) {
      next(error);
    }
  });

  // Enhanced approval workflow
  app.post("/api/requests/:requestId/approvals", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const requestId = parseInt(req.params.requestId);
      const { status, comments, department } = req.body;

      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Define mandatory departments
      const mandatoryDepartments = ['CEO Office', 'Director', 'Finance'];
      const isMandatoryApprover = mandatoryDepartments.includes(department);

      const [approval] = await db
        .insert(approvals)
        .values({
          requestId,
          approverId: req.user!.id,
          status,
          comments: comments || null,
          department,
          isMandatory: isMandatoryApprover,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Get all approvals for this request
      const allApprovals = await db
        .select()
        .from(approvals)
        .where(eq(approvals.requestId, requestId));

      // Check if all mandatory approvers have approved
      const mandatoryApprovals = allApprovals.filter(a =>
        mandatoryDepartments.includes(a.department)
      );

      const allMandatoryApproved = mandatoryDepartments.every(dept =>
        mandatoryApprovals.some(a => a.department === dept && a.status === 'approved')
      );

      // Update request status based on approvals
      let requestStatus = request.status;
      let isLocked = request.isLocked;

      if (status === 'rejected') {
        requestStatus = 'rejected';
        isLocked = true;
      } else if (status === 'changes_requested') {
        requestStatus = 'changes_requested';
        isLocked = false;
      } else if (allMandatoryApproved) {
        requestStatus = 'approved';
        isLocked = true;
      }

      if (requestStatus !== request.status || isLocked !== request.isLocked) {
        await db
          .update(purchaseRequests)
          .set({
            status: requestStatus,
            isLocked,
            updatedAt: new Date()
          })
          .where(eq(purchaseRequests.id, requestId));

        await createNotification(
          request.requesterId,
          `Request ${status}`,
          `Your request has been ${status} by ${department}${comments ? `: ${comments}` : ''}`,
          'request',
          requestId
        );
      }

      res.status(201).json({
        approval,
        requestStatus,
        isLocked
      });
    } catch (error) {
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
        .orderBy(sql`${subPurposes.created_at} DESC`);

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
        .orderBy(sql`${subPurposes.created_at} DESC`);

      debug(req, `Found ${allSubPurposes.length} sub-purposes`);
      res.json(allSubPurposes);
    } catch (error) {
      debug(req, 'Error fetching sub-purposes:', error);
      next(error);
    }
  });


  // Account requests management
  app.get("/api/admin/account-requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      debug(req, 'Fetching account requests...');
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
        .orderBy(sql`${accountRequests.createdAt} DESC`);

      debug(req, `Found ${accountRequestsResult.length} account requests`);
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

      console.log('Files uploaded successfully:', uploadedFiles);
      res.status(201).json(uploadedFiles);
    } catch (error) {
      console.error('Error uploading files:', error);
      next(error);
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

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

  // Add purpose types endpoint
  app.get("/api/purpose-types", (_req: Request, res: Response) => {
    const purposeTypes = ["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"];
    res.json(purposeTypes);
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
        .orderBy(sql`${users.createdAt} DESC`);

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
          id: approvals.id,
          department: approvals.department,
          approverId: approvals.approverId,
          isMandatory: approvals.isMandatory,
          level: approvals.level,
          approver: {
            id: users.id,
            username: users.username,
            email: users.email,
            department: users.department,
          },
        })
        .from(approvals)
        .innerJoin(users, eq(users.id, approvals.approverId))
        .where(eq(users.isActive, true));

      if (department) {
        query = query.where(eq(approvals.department, department as string));
      }

      const approvers = await query.orderBy(approvals.level);
      debug(req, `Found ${approvers.length} approvers`);
      res.json(approvers);
    } catch (error) {
      debug(req, 'Error fetching approvers:', error);
      next(new AppError('Failed to fetch approvers', 500));
    }
  });

  // Account Request endpoint
  app.post("/api/auth/request-account", async (req: Request, res: Response, next: NextFunction) => {
    try {
      debug(req, 'Received account request:', {
        ...req.body,
        password: '[REDACTED]'
      });

      // Transform the request data to match our schema
      const requestData = {
        ...req.body,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      debug(req, 'Validating request data');
      const validationResult = insertAccountRequestSchema.safeParse(requestData);

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      // Check for existing username
      const [existingRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.username, validationResult.data.username))
        .limit(1);

      if (existingRequest) {
        debug(req, 'Username already exists in requests');
        return res.status(400).json({
          message: 'An account request with this username already exists'
        });
      }

      // Check in users table
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, validationResult.data.username))
        .limit(1);

      if (existingUser) {
        debug(req, 'Username exists in users table');
        return res.status(400).json({
          message: 'Username already exists'
        });
      }

      // Hash password
      const hashedPassword = await hash(validationResult.data.password, 10);

      // Create request
      const [newRequest] = await db
        .insert(accountRequests)
        .values({
          ...validationResult.data,
          password: hashedPassword,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      debug(req, 'Account request created:', newRequest.id);

      // Get all admin users
      const admins = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'),
          eq(users.isActive, true)
        ));

      // Create notifications for admins
      const notificationPromises = admins.map(admin =>
        createNotification(
          admin.id,
          'New Account Request',
          `New account request from ${newRequest.username} for ${newRequest.department} department`,
          'account_request',
          newRequest.id
        )
      );

      // Send notifications asynchronously
      Promise.all(notificationPromises).catch(error => {
        console.error('Error creating notifications:', error);
      });

      res.status(201).json({
        message: 'Account request submitted successfully',
        requestId: newRequest.id
      });
    } catch (error) {
      debug(req, 'Error processing account request:', error);
      next(error);
    }
  });

  // Update the GET /api/requests endpoint
  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Fetching requests for user:', req.user!.id);

      // Get all requests with requester information
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
        .orderBy(sql`${purchaseRequests.createdAt} DESC`);

      debug(req, 'Raw requests data:', JSON.stringify(requests, null, 2));

      // Parse JSON fields and get approvals for each request
      const requestsWithDetails = await Promise.all(requests.map(async (request) => {
        // Get approvals for this request
        const requestApprovals = await db
          .select()
          .from(approvals)
          .where(eq(approvals.requestId, request.id));

        // Parse JSON fields
        return {
          ...request,
          items: typeof request.items === 'string' ? JSON.parse(request.items) : request.items,
          approvals: requestApprovals || []
        };
      }));

      debug(req, `Found ${requestsWithDetails.length} requests`);
      return res.json(requestsWithDetails);
    } catch (error) {
      debug(req, 'Error fetching requests:', error);
      next(error);
    }
  });

  // Add approval endpoint with proper validation and mandatory approver logic
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
        debug(req, 'Validation failed - missing fields:', { requestId, status, department });
        throw new ValidationError('Missing required fields: requestId, status, and department are required');
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

      // Define mandatory departments
      const mandatoryDepartments = ['CEO Office', 'Director', 'Finance'];
      const isMandatoryApprover = mandatoryDepartments.includes(department);

      // Check for existing approval from this department
      const [existingApproval] = await db
        .select()
        .from(approvals)
        .where(and(
          eq(approvals.requestId, requestId),
          eq(approvals.department, department)
        ))
        .limit(1);

      if (existingApproval) {
        throw new AppError('Department has already provided approval', 400);
      }

      // Create the approval record
      const [approval] = await db
        .insert(approvals)
        .values({
          requestId,
          approverId: req.user!.id,
          status,
          comments: comments || null,
          department,
          isMandatory: isMandatoryApprover,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Get all approvals for this request to check status
      const allApprovals = await db
        .select()
        .from(approvals)
        .where(eq(approvals.requestId, requestId));

      // Check if all mandatory approvers have approved
      const mandatoryApprovals = allApprovals.filter(a =>
        mandatoryDepartments.includes(a.department)
      );

      const allMandatoryApproved = mandatoryDepartments.every(dept =>
        mandatoryApprovals.some(a => a.department === dept && a.status === 'approved')
      );

      // Update request status based on approvals
      let requestStatus = request.status;
      let isLocked = request.isLocked;

      if (status === 'rejected') {
        requestStatus = 'rejected';
        isLocked = true;
      } else if (status === 'changes_requested') {
        requestStatus = 'changes_requested';
        isLocked = false;
      } else if (allMandatoryApproved) {
        requestStatus = 'approved';
        isLocked = true;
      }

      debug(req, 'Status update check:', {
        currentStatus: request.status,
        newStatus: requestStatus,
        currentlyLocked: request.isLocked,
        willBeLocked: isLocked
      });

      // Update request status if changed
      if (requestStatus !== request.status || isLocked !== request.isLocked) {
        await db
          .update(purchaseRequests)
          .set({
            status: requestStatus,
            isLocked,
            updatedAt: new Date()
          })
          .where(eq(purchaseRequests.id, requestId));

        // Create notification for the requester
        await createNotification(
          request.requesterId,
          `Request ${status}`,
          `Your request "${request.title}" has been ${status} by ${department}${comments ? `: ${comments}` : ''}`,
          'request',
          requestId
        );
      }

      debug(req, 'Approval created successfully:', {
        approvalId: approval.id,
        requestStatus,
        isLocked,
        statusChanged: requestStatus !== request.status
      });

      res.status(201).json({
        ...approval,
        requestStatus,
        isLocked,
        message: `Approval submitted successfully${requestStatus !== request.status ? `. Request status updated to ${requestStatus}` : ''}`
      });
    } catch (error) {
      debug(req, 'Error creating approval:', error);
      next(error);
    }
  });

  // Account requests management
  app.get("/api/admin/account-requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }
      debug(req, 'Fetching account requests...');
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
        .orderBy(sql`${accountRequests.createdAt} DESC`);

      debug(req, `Found ${accountRequestsResult.length} account requests`);
      res.json(accountRequestsResult);
    } catch (error) {
      debug(req, 'Error fetching account requests:', error);
      next(error);
    }
  });

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
          password: accountRequest.password, // Password is already properly hashed
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
        .orderBy(sql`${vendors.createdAt} DESC`);

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
      const hashedPassword = await hash(password, 10);

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
  app.get("/api/branding", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      debug(_req, 'Fetching company branding settings');

      const [settings] = await db
        .select({
          id: companyBranding.id,
          companyName: companyBranding.companyName,
          headerStyle: companyBranding.headerStyle,
          primaryColor: companyBranding.primaryColor,
          secondaryColor: companyBranding.secondaryColor,
          accentColor: companyBranding.accentColor,
          logo: companyBranding.logo,
          logoMimeType: companyBranding.logoMimeType,
          footerText: companyBranding.footerText,
          createdAt: companyBranding.createdAt,
          updatedAt: companyBranding.updatedAt
        })
        .from(companyBranding)
        .limit(1);

      if (!settings) {
        // Return default branding if no settings exist
        return res.json({
          companyName: 'Default Company',
          headerStyle: 'modern',
          primaryColor: '#71569E',
          secondaryColor: '#F0F0FA',
          accentColor: '#191160',
          logo: null,
          logoMimeType: null,
          footerText: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      debug(_req, 'Found branding settings:', settings);
      res.json(settings);
    } catch (error) {
      debug(_req, 'Error fetching branding settings:', error);
      next(error);
    }
  });

  // Add new route for analyzing form submission errors
  app.post("/api/analyze-submission", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Analyzing form submission error:', req.body);

      const { formData, error, formState } = req.body;

      // Use Claude to analyze the submission error
      const analysis = await analyzeFormSubmission({
        formData,
        error,
        formState,
        requestId: formData?.id,
        userId: req.user?.id
      });

      debug(req, 'Analysis result:', analysis);
      res.json(analysis);
    } catch (error) {
      debug(req, 'Error analyzing form submission:', error);
      next(error);
    }
  });


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

  // Add branding route handler
  app.get("/api/branding", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      debug(_req, 'Fetching company branding settings');

      const [settings] = await db
        .select({
          id: companyBranding.id,
          companyName: companyBranding.companyName,
          headerStyle: companyBranding.headerStyle,
          primaryColor: companyBranding.primaryColor,
          secondaryColor: companyBranding.secondaryColor,
          accentColor: companyBranding.accentColor,
          logo: companyBranding.logo,
          logoMimeType: companyBranding.logoMimeType,
          footerText: companyBranding.footerText,
          createdAt: companyBranding.createdAt,
          updatedAt: companyBranding.updatedAt
        })
        .from(companyBranding)
        .limit(1);

      if (!settings) {
        // Return default branding if no settings exist
        return res.json({
          companyName: 'Default Company',
          headerStyle: 'modern',
          primaryColor: '#71569E',
          secondaryColor: '#F0F0FA',
          accentColor: '#191160',
          logo: null,
          logoMimeType: null,
          footerText: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      debug(_req, 'Found branding settings:', settings);
      res.json(settings);
    } catch (error) {
      debug(_req, 'Error fetching branding settings:', error);
      next(error);
    }
  });

  // Add new route for analyzing form submission errors
  app.post("/api/analyze-submission", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Analyzing form submission error:', req.body);

      const { formData, error, formState } = req.body;

      // Use Claude to analyze the submission error
      const analysis = await analyzeFormSubmission({
        formData,
        error,
        formState,
        requestId: formData?.id,
        userId: req.user?.id
      });

      debug(req, 'Analysis result:', analysis);
      res.json(analysis);
    } catch (error) {
      debug(req, 'Error analyzing form submission:', error);
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
        .orderBy(sql`${notifications.createdAt} DESC`);

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

  // Enhanced branding endpoint with better error handling
  app.get("/api/branding/current", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const brandingResult = await db
        .select({
          company_name: companyBranding.company_name,
          header_style: companyBranding.header_style,
          primary_color: companyBranding.primary_color,
          secondary_color: companyBranding.secondary_color,
          accent_color: companyBranding.accent_color,
          logo: companyBranding.logo,
          logo_mime_type: companyBranding.logo_mime_type,
          header_image_url: companyBranding.header_image_url,
          header_image_mime_type: companyBranding.header_image_mime_type,
          footer_image_url: companyBranding.footer_image_url,
          footer_image_mime_type: companyBranding.footer_image_mime_type,
          footer_text: companyBranding.footer_text,
          created_at: companyBranding.created_at,
          updated_at: companyBranding.updated_at
        })
        .from(companyBranding)
        .orderBy(sql`${companyBranding.created_at} DESC`)
        .limit(1);

      const branding = brandingResult[0];

      if (!branding) {
        return res.json({
          company_name: "Events & Entertainment Enterprises",
          header_style: "modern",
          primary_color: "#71569E",
          secondary_color: "#F0F0FA",
          accent_color: "#191160",
          logo: null,
          logo_mime_type: null,
          header_image_url: null,
          header_image_mime_type: null,
          footer_image_url: null,
          footer_image_mime_type: null,
          footer_text: "Designed with ❤️ by E3"
        });
      }

      res.json(branding);
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}