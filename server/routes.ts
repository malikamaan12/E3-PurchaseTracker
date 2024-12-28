import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, notifications, accountRequests } from "@db/schema";
import { eq } from "drizzle-orm";
import { AppError } from './utils/errors';
import { hash } from 'bcrypt';

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

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

  // User management routes
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

  // Notification endpoints
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
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

  app.post("/api/notifications/mark-read", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
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

  app.post("/api/admin/account-requests/:id/approve", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
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

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          username: accountRequest.username,
          password: accountRequest.password, // Password is already hashed
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

  app.post("/api/admin/account-requests/:id/reject", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
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


  return httpServer;
}