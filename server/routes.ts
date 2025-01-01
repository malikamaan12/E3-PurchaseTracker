import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import multer from "multer";
import path from "path";
import { setupAuth } from "./auth";
import {
  users,
  notifications,
  purchaseRequests,
  approvals,
  fileAttachments,
  insertPurchaseRequestSchema,
  vendors,
  errorLogs,
  subPurposes,
  accountRequests,
  insertAccountRequestSchema,
  companyBranding
} from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { AppError, ValidationError } from './utils/errors';
import { analyzeError } from './utils/error-analysis';
import { getNotifications, markNotificationAsRead, createNotification } from './utils/notifications';
import { hash } from 'bcrypt';
import express from 'express';

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and PDF files are allowed.'));
    }
  }
});

// Debug logging utility
const debug = (req: Request, message: string, data?: any) => {
  console.log(`[${req.method} ${req.path}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Enhanced sub-purposes endpoint with proper query building and error handling
  app.get("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { purposeType } = req.query;
      debug(req, 'Fetching sub-purposes', { purposeType });

      let query = db
        .select({
          id: subPurposes.id,
          name: subPurposes.name,
          purposeType: subPurposes.purpose_type,
          isFrozen: subPurposes.is_frozen,
          validFrom: subPurposes.valid_from,
          validTo: subPurposes.valid_to,
          createdAt: subPurposes.created_at,
          updatedAt: subPurposes.updated_at
        })
        .from(subPurposes)
        .orderBy(desc(subPurposes.created_at));

      if (purposeType) {
        query = query.where(eq(subPurposes.purpose_type, purposeType as string));
      }

      const results = await query;

      // Transform the dates into proper format or null
      const formattedResults = results.map(sp => ({
        ...sp,
        validFrom: sp.validFrom ? new Date(sp.validFrom).toISOString() : null,
        validTo: sp.validTo ? new Date(sp.validTo).toISOString() : null,
        purposeType: sp.purposeType || 'Unknown',
        createdAt: new Date(sp.createdAt).toISOString(),
        updatedAt: new Date(sp.updatedAt).toISOString()
      }));

      debug(req, `Found ${formattedResults.length} sub-purposes`);
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
        .orderBy(desc(accountRequests.createdAt));

      debug(req, `Found ${accountRequestsResult.length} account requests`);
      res.json(accountRequestsResult);
    } catch (error) {
      debug(req, 'Error fetching account requests:', error);
      next(error);
    }
  });

  // Add file upload endpoint before purchase request creation endpoint
  app.post("/api/attachments", upload.array("files", 5), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      if (!req.files || !Array.isArray(req.files)) {
        throw new ValidationError('No files uploaded');
      }

      const uploadedFiles = req.files.map(file => ({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/${file.filename}`
      }));

      debug(req, 'Files uploaded:', uploadedFiles);
      res.status(201).json(uploadedFiles);
    } catch (error) {
      debug(req, 'Error uploading files:', error);
      next(error);
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));


  // Create purchase request endpoint with proper error handling and draft support
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Creating purchase request with data:', {
        body: req.body,
        user: req.user?.id,
        action: req.body.action
      });

      // Parse request data with enhanced error handling
      let requestData;
      let attachments;
      try {
        requestData = req.body.data;

        // Handle attachments
        if (requestData.attachments) {
          attachments = Array.isArray(requestData.attachments) ? requestData.attachments : [];
          delete requestData.attachments; // Remove from main request data
        }

        // Ensure arrays are properly formatted for PostgreSQL JSON columns
        requestData.items = Array.isArray(requestData.items)
          ? requestData.items
          : [];

        requestData.mandatoryApprovers = Array.isArray(requestData.mandatoryApprovers)
          ? requestData.mandatoryApprovers
          : [];

        requestData.optionalApprovers = Array.isArray(requestData.optionalApprovers)
          ? requestData.optionalApprovers
          : [];

        requestData.priorityRecommendations = Array.isArray(requestData.priorityRecommendations)
          ? requestData.priorityRecommendations
          : [];

        debug(req, 'Parsed request data:', requestData);
      } catch (error) {
        debug(req, 'Error parsing request data:', error);
        throw new ValidationError('Invalid request data format');
      }

      // Add required fields
      requestData.requesterId = req.user!.id;
      requestData.requestNumber = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      requestData.status = req.body.action === 'draft' ? 'draft' : 'pending';

      // For drafts, we'll do partial validation
      let validationResult;
      if (req.body.action === 'draft') {
        // For drafts, only validate the required fields
        validationResult = insertPurchaseRequestSchema
          .partial()
          .safeParse(requestData);
      } else {
        // For submission, do full validation
        validationResult = insertPurchaseRequestSchema.safeParse(requestData);
      }

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        throw new ValidationError('Invalid request data', {
          errors: validationResult.error.errors
        });
      }

      // Verify vendor exists
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, requestData.vendorId)
      });

      if (!vendor) {
        throw new ValidationError('Selected vendor does not exist');
      }

      // Create purchase request with properly formatted JSON fields
      const result = await db
        .insert(purchaseRequests)
        .values({
          requestNumber: requestData.requestNumber,
          requesterId: requestData.requesterId,
          vendorId: requestData.vendorId,
          title: requestData.title?.trim() || '',
          description: requestData.description?.trim() || '',
          items: JSON.stringify(requestData.items || []),
          purposeType: requestData.purposeType,
          subPurposeId: requestData.subPurposeId,
          priority: requestData.priority || 'medium',
          currency: requestData.currency || 'QAR',
          totalEstimatedCost: requestData.totalEstimatedCost || 0,
          freightAmount: requestData.freightAmount || 0,
          status: requestData.status,
          isLocked: false,
          mandatoryApproversCount: requestData.mandatoryApprovers?.length || 0,
          mandatoryApprovers: JSON.stringify(requestData.mandatoryApprovers || []),
          optionalApprovers: JSON.stringify(requestData.optionalApprovers || []),
          priorityRecommendations: JSON.stringify(requestData.priorityRecommendations || []),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // After creating the request, add attachments if any
      if (attachments?.length > 0) {
        await db.insert(fileAttachments).values(
          attachments.map(attachment => ({
            requestId: result[0].id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            fileUrl: attachment.fileUrl,
            uploadedAt: new Date()
          }))
        );
      }

      // Get the created request with attachments
      const [requestWithAttachments] = await db
        .select({
          ...purchaseRequests,
          attachments: fileAttachments
        })
        .from(purchaseRequests)
        .leftJoin(fileAttachments, eq(fileAttachments.requestId, purchaseRequests.id))
        .where(eq(purchaseRequests.id, result[0].id))
        .limit(1);

      debug(req, `Purchase request ${req.body.action === 'draft' ? 'draft saved' : 'submitted'} successfully`, requestWithAttachments);
      res.status(201).json(requestWithAttachments);
    } catch (error) {
      debug(req, 'Error creating purchase request:', error);
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
        status: 'pending'
      };

      debug(req, 'Validating request data');
      const validationResult = insertAccountRequestSchema.safeParse(requestData);

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationResult.error.format()
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

      // Hash password and create request
      const hashedPassword = await hash(validationResult.data.password, 10);
      const [newRequest] = await db
        .insert(accountRequests)
        .values({
          ...validationResult.data,
          password: hashedPassword
        })
        .returning();

      // Get all admin users
      const admins = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'),
          eq(users.isActive, true)
        ));

      // Get all approvers
      const approvers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'approver'),
          eq(users.isActive, true)
        ));

      // Create notifications for admins and approvers
      const createNotifications = async () => {
        const notificationPromises = [...admins, ...approvers].map(user =>
          db.insert(notifications).values({
            userId: user.id,
            title: 'New Account Request',
            message: `New account request from ${newRequest.username} for ${newRequest.department} department`,
            type: 'account_request',
            isRead: false,
            link: '/admin/account-requests',
            createdAt: new Date()
          })
        );

        await Promise.all(notificationPromises);
      };

      // Send notifications asynchronously
      createNotifications().catch(error => {
        console.error('Error creating notifications:', error);
      });

      debug(req, 'Account request created:', newRequest.id);
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
        .orderBy(desc(purchaseRequests.createdAt));

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
          approverId: req.user.id,
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
        .orderBy(desc(accountRequests.createdAt));

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

      res.json({
        message: 'Account request approved',
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
        .select({
          id: vendors.id,
          companyName: vendors.companyName,
          contactPerson: vendors.contactPerson,
          contactNumber: vendors.contactNumber,
          email: vendors.email,
          address: vendors.address,
          taxNumber: vendors.taxNumber,
          registrationNumber: vendors.registrationNumber,
          bankName: vendors.bankName,
          accountNumber: vendors.accountNumber,
          ibanNumber: vendors.ibanNumber,
          branchName: vendors.branchName,
          rating: vendors.rating,
          status: vendors.status,
          remarks: vendors.remarks,
          createdAt: vendors.createdAt,
          updatedAt: vendors.updatedAt
        })
        .from(vendors)
        .orderBy(desc(vendors.createdAt));

      // Ensure we return an empty array if no vendors found
      const formattedVendors = allVendors.map(vendor => ({
        ...vendor,
        createdAt: vendor.createdAt ? new Date(vendor.createdAt).toISOString() : null,
        updatedAt: vendor.updatedAt ? new Date(vendor.updatedAt).toISOString() : null
      }));

      debug(req, `Found ${formattedVendors.length} vendors`);
      res.json(formattedVendors);
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

      debug(req, 'Creating new vendor:', req.body);

      // Set default category if not provided
      const vendorData = {
        ...req.body,
        category: req.body.category || "general"
      };

      const validationResult = insertVendorSchema.safeParse(vendorData);

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        throw new ValidationError('Invalid vendor data', {
          errors: validationResult.error.errors
        });
      }

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

  app.patch("/api/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const vendorId = parseInt(req.params.id);
      const updateData = req.body;

      debug(req, 'Updating vendor:', { vendorId, updateData });

      // Validate update data
      if (!updateData.companyName || !updateData.email || !updateData.contactPerson) {
        throw new ValidationError('Required fields missing');
      }

      const [updatedVendor] = await db
        .update(vendors)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(vendors.id, vendorId))
        .returning();

      if (!updatedVendor) {
        throw new AppError('Vendor not found', 404);
      }

      debug(req, 'Successfully updated vendor:', updatedVendor);
      res.json(updatedVendor);
    } catch (error) {
      debug(req, 'Error updating vendor:', error);
      next(error);
    }
  });

  app.patch("/api/vendors/:id/status", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const vendorId = parseInt(req.params.id);
      const { status } = req.body;

      if (!status || !['active', 'blocked', 'frozen'].includes(status)) {
        throw new ValidationError('Invalid status');
      }

      const [updatedVendor] = await db
        .update(vendors)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(vendors.id, vendorId))
        .returning();

      if (!updatedVendor) {
        throw new AppError('Vendor not found', 404);
      }

      debug(req, 'Successfully updated vendor status:', updatedVendor);
      res.json(updatedVendor);
    } catch (error) {
      debug(req, 'Error updating vendor status:', error);
      next(error);
    }
  });

  app.delete("/api/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const vendorId = parseInt(req.params.id);

      debug(req, 'Deleting vendor:', vendorId);

      const [deletedVendor] = await db
        .delete(vendors)
        .where(eq(vendors.id, vendorId))
        .returning();

      if (!deletedVendor) {
        throw new AppError('Vendor not found', 404);
      }

      debug(req, 'Successfully deleted vendor:', deletedVendor);
      res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
      debug(req, 'Error deleting vendor:', error);
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
  app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      debug(req, 'Fetching company branding settings');

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

      debug(req, 'Found branding settings:', settings);
      res.json(settings);
    } catch (error) {
      debug(req, 'Error fetching branding settings:', error);
      next(error);
    }
  });

  // Update company branding settings
  app.post("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }

      debug(req, 'Updating branding settings:', req.body);

      // Update or create branding settings
      const [updatedSettings] = await db
        .insert(companyBranding)
        .values({
          companyName: req.body.companyName,
          logo: req.body.logo,
          logoMimeType: req.body.logoMimeType,
          footerImage: req.body.footerImage,
          footerImageMimeType: req.body.footerImageMimeType,
          headerStyle: req.body.headerStyle,
          primaryColor: req.body.primaryColor,
          secondaryColor: req.body.secondaryColor,
          accentColor: req.body.accentColor,
          footerText: req.body.footerText,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: companyBranding.id,
          set: {
            companyName: req.body.companyName,
            logo: req.body.logo,
            logoMimeType: req.body.logoMimeType,
            footerImage: req.body.footerImage,
            footerImageMimeType: req.body.footerImageMimeType,
            headerStyle: req.body.headerStyle,
            primaryColor: req.body.primaryColor,
            secondaryColor: req.body.secondaryColor,
            accentColor: req.body.accentColor,
            footerText: req.body.footerText,
            updatedAt: new Date()
          }
        })
        .returning();

      debug(req, 'Updated branding settings:', updatedSettings);
      res.json(updatedSettings);
    } catch (error) {
      debug(req, 'Error updating branding settings:', error);
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

  // Add branding route handler
  app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      debug(req, 'Fetching company branding settings');

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

      debug(req, 'Found branding settings:', settings);
      res.json(settings);
    } catch (error) {
      debug(req, 'Error fetching branding settings:', error);
      next(error);
    }
  });

  // Create and return the HTTP server after adding all routes
  const httpServer = createServer(app);
  return httpServer;
}