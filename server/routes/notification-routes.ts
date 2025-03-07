import { Express, Request, Response, NextFunction } from "express";
import { notificationService } from "../services/NotificationService";
import { debug } from "../utils/debug";
import { AppError, ValidationError } from "../utils/errors";
import { db } from "@db";
import { notifications, notificationPreferences, NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } from "@db/schema";
import { and, eq } from "drizzle-orm";

export function registerNotificationRoutes(app: Express) {
  // Get all notifications for the authenticated user
  app.get("/api/notifications", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const lastFetchTime = req.query.lastFetchTime
        ? new Date(req.query.lastFetchTime as string)
        : undefined;
      
      const includeRead = req.query.includeRead !== 'false';
      const type = req.query.type as string | undefined;
      const priority = req.query.priority as 'high' | 'normal' | 'low' | undefined;

      debug(req, 'Fetching notifications', { lastFetchTime, includeRead, type, priority });
      
      const results = await notificationService.getNotifications(req.user!.id, {
        lastFetchTime,
        includeRead,
        type,
        priority
      });

      debug(req, `Found ${results.length} notifications`);
      res.json(results);
    } catch (error) {
      debug(req, 'Error fetching notifications:', error);
      next(error);
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