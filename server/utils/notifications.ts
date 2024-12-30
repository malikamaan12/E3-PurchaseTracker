import { db } from "@db";
import { notifications } from "@db/schema";
import { AppError } from "./errors";
import { eq, and, desc } from "drizzle-orm";
import { getNotificationServer } from "./websocket";
import { z } from "zod";

// Define notification types schema
const notificationTypeSchema = z.enum([
  'request',
  'account_request',
  'system',
  'error_analytics',
]);

type NotificationType = z.infer<typeof notificationTypeSchema>;

// Define notification routes mapping
const NOTIFICATION_ROUTES = {
  request: (id: number) => `/requests/${id}`,
  account_request: () => '/admin/account-requests',
  system: () => '/',
  error_analytics: () => '/admin/error-analytics',
} as const;

// Enhanced logging for better debugging
const logNotification = (action: string, data: any) => {
  console.log(`[Notification ${action}] ${new Date().toISOString()}:`, 
    JSON.stringify(data, null, 2));
};

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: NotificationType,
  requestId?: number
) {
  try {
    // Validate notification type
    notificationTypeSchema.parse(type);

    // Generate appropriate link based on type
    const link = requestId && type === 'request' 
      ? NOTIFICATION_ROUTES.request(requestId)
      : NOTIFICATION_ROUTES[type]();

    logNotification('create-params', { userId, title, message, type, requestId, link });

    // Create notification in database
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        title,
        message,
        type,
        requestId,
        link,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    logNotification('created', notification);

    // Broadcast via WebSocket if available
    const wsServer = getNotificationServer();
    if (wsServer) {
      wsServer.broadcastToUser(userId, notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw new AppError('Failed to create notification', 500);
  }
}

// Get notifications with proper filtering and pagination
export async function getNotifications(
  userId: number,
  options: {
    lastFetchTime?: Date;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
) {
  try {
    const {
      lastFetchTime,
      limit = 50,
      offset = 0,
      unreadOnly = false
    } = options;

    let conditions = eq(notifications.userId, userId);

    if (lastFetchTime) {
      conditions = and(
        conditions,
        eq(notifications.createdAt, lastFetchTime)
      );
    }

    if (unreadOnly) {
      conditions = and(
        conditions,
        eq(notifications.isRead, false)
      );
    }

    const results = await db
      .select()
      .from(notifications)
      .where(conditions)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw new AppError('Failed to fetch notifications', 500);
  }
}

// Mark notification as read with ownership verification
export async function markNotificationAsRead(notificationId: number, userId: number) {
  try {
    const [updatedNotification] = await db
      .update(notifications)
      .set({ 
        isRead: true,
        updatedAt: new Date()
      })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    if (!updatedNotification) {
      throw new AppError('Notification not found or access denied', 404);
    }

    return updatedNotification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to mark notification as read', 500);
  }
}

// Get unread notifications count
export async function getUnreadCount(userId: number): Promise<number> {
  try {
    const [result] = await db
      .select({ 
        count: sql<number>`count(*)` 
      })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    return result?.count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw new AppError('Failed to get unread notification count', 500);
  }
}

// Cleanup old notifications periodically
export async function cleanupOldNotifications(days: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    await db
      .delete(notifications)
      .where(sql`${notifications.createdAt} < ${cutoffDate}`);

    console.log(`Cleaned up notifications older than ${days} days`);
  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
    // Don't throw here as this is a maintenance operation
  }
}

export async function cleanupUploads() {
  const uploadDir = 'uploads';
  const fs = await import('fs');
  const path = await import('path');

  if (!fs.existsSync(uploadDir)) return;

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading upload directory:', err);
      return;
    }

    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error getting stats for file ${file}:`, err);
          return;
        }

        // Remove files older than 24 hours
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Error deleting file ${file}:`, err);
          });
        }
      });
    });
  });
}