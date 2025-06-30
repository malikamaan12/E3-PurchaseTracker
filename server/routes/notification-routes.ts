import { Express, Request, Response, NextFunction } from "express";
import { notificationService } from "../services/NotificationService";
import { debug } from "../utils/debug";
import { AppError, ValidationError } from "../utils/errors";
import { db } from "@db";
import { notifications, notificationPreferences, NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } from "@db/schema";
import { and, eq } from "drizzle-orm";

export function registerNotificationRoutes(app: Express) {
  // Test endpoint to measure pure response time
  app.get("/api/notifications/test", async (req: Request, res: Response) => {
    const start = Date.now();
    console.log(`[PERF-TEST] Starting notification test endpoint`);
    res.json({ message: "test", timing: Date.now() - start });
  });

  // Ultra-fast notifications endpoint - completely bypasses heavy middleware
  app.get("/api/notifications/fast", async (req: Request, res: Response) => {
    const start = Date.now();
    
    try {
      // Extract user ID from session directly - minimal processing
      const userId = req.session?.passport?.user;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Direct database call with aggressive caching
      const results = await notificationService.getNotifications(userId, {
        includeRead: true
      });

      console.log(`[FAST-NOTIF] Fast endpoint completed in ${Date.now() - start}ms`);
      res.json(results);
    } catch (error) {
      console.error(`[FAST-NOTIF] Fast endpoint error:`, error);
      res.status(500).json({ message: 'Error loading notifications' });
    }
  });

  // Original notifications endpoint with minimal authentication overhead
  app.get("/api/notifications", async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    try {
      // Fast authentication check without full middleware overhead
      if (!req.session?.passport?.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const userId = req.session.passport.user;
      const lastFetchTime = req.query.lastFetchTime
        ? new Date(req.query.lastFetchTime as string)
        : undefined;

      debug(req, 'Fetching notifications', { lastFetchTime, userId });
      
      // Direct call with minimal options for maximum speed
      const results = await notificationService.getNotifications(userId, {
        lastFetchTime,
        includeRead: true
      });

      debug(req, `Found ${results.length} notifications in ${Date.now() - start}ms`);
      res.json(results);
    } catch (error) {
      debug(req, 'Error fetching notifications:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Mark notification as read
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
      const updatedNotification = await notificationService.markNotificationAsRead(notificationId, req.user!.id);
      debug(req, 'Notification updated successfully');

      res.json(updatedNotification);
    } catch (error) {
      debug(req, 'Error marking notification as read:', error);
      next(error);
    }
  });

  // Mark notification as acknowledged
  app.put("/api/notifications/:id/acknowledge", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        throw new ValidationError('Invalid notification ID', { id: 'Must be a number' });
      }

      debug(req, 'Acknowledging notification:', notificationId);
      const updatedNotification = await notificationService.acknowledgeNotification(notificationId, req.user!.id);
      debug(req, 'Notification acknowledged successfully');

      res.json(updatedNotification);
    } catch (error) {
      debug(req, 'Error acknowledging notification:', error);
      next(error);
    }
  });

  // Mark all notifications as read
  app.put("/api/notifications/mark-all-read", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Marking all notifications as read');
      
      // Update all unread notifications for the user
      await db
        .update(notifications)
        .set({
          isRead: true,
          updatedAt: new Date()
        })
        .where(and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        ));

      debug(req, 'All notifications marked as read');
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      debug(req, 'Error marking all notifications as read:', error);
      next(error);
    }
  });

  // Get notification preferences
  app.get("/api/notification-preferences", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      debug(req, 'Fetching notification preferences');
      const preferences = await notificationService.getUserNotificationPreferences(req.user!.id);
      debug(req, `Found ${preferences.length} notification preferences`);

      res.json(preferences);
    } catch (error) {
      debug(req, 'Error fetching notification preferences:', error);
      next(error);
    }
  });

  // Get notification preferences metadata (categories and types)
  app.get("/api/notification-preferences/metadata", (_req: Request, res: Response) => {
    res.json({
      categories: NOTIFICATION_CATEGORIES,
      types: NOTIFICATION_TYPES
    });
  });

  // Update notification preference
  app.put("/api/notification-preferences/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const preferenceId = parseInt(req.params.id);
      if (isNaN(preferenceId)) {
        throw new ValidationError('Invalid preference ID', { id: 'Must be a number' });
      }

      debug(req, 'Updating notification preference:', { id: preferenceId, data: req.body });
      
      const updatedPreference = await notificationService.updateNotificationPreference(
        preferenceId,
        req.user!.id,
        req.body
      );

      debug(req, 'Notification preference updated successfully');
      res.json(updatedPreference);
    } catch (error) {
      debug(req, 'Error updating notification preference:', error);
      next(error);
    }
  });
}