import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupWebSocketServer } from "./utils/websocket";
import { setupAuth } from "./utils/auth";
import type { Request, Response, NextFunction } from "express";
import { AppError } from './utils/errors';
import { db } from "@db";
import { eq, and, desc } from 'drizzle-orm';
import {
  users,
  notifications,
  purchaseRequests,
  fileAttachments,
  errorLogs,
  type ErrorLog,
  vendors,
  companyBranding,
  subPurposes,
  insertVendorSchema,
  insertAccountRequestSchema,
  approvals,
  accountRequests,
  type PurchaseRequest,
  insertErrorLogSchema,
  insertPurchaseRequestSchema
} from "@db/schema";
import crypto from 'crypto';
import multer from 'multer';
import bcrypt from 'bcrypt';
const upload = multer().any();

// Debug logging utility
function debug(req: Request, message: string, data?: any) {
  const reqId = (req as any).id;
  console.log(`[${reqId}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

async function createNotification(userId: number, title: string, message: string, type: string, requestId?: number) {
  await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    requestId,
    isRead: false,
    createdAt: new Date()
  });
}


export function registerRoutes(app: Express): Server {
  // Create HTTP server first
  const httpServer = createServer(app);

  // Setup authentication before everything else
  setupAuth(app);

  // Setup WebSocket server after auth
  setupWebSocketServer(httpServer);

  // Add request validation middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).id = crypto.randomUUID();
    debug(req, `${req.method} ${req.path} started`);
    next();
  });

  // Error logging endpoint with proper validation
  app.post("/api/error-logs", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Logging error:', req.body);

      const validationResult = insertErrorLogSchema.safeParse(req.body);

      if (!validationResult.success) {
        throw new AppError('Invalid error log data', 400, {
          errors: validationResult.error.errors
        });
      }

      // Create error log
      const [errorLog] = await db
        .insert(errorLogs)
        .values({
          ...validationResult.data,
          userId: req.user?.id,
          createdAt: new Date()
        })
        .returning();

      // If error is critical, notify admin users
      if (validationResult.data.severity === 'critical') {
        const admins = await db
          .select()
          .from(users)
          .where(eq(users.role, 'admin'));

        // Notify all admins
        await Promise.all(admins.map(admin =>
          createNotification(
            admin.id,
            'Critical Error Detected',
            `A critical error occurred: ${validationResult.data.message}`,
            'error_analytics'
          )
        ));
      }

      res.status(201).json(errorLog);
    } catch (error) {
      debug(req, 'Error logging error:', error);
      next(error);
    }
  });

  // Request submission endpoint with proper error handling
  app.post("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      // Handle file upload with proper error handling
      await new Promise((resolve, reject) => {
        upload(req, res, (err) => {
          if (err) reject(new AppError(err.message, 400));
          resolve(undefined);
        });
      });

      // Parse and validate request data
      const requestData = {
        ...JSON.parse(req.body.data),
        requesterId: req.user!.id,
        requestNumber: `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      };

      const validationResult = insertPurchaseRequestSchema.safeParse(requestData);

      if (!validationResult.success) {
        throw new AppError('Invalid request data', 400, {
          errors: validationResult.error.errors
        });
      }

      // Create purchase request
      const [newRequest] = await db
        .insert(purchaseRequests)
        .values(validationResult.data as PurchaseRequest)
        .returning();

      // Save file attachments if any
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length > 0) {
        await db.insert(fileAttachments).values(
          files.map(file => ({
            requestId: newRequest.id,
            fileName: file.filename,
            fileType: file.mimetype,
            fileSize: file.size,
            fileUrl: file.path,
          }))
        );
      }

      debug(req, 'Successfully created purchase request:', newRequest);
      res.status(201).json(newRequest);
    } catch (error) {
      debug(req, 'Error creating request:', error);

      if (!(error instanceof AppError)) {
        await db.insert(errorLogs).values({
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
          userId: req.user?.id,
          path: req.path,
          createdAt: new Date()
        } as ErrorLog);
      }

      next(error);
    }
  });
  // Get user's requests with detailed information
  app.get("/api/requests", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Fetching requests for user:', req.user!.id);

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
        .innerJoin(users, eq(users.id, purchaseRequests.requesterId));

      debug(req, 'Raw requests data:', JSON.stringify(requests, null, 2));

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

          debug(req, `Approvals for request ${request.id}:`, requestApprovals);

          return {
            ...request,
            approvals: requestApprovals || []
          };
        })
      );

      debug(req, 'Found requests:', requestsWithApprovals.length);
      return res.json(requestsWithApprovals);
    } catch (error) {
      debug(req, 'Error fetching requests:', error);
      next(error);
    }
  });

  // Approval endpoint
  app.post("/api/requests/:requestId/approvals", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const requestId = parseInt(req.params.requestId);
      const { status, comments, department } = req.body;

      debug(req, 'Creating approval with data:', {
        requestId,
        status,
        comments,
        department,
        userId: req.user?.id,
        userDepartment: req.user?.department
      });

      // Validate required fields
      if (!requestId || !status || !department) {
        debug(req, 'Validation failed - missing fields:', { requestId, status, department });
        throw new AppError('Missing required fields: requestId, status, and department are required', 400);
      }

      // Check if request exists and get requester info
      const [request] = await db
        .select({
          id: purchaseRequests.id,
          requesterId: purchaseRequests.requesterId,
          title: purchaseRequests.title
        })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Create the approval record
      const [approval] = await db
        .insert(approvals)
        .values({
          requestId,
          approverId: req.user!.id,
          status,
          comments,
          department,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Create notification for the requester
      await createNotification(
        request.requesterId,
        `Request ${status}`,
        `Your request "${request.title}" has been ${status} by ${department}${comments ? `: ${comments}` : ''}`,
        'request',
        requestId
      );

      // Update request status
      let requestStatus = status;
      let isLocked = false;

      if (department === "Finance" && status === "approved") {
        isLocked = true;
        requestStatus = "approved";
      } else if (status === "rejected") {
        requestStatus = "rejected";
      } else if (status === "changes_requested") {
        requestStatus = "changes_requested";
        isLocked = false;
      }

      await db
        .update(purchaseRequests)
        .set({
          status: requestStatus,
          isLocked,
          updatedAt: new Date()
        })
        .where(eq(purchaseRequests.id, requestId));

      debug(req, 'Approval created and notification sent:', approval);
      res.status(201).json(approval);
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
        throw new AppError('Invalid vendor data', 400, {
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
        throw new AppError('Required fields missing', 400);
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
        throw new AppError('Invalid status', 400);
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
        throw new AppError('Password must be at least 6 characters', 400);
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
        throw new AppError('Invalid role specified', 400);
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
        .select()
        .from(companyBranding)
        .orderBy(desc(companyBranding.updatedAt))
        .limit(1);

      debug(req, 'Found branding settings:', settings);
      res.json(settings || {});
    } catch (error) {
      debug(req, 'Error fetching branding settings:', error);
      next(error);
    }
  });

  // Update company branding settings
  app.post("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      debug(req, 'Updating branding settings:', req.body);

      // Update or create branding settings
      const [updatedSettings] = await db
        .insert(companyBranding)
        .values({
          companyName: req.body.companyName,
          logo: req.body.logo,
          logoMimeType: req.body.logoMimeType,
          headerImageUrl: req.body.headerImageUrl,
          headerImageMimeType: req.body.headerImageMimeType,
          footerImageUrl: req.body.footerImageUrl,
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
            headerImageUrl: req.body.headerImageUrl,
            headerImageMimeType: req.body.headerImageMimeType,
            footerImageUrl: req.body.footerImageUrl,
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
        throw new AppError('Company name and primary color are required', 400);
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
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [{
          role: "user",          content: prompt
        }],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        throw new AppError('Invalid response type from Anthropic API', 500);
      }

      res.json({
        success: true,
        suggestions: content.text,
        moodBoard: {
          companyName,
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
            accent: accentColor
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}