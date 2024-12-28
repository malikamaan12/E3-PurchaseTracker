import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, notifications, accountRequests, purchaseRequests, subPurposes, insertAccountRequestSchema } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { AppError } from './utils/errors';
import { hash } from 'bcrypt';
import { setupAuth } from './auth';
import { z } from 'zod';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Setup authentication routes and middleware
  setupAuth(app);

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
      next(new AppError('Failed to process account request', 500));
    }
  });

  // Get user's requests
  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      console.log('Fetching requests for user:', req.user!.id);

      const userRequests = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          title: purchaseRequests.title,
          status: purchaseRequests.status,
          totalEstimatedCost: purchaseRequests.totalEstimatedCost,
          createdAt: purchaseRequests.createdAt,
          updatedAt: purchaseRequests.updatedAt,
          purposeType: purchaseRequests.purposeType,
          priority: purchaseRequests.priority,
        })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.requesterId, req.user!.id))
        .orderBy(desc(purchaseRequests.createdAt));

      console.log('Found requests:', userRequests.length);
      res.json(userRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      next(new AppError('Failed to fetch requests', 500));
    }
  });

  // Purchase Request endpoints
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
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
      next(new AppError('Failed to create purchase request', 500));
    }
  });

  // Sub-purposes management endpoints
  app.get("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { purposeType } = req.query;

      let query = db.select().from(subPurposes);
      if (purposeType) {
        query = query.where(eq(subPurposes.purposeType, purposeType as string));
      }

      const allSubPurposes = await query;
      res.json(allSubPurposes);
    } catch (error) {
      console.error('Error fetching sub-purposes:', error);
      next(new AppError('Failed to fetch sub-purposes', 500));
    }
  });

  app.get("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const allSubPurposes = await db
        .select()
        .from(subPurposes)
        .orderBy(subPurposes.createdAt);

      res.json(allSubPurposes);
    } catch (error) {
      console.error('Error fetching sub-purposes:', error);
      next(new AppError('Failed to fetch sub-purposes', 500));
    }
  });

  app.post("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { name, purposeType, validFrom, validTo } = req.body;

      // Create new sub-purpose
      const [newSubPurpose] = await db
        .insert(subPurposes)
        .values({
          name,
          purposeType,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
          isFrozen: false
        })
        .returning();

      res.json(newSubPurpose);
    } catch (error) {
      console.error('Error creating sub-purpose:', error);
      next(new AppError('Failed to create sub-purpose', 500));
    }
  });

  app.post("/api/admin/sub-purposes/:id/toggle-freeze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const subPurposeId = parseInt(req.params.id);
      const { isFrozen } = req.body;

      // Update sub-purpose freeze status
      const [updatedSubPurpose] = await db
        .update(subPurposes)
        .set({ isFrozen })
        .where(eq(subPurposes.id, subPurposeId))
        .returning();

      if (!updatedSubPurpose) {
        return res.status(404).json({ message: 'Sub-purpose not found' });
      }

      res.json(updatedSubPurpose);
    } catch (error) {
      console.error('Error updating sub-purpose:', error);
      next(new AppError('Failed to update sub-purpose', 500));
    }
  });

  // User management routes
  app.get("/api/admin/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
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
      next(new AppError('Failed to fetch users', 500));
    }
  });

  // Toggle user activation status
  app.post("/api/admin/users/:id/toggle-activation", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (userId === req.user.id) {
        return res.status(400).json({ message: 'Cannot modify your own account status' });
      }

      // Update user's active status
      const [updatedUser] = await db
        .update(users)
        .set({ isActive })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
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
      next(new AppError('Failed to update user status', 500));
    }
  });

  // Reset user password
  app.post("/api/admin/users/:id/reset-password", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
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
        return res.status(404).json({ message: 'User not found' });
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
      next(new AppError('Failed to reset password', 500));
    }
  });

  // Delete user endpoint
  app.delete("/api/admin/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);

      // Prevent self-deletion
      if (userId === req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user has associated purchase requests
      const [purchaseRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.requesterId, userId))
        .limit(1);

      if (purchaseRequest) {
        return res.status(400).json({
          message: 'Cannot delete user with associated purchase requests. Please deactivate the user instead.'
        });
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
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!['user', 'approver', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
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
      next(new AppError('Failed to update user role', 500));
    }
  });

  // Notification endpoints
  app.get("/api/notifications", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user!.id))
        .orderBy(notifications.createdAt);

      res.json(userNotifications);
    } catch (error) {
      next(new AppError('Failed to fetch notifications', 500));
    }
  });

  app.post("/api/notifications/mark-read", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const { notificationId } = req.body;

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId))
        .where(eq(notifications.userId, req.user!.id));

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(new AppError('Failed to update notification', 500));
    }
  });

  // Account requests management
  app.get("/api/admin/account-requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const requests = await db
        .select()
        .from(accountRequests)
        .orderBy(accountRequests.createdAt);
      res.json(requests);
    } catch (error) {
      next(new AppError('Failed to fetch account requests', 500));
    }
  });

  app.post("/api/admin/account-requests/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const requestId = parseInt(req.params.id);

      // Find the account request
      const [accountRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.id, requestId))
        .limit(1);

      if (!accountRequest) {
        return res.status(404).json({ message: 'Account request not found' });
      }

      if (accountRequest.status !== 'pending') {
        return res.status(400).json({ message: 'Account request is not pending' });
      }

      // Check if username already exists in users table
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, accountRequest.username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
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
      next(new AppError('Failed to approve account request', 500));
    }
  });

  app.post("/api/admin/account-requests/:id/reject", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const requestId = parseInt(req.params.id);

      // Update request status
      const [updatedRequest] = await db
        .update(accountRequests)
        .set({ status: 'rejected' })
        .where(eq(accountRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res.status(404).json({ message: 'Account request not found' });
      }

      res.json({ message: 'Account request rejected' });
    } catch (error) {
      next(new AppError('Failed to reject account request', 500));
    }
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


  // Approver management endpoints
  app.get("/api/approvers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { department } = req.query;

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
        .where(users.isActive.equals(true));

      if (department) {
        query = query.where(eq(purchaseApprovers.departmentId, department as string));
      }

      const approvers = await query.orderBy(purchaseApprovers.level);
      res.json(approvers);
    } catch (error) {
      console.error('Error fetching approvers:', error);
      next(new AppError('Failed to fetch approvers', 500));
    }
  });

  app.post("/api/admin/approvers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { departmentId, approverId, isMandatory, level } = req.body;

      // Check if approver exists and is active
      const [approver] = await db
        .select()
        .from(users)
        .where(eq(users.id, approverId))
        .where(eq(users.isActive, true))
        .limit(1);

      if (!approver) {
        return res.status(404).json({ message: 'Approver not found or inactive' });
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
      next(new AppError('Failed to create approver assignment', 500));
    }
  });

  app.delete("/api/admin/approvers/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const approverId = parseInt(req.params.id);

      // Delete approver assignment
      await db
        .delete(purchaseApprovers)
        .where(eq(purchaseApprovers.id, approverId));

      res.json({ message: 'Approver assignment deleted successfully' });
    } catch (error) {
      console.error('Error deleting approver assignment:', error);
      next(new AppError('Failed to delete approver assignment', 500));
    }
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