import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, notifications, accountRequests, purchaseRequests } from "@db/schema";
import { eq } from "drizzle-orm";
import { AppError } from './utils/errors';
import { hash } from 'bcrypt';
import { setupAuth } from './auth';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Setup authentication routes and middleware
  setupAuth(app);

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

      console.log('Attempting to delete user:', userId);

      try {
        // Delete associated purchase requests first
        await db.transaction(async (tx) => {
          // Delete purchase requests associated with the user
          await tx
            .delete(purchaseRequests)
            .where(eq(purchaseRequests.requesterId, userId));

          // Delete user's notifications
          await tx
            .delete(notifications)
            .where(eq(notifications.userId, userId));

          // Finally delete the user
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

      // Create new user with the same hashed password from account request
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

  return httpServer;
}