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

  // Enhanced sub-purposes endpoint with proper query building and error handling
app.get("/api/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { purposeType } = req.query;
    debug(req, 'Fetching sub-purposes', { purposeType });

    let query = db
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
      .from(subPurposes);

    if (purposeType) {
      query = query.where(eq(subPurposes.purpose_type, purposeType as string));
    }

    const allSubPurposes = await query.orderBy(desc(subPurposes.created_at));
    debug(req, `Found ${allSubPurposes.length} sub-purposes`);
    res.json(allSubPurposes);
  } catch (error) {
    debug(req, 'Error fetching sub-purposes:', error);
    next(new DatabaseError('Failed to fetch sub-purposes'));
  }
});

// Enhanced sub-purpose creation endpoint with proper date handling and field mapping
app.post("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }

    debug(req, 'Creating new sub-purpose - Raw request body:', req.body);

    // Transform frontend field names to match database schema
    const requestData = {
      name: req.body.name,
      purpose_type: req.body.purposeType || req.body.purpose_type, // Accept both formats
      is_frozen: req.body.isFrozen || req.body.is_frozen || false,
      valid_from: req.body.validFrom || req.body.valid_from ? new Date(req.body.validFrom || req.body.valid_from) : null,
      valid_to: req.body.validTo || req.body.valid_to ? new Date(req.body.validTo || req.body.valid_to) : null,
    };

    debug(req, 'Transformed request data:', requestData);

    // Validate the purpose_type is one of the allowed values
    if (!['event', 'project', 'mall', 'business_growth'].includes(requestData.purpose_type)) {
      throw new ValidationError('Invalid purpose type', {
        details: {
          allowed: ['event', 'project', 'mall', 'business_growth'],
          received: requestData.purpose_type
        }
      });
    }

    const validationResult = insertSubPurposeSchema.safeParse(requestData);

    if (!validationResult.success) {
      debug(req, 'Validation failed:', validationResult.error);
      throw new ValidationError('Invalid sub-purpose data', {
        errors: validationResult.error.errors
      });
    }

    debug(req, 'Validation successful, inserting sub-purpose');

    const [newSubPurpose] = await db
      .insert(subPurposes)
      .values(validationResult.data)
      .returning();

    debug(req, 'Successfully created sub-purpose:', newSubPurpose);
    res.status(201).json(newSubPurpose);
  } catch (error) {
    debug(req, 'Error creating sub-purpose:', error);
    next(error);
  }
});

// Admin route for sub-purposes
app.get("/api/admin/sub-purposes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      throw new AuthorizationError('Admin access required');
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

// Error handling middleware
app.use(async (err: unknown, req: Request, res: Response, next: NextFunction) => {
  try {
    debug(req, 'Error occurred:', err);
    const error = await handleError(err);

    // Ensure proper error logging
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

    if (!res.headersSent) {
      res.status(error.status).json({
        status: 'error',
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
        severity: error.severity || 'error',
        ...(error.details && { details: error.details })
      });
    }
  } catch (handlingError) {
    debug(req, 'Error in error handling middleware:', handlingError);

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
      request_purpose: req.body.purpose || req.body.request_purpose, // Handle both field names
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
        request_purpose: accountRequests.request_purpose,
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