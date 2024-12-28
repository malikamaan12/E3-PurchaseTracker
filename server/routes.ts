import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { 
  users, 
  notifications, 
  accountRequests, 
  purchaseRequests, 
  subPurposes,
  insertAccountRequestSchema, 
  approvals,
  purchaseApprovers,
  errorLogs,
  insertErrorLogSchema,
  type PurchaseApprover,
  insertPurchaseRequestSchema,
  insertSubPurposeSchema
} from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { AppError, handleError, DatabaseError, AuthorizationError, ValidationError } from './utils/errors';
import { hash } from 'bcrypt';
import { setupAuth } from './auth';
import { z } from 'zod';
import * as crypto from 'crypto';

// Debug logging utility
const debug = (req: Request, message: string, data?: any) => {
  console.log(`[${req.id}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

export function registerRoutes(app: Express): Server {
  // Setup authentication routes and middleware
  setupAuth(app);

  // Add request validation middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = crypto.randomUUID();
    debug(req, `${req.method} ${req.path} started`);
    next();
  });

  // Update error handling middleware section
  app.use(async (err: unknown, req: Request, res: Response, next: NextFunction) => {
    try {
      debug(req, 'Error occurred:', err);
      const error = await handleError(err);

      // Ensure proper error logging with JSON serialization
      try {
        const errorLogData = {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          severity: error.severity || 'error',
          path: req.path,
          userId: req.user?.id,
          details: error.details || {},
          aiAnalysis: error.details?.aiAnalysis || {}
        };

        // Validate error log data
        const validatedData = insertErrorLogSchema.safeParse(errorLogData);
        if (!validatedData.success) {
          debug(req, 'Error log validation failed:', validatedData.error);
        } else {
          await db.insert(errorLogs).values(validatedData.data);
          debug(req, 'Error logged to database');
        }
      } catch (logError) {
        debug(req, 'Failed to log error:', logError);
      }

      // Ensure valid status code
      const status = error.status && error.status >= 100 && error.status < 600 
        ? error.status 
        : 500;

      // Ensure response hasn't been sent
      if (!res.headersSent) {
        res.status(status).json({
          status: 'error',
          message: error.message,
          code: error.code || 'INTERNAL_ERROR',
          severity: error.severity || 'error',
          ...(error.details && { details: error.details })
        });
      }
    } catch (handlingError) {
      debug(req, 'Error in error handling middleware:', handlingError);

      // Ensure response hasn't been sent
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          message: 'Internal Server Error',
          code: 'INTERNAL_ERROR',
          severity: 'critical'
        });
      }
    }
  });

  // Update session handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'SessionExpiredError' || err.code === 'ESESSIONEXPIRED') {
      console.log(`[${req.id}] Session expired, attempting to regenerate`);

      // Ensure session exists before regeneration
      if (!req.session) {
        console.error(`[${req.id}] Invalid session state`);
        return res.status(500).json({
          status: 'error',
          message: 'Invalid session state',
          code: 'SESSION_ERROR'
        });
      }

      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error(`[${req.id}] Failed to regenerate session:`, regenerateErr);
          if (!res.headersSent) {
            res.status(500).json({
              status: 'error',
              message: 'Session recovery failed',
              code: 'SESSION_ERROR'
            });
          }
          return;
        }

        console.log(`[${req.id}] Session regenerated successfully`);
        if (!res.headersSent) {
          next();
        }
      });
    } else {
      next(err);
    }
  });

  // Approver management endpoints
  app.get("/api/approvers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { department } = req.query;

      const approvers = await db
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
        .where(eq(users.isActive, true))
        .where(department ? eq(purchaseApprovers.departmentId, department as string) : undefined)
        .orderBy(purchaseApprovers.level);

      res.json(approvers);
    } catch (error) {
      console.error('Error fetching approvers:', error);
      next(new AppError('Failed to fetch approvers', 500));
    }
  });

  app.post("/api/admin/approvers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const { departmentId, approverId, isMandatory, level } = req.body;

      // Check if approver exists and is active
      const [approver] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, approverId),
          eq(users.isActive, true)
        ))
        .limit(1);

      if (!approver) {
        throw new AppError('Approver not found or inactive', 404);
      }

      // Create new approver assignment
      const [newApprover] = await db
        .insert(purchaseApprovers)
        .values({
          departmentId,
          approverId,
          isMandatory,
          level,
        })
        .returning();

      res.json(newApprover);
    } catch (error) {
      console.error('Error creating approver assignment:', error);
      next(error);
    }
  });

  app.delete("/api/admin/approvers/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const approverId = parseInt(req.params.id);

      // Delete approver assignment
      await db
        .delete(purchaseApprovers)
        .where(eq(purchaseApprovers.id, approverId));

      res.json({ message: 'Approver assignment deleted successfully' });
    } catch (error) {
      console.error('Error deleting approver assignment:', error);
      next(error);
    }
  });

  // Account Request endpoint
  app.post("/api/auth/request-account", async (req: Request, res: Response, next: NextFunction) => {
    console.log('Received account request:', JSON.stringify(req.body, null, 2));

    try {
      // Validate request data
      console.log('Validating request data with schema');
      const validationResult = insertAccountRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        console.error('Validation errors:', validationResult.error.format());
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationResult.error.format()
        });
      }

      console.log('Request data validated successfully');

      // Check if username already exists in account requests
      const [existingRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.username, validationResult.data.username))
        .limit(1);

      if (existingRequest) {
        console.log('Username already exists in account requests');
        return res.status(400).json({
          message: 'An account request with this username already exists'
        });
      }

      // Check if username exists in users
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, validationResult.data.username))
        .limit(1);

      if (existingUser) {
        console.log('Username already exists in users');
        return res.status(400).json({
          message: 'Username already exists'
        });
      }

      // Hash the password before storing
      const hashedPassword = await hash(validationResult.data.password, 10);

      // Create account request
      console.log('Creating new account request');
      const [newRequest] = await db
        .insert(accountRequests)
        .values({
          ...validationResult.data,
          password: hashedPassword,
          status: 'pending'
        })
        .returning();

      console.log('Account request created successfully:', newRequest.id);

      res.status(201).json({
        message: 'Account request submitted successfully',
        requestId: newRequest.id
      });
    } catch (error) {
      console.error('Error processing account request:', error);
      next(error);
    }
  });

  // Get user's requests with detailed information
  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      console.log('Fetching requests for user:', req.user!.id);

      // First get the requests with requester information
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
        .where(eq(purchaseRequests.requesterId, req.user!.id));

      console.log('Raw requests data:', JSON.stringify(requests, null, 2));

      // Validate request data structure
      if (!Array.isArray(requests)) {
        throw new Error('Invalid requests data structure');
      }

      // Validate each request has required fields
      requests.forEach((request, index) => {
        if (!request.requester || !request.requester.department) {
          console.error(`Invalid requester data for request ${index}:`, request);
          throw new Error(`Missing requester data for request ${request.id}`);
        }
      });

      // For each request, fetch its approvals
      const requestsWithApprovals = await Promise.all(
        requests.map(async (request) => {
          const requestApprovals = await db
            .select()
            .from(approvals)
            .where(eq(approvals.requestId, request.id));

          console.log(`Approvals for request ${request.id}:`, requestApprovals);

          return {
            ...request,
            approvals: requestApprovals || []
          };
        })
      );

      console.log('Found requests:', requestsWithApprovals.length);
      return res.json(requestsWithApprovals);
    } catch (error) {
      console.error('Error fetching requests:', error);
      next(error);
    }
  });

  // Purchase Request endpoints
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      console.log('Received request body:', JSON.stringify(req.body, null, 2));

      // Ensure required fields are present and properly formatted
      const requestData = {
        ...req.body,
        status: req.body.status || 'pending',
        requesterId: req.user!.id,
        requestNumber: `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        contact_number: req.body.contact_number?.trim() || '',
        purpose: req.body.purpose?.trim() || '',
        totalEstimatedCost: req.body.totalEstimatedCost?.toString() || '0',
        freightAmount: req.body.freightAmount?.toString() || '0',
      };

      console.log('Prepared request data:', JSON.stringify(requestData, null, 2));

      // Validate request data
      const validationResult = insertPurchaseRequestSchema.safeParse(requestData);

      if (!validationResult.success) {
        console.error('Validation errors:', validationResult.error.format());
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationResult.error.errors
        });
      }

      // Create new purchase request
      const [newRequest] = await db
        .insert(purchaseRequests)
        .values(validationResult.data)
        .returning();

      if (!newRequest) {
        throw new Error('Failed to create purchase request');
      }

      // Send response
      res.status(201).json(newRequest);
    } catch (error) {
      console.error('Error creating purchase request:', error);
      next(error);
    }
  });

  // Sub-purposes management endpoints with enhanced logging
  app.get("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { purposeType } = req.query;
      debug(req, 'Fetching sub-purposes', { purposeType });

      const query = db
        .select()
        .from(subPurposes)
        .orderBy(subPurposes.createdAt);

      if (purposeType) {
        query.where(eq(subPurposes.purposeType, purposeType as string));
      }

      const allSubPurposes = await query;
      debug(req, `Found ${allSubPurposes.length} sub-purposes`);
      res.json(allSubPurposes);
    } catch (error) {
      debug(req, 'Error fetching sub-purposes:', error);
      next(new DatabaseError('Failed to fetch sub-purposes'));
    }
  });

  app.post("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }

      debug(req, 'Creating new sub-purpose', req.body);
      const validationResult = insertSubPurposeSchema.safeParse(req.body);

      if (!validationResult.success) {
        debug(req, 'Validation failed:', validationResult.error);
        throw new ValidationError('Invalid sub-purpose data', {
          errors: validationResult.error.errors
        });
      }

      // Create new sub-purpose with proper timestamp handling
      const now = new Date();
      const [newSubPurpose] = await db
        .insert(subPurposes)
        .values({
          ...validationResult.data,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      debug(req, 'Successfully created sub-purpose:', newSubPurpose);
      res.status(201).json(newSubPurpose);
    } catch (error) {
      debug(req, 'Error creating sub-purpose:', error);
      next(error);
    }
  });

  app.get("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }

      const allSubPurposes = await db
        .select()
        .from(subPurposes)
        .orderBy(desc(subPurposes.createdAt));

      console.log('Successfully fetched sub-purposes:', allSubPurposes.length);
      res.json(allSubPurposes);
    } catch (error) {
      console.error('Error fetching sub-purposes:', error);
      next(error);
    }
  });
  app.post("/api/admin/sub-purposes/:id/toggle-freeze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }

      const subPurposeId = parseInt(req.params.id);
      const { isFrozen } = req.body;

      if (typeof isFrozen !== 'boolean') {
        throw new ValidationError('isFrozen must be a boolean value');
      }

      // Update sub-purpose freeze status
      const [updatedSubPurpose] = await db
        .update(subPurposes)
        .set({ 
          isFrozen,
          updatedAt: new Date()
        })
        .where(eq(subPurposes.id, subPurposeId))
        .returning();

      if (!updatedSubPurpose) {
        throw new AppError('Sub-purpose not found', 404);
      }

      console.log('Successfully updated sub-purpose freeze status:', {
        id: updatedSubPurpose.id,
        isFrozen: updatedSubPurpose.isFrozen
      });

      res.json(updatedSubPurpose);
    } catch (error) {
      console.error('Error updating sub-purpose:', error);
      next(error);
    }
  });

  // User management routes
  app.get("/api/admin/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      console.log('Fetching all users');
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          department: users.department,
          role: users.role,
          isActive: users.isActive,
          contact_number: users.contact_number,
          created_at: users.createdAt,
          updated_at: users.updatedAt
        })
        .from(users);

      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      next(error);
    }
  });

  // Toggle user activation status
  app.post("/api/admin/users/:id/toggle-activation", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (userId === req.user.id) {
        throw new AppError('Cannot modify your own account status', 400);
      }

      // Update user's active status
      const [updatedUser] = await db
        .update(users)
        .set({ isActive })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new AppError('User not found', 404);
      }

      res.json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      next(error);
    }
  });

  // Reset user password
  app.post("/api/admin/users/:id/reset-password", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);
      const { password } = req.body;

      if (!password || password.length < 6) {
        throw new AppError('Password must be at least 6 characters long', 400);
      }

      // Hash the new password
      const hashedPassword = await hash(password, 10);

      // Update user's password
      const [updatedUser] = await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new AppError('User not found', 404);
      }

      res.json({
        message: 'Password reset successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username
        }
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      next(error);
    }
  });

  // Delete user endpoint
  app.delete("/api/admin/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);

      // Prevent self-deletion
      if (userId === req.user.id) {
        throw new AppError('Cannot delete your own account', 400);
      }

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      // Check if user has associated purchase requests
      const [purchaseRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.requesterId, userId))
        .limit(1);

      if (purchaseRequest) {
        throw new AppError('Cannot delete user with associated purchase requests. Please deactivate the user instead.', 400);
      }

      console.log('Attempting to delete user:', userId);

      try {
        // Delete user's notifications and then the user
        await db.transaction(async (tx) => {
          await tx
            .delete(notifications)
            .where(eq(notifications.userId, userId));

          await tx
            .delete(users)
            .where(eq(users.id, userId));
        });

        console.log('Successfully deleted user:', userId);
        res.json({ message: 'User deleted successfully' });
      } catch (deleteError: any) {
        console.error('Error during delete operation:', deleteError);
        throw new AppError('Failed to delete user: ' + deleteError.message, 500);
      }
    } catch (error) {
      console.error('Error in delete user endpoint:', error);
      next(error);
    }
  });

  // Update user role endpoint
  app.put("/api/admin/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!['user', 'approver', 'admin'].includes(role)) {
        throw new AppError('Invalid role', 400);
      }

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      // Update user role
      const [updatedUser] = await db
        .update(users)
        .set({ role })
        .where(eq(users.id, userId))
        .returning();

      res.json({
        message: 'User role updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role
        }
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      next(error);
    }
  });

  // Notification endpoints
  app.get("/api/notifications", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user!.id))
        .orderBy(notifications.createdAt);

      res.json(userNotifications);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notifications/mark-read", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }
      const { notificationId } = req.body;

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId))
        .where(eq(notifications.userId, req.user!.id));

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  });

  // Account requests management
  app.get("/api/admin/account-requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      console.log('Fetching account requests...');
      const requests = await db
        .select()
        .from(accountRequests)
        .orderBy(desc(accountRequests.createdAt));

      console.log(`Found ${requests.length} account requests`);
      res.json(requests);
    } catch (error) {
      console.error('Error fetching account requests:', error);
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
          role: accountRequest.role
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

  // Error analytics endpoints
  app.get("/api/analytics/errors", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const timeRange = req.query.range as string || '7d';
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get error trends
      const errorTrends = await db
        .select({
          date: sql<string>`DATE_TRUNC('day', ${errorLogs.createdAt}::timestamp)::text`,
          severity: errorLogs.severity,
          count: sql<number>`COUNT(*)::integer`,
        })
        .from(errorLogs)
        .where(sql`${errorLogs.createdAt} >= ${startDate}`)
        .groupBy(sql`DATE_TRUNC('day', ${errorLogs.createdAt})`, errorLogs.severity)
        .orderBy(sql`DATE_TRUNC('day', ${errorLogs.createdAt})`);

      // Get most common errors
      const commonErrors = await db
        .select({
          code: errorLogs.code,
          message: errorLogs.message,
          count: sql<number>`COUNT(*)::integer`,
          severity: errorLogs.severity,
        })
        .from(errorLogs)
        .where(sql`${errorLogs.createdAt} >= ${startDate}`)
        .groupBy(errorLogs.code, errorLogs.message, errorLogs.severity)
        .orderBy(sql<number>`COUNT(*)::integer DESC`)
        .limit(10);

      // Get error distribution by severity
      const severityDistribution = await db
        .select({
          severity: errorLogs.severity,
          count: sql<number>`COUNT(*)::integer`,
        })
        .from(errorLogs)
        .where(sql`${errorLogs.createdAt} >= ${startDate}`)
        .groupBy(errorLogs.severity)
        .orderBy(errorLogs.severity);

      // Get recent errors with AI analysis
      const recentErrors = await db
        .select()
        .from(errorLogs)
        .orderBy(desc(errorLogs.createdAt))
        .limit(20);

      console.log('Successfully fetched error analytics:', {
        trendsCount: errorTrends.length,
        commonErrorsCount: commonErrors.length,
        distributionCount: severityDistribution.length,
        recentErrorsCount: recentErrors.length,
      });

      res.json({
        trends: errorTrends,
        commonErrors,
        severityDistribution,
        recentErrors: recentErrors.map(error => ({
          ...error,
          details: error.details,
          aiAnalysis: error.aiAnalysis
        }))
      });
    } catch (error) {
      console.error('Error fetching error analytics:', error);
      next(error);    }
  });

  app.post("/api/analytics/errors", async (req: Request,res: Response, next: NextFunction) => {
    try {
      const { message, code, severity, path, details, aiAnalysis } = req.body;

      const [errorLog] = await db
        .insert(errorLogs)
        .values({
          message,
          code,
          severity,
          path,
          userId: req.user?.id,
          details,
          aiAnalysis,
        })
        .returning();

      console.log('Successfully logged error:', {
        id: errorLog.id,
        message: errorLog.message,
        severity: errorLog.severity,
      });

      res.status(201).json(errorLog);
    } catch (error) {
      console.error('Error logging error:', error);
      next(error);
    }
  });

  // Add 404 handler for API routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: `Cannot ${req.method} ${req.path}`,
      severity: 'warning',
      code: 'NOT_FOUND'
    });
  });

  // Create and return the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}