import { db } from "@db";
import { notifications } from "@db/schema";
import { AppError } from "./errors";
import { and, eq, desc, sql } from "drizzle-orm";
import { analyzeNotificationError } from "./error-analysis";

// Define valid notification types and their route patterns
export const NOTIFICATION_ROUTES = {
  request: (id: number) => `/requests/${id}`,
  request_approved: (id: number) => `/requests/${id}`,
  request_rejected: (id: number) => `/requests/${id}`,
  request_changes: (id: number) => `/requests/${id}`,
  account_request: () => '/admin/account-requests',
  system: () => '/',
  error_analytics: () => '/admin/error-analytics',
  default: () => '/'
} as const;

// Add logging to help track notification creation and routing
const logNotification = (action: string, data: any) => {
  console.log(`[Notification ${action}]:`, JSON.stringify(data, null, 2));
};

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  requestId?: number,
  priority: 'high' | 'normal' | 'low' = 'normal'
) {
  try {
    // Determine the correct link based on notification type
    let link: string | null = null;

    // Log the incoming notification data
    logNotification('create-params', { userId, title, message, type, requestId, priority });

    // Enhanced routing for approval-related notifications
    if (type.startsWith('request_')) {
      if (!requestId) {
        throw new Error('Request ID is required for request-related notifications');
      }
      switch (type) {
        case 'request_approved':
          link = NOTIFICATION_ROUTES.request_approved(requestId);
          break;
        case 'request_rejected':
          link = NOTIFICATION_ROUTES.request_rejected(requestId);
          break;
        case 'request_changes':
          link = NOTIFICATION_ROUTES.request_changes(requestId);
          break;
        default:
          link = NOTIFICATION_ROUTES.request(requestId);
      }
    } else if (type === 'account_request') {
      link = NOTIFICATION_ROUTES.account_request();
    } else if (type === 'system') {
      link = NOTIFICATION_ROUTES.system();
    } else if (type === 'error_analytics') {
      link = NOTIFICATION_ROUTES.error_analytics();
    } else {
      link = NOTIFICATION_ROUTES.default();
    }

    // Log the resolved link
    logNotification('resolved-link', { type, link, requestId });

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
        priority,
        createdAt: new Date()
      })
      .returning();

    // Log the created notification
    logNotification('created', notification);

    return notification;
  } catch (error) {
    const analysis = await analyzeNotificationError(
      error as Error, 
      userId,
      'createNotification',
      'insert'
    );

    console.error('Error creating notification:', error, '\nAnalysis:', analysis);
    throw new AppError('Failed to create notification', 500);
  }
}

// Enhanced notification creation for approvals
export async function createApprovalNotification(
  requesterId: number,
  requestId: number,
  approverName: string,
  department: string,
  status: 'approved' | 'rejected' | 'changes_requested',
  comments?: string
) {
  const statusMap = {
    approved: {
      type: 'request_approved',
      title: 'Request Approved',
      priority: 'high' as const,
      message: `Your request has been approved by ${approverName} from ${department}`
    },
    rejected: {
      type: 'request_rejected',
      title: 'Request Rejected',
      priority: 'high' as const,
      message: `Your request has been rejected by ${approverName} from ${department}`
    },
    changes_requested: {
      type: 'request_changes',
      title: 'Changes Requested',
      priority: 'high' as const,
      message: `${approverName} from ${department} has requested changes to your request`
    }
  };

  const notificationData = statusMap[status];
  const finalMessage = comments 
    ? `${notificationData.message}. Comments: ${comments}`
    : notificationData.message;

  return createNotification(
    requesterId,
    notificationData.title,
    finalMessage,
    notificationData.type,
    requestId,
    notificationData.priority
  );
}

// Get notifications with proper filtering and error handling
export async function getNotifications(userId: number, lastFetchTime?: Date) {
  try {
    let whereClause = eq(notifications.userId, userId);

    if (lastFetchTime) {
      whereClause = and(
        whereClause,
        sql`${notifications.createdAt} > ${lastFetchTime}`
      );
    }

    const results = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return results;
  } catch (error) {
    const analysis = await analyzeNotificationError(
      error as Error,
      userId,
      'getNotifications',
      'select'
    );

    console.error('Error fetching notifications:', error, '\nAnalysis:', analysis);
    throw new AppError('Failed to fetch notifications', 500);
  }
}

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
    const analysis = await analyzeNotificationError(
      error as Error,
      userId,
      'markNotificationAsRead',
      'update'
    );

    console.error('Error marking notification as read:', error, '\nAnalysis:', analysis);

    if (error instanceof AppError) throw error;
    throw new AppError('Failed to mark notification as read', 500);
  }
}

// Get unread count with proper error handling
export async function getUnreadCount(userId: number) {
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
    const analysis = await analyzeNotificationError(
      error as Error,
      userId,
      'getUnreadCount',
      'count'
    );

    console.error('Error getting unread count:', error, '\nAnalysis:', analysis);
    throw new AppError('Failed to get unread notification count', 500);
  }
}

// Cleanup old notifications to prevent database bloat
export async function cleanupOldNotifications(days: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    await db
      .delete(notifications)
      .where(sql`${notifications.createdAt} < ${cutoffDate}`);
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