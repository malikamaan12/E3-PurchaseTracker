import { db } from "@db";
import { AppError } from "./errors";
import { analyzeNotificationError } from "./error-analysis";
import { notificationService } from "../services/NotificationService";

/**
 * @deprecated Use notificationService from "../services/NotificationService" instead.
 * This module is kept for backward compatibility and will be removed in a future release.
 */

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
  console.log('[DEPRECATED] Legacy notification utils are being used, please migrate to NotificationService');
};

/**
 * @deprecated Use notificationService.createNotification instead
 */
export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  requestId?: number,
  priority: 'high' | 'normal' | 'low' = 'normal'
) {
  logNotification('deprecated-call', { userId, title, message, type, requestId, priority });
  
  try {
    // Convert legacy type to new type format
    const notificationType = type.startsWith('request_') 
      ? `request_${type.split('_')[1]}`
      : type === 'request' 
        ? 'approval_required' 
        : type;
    
    // Forward to new notification service
    return await notificationService.createNotification({
      userId,
      title,
      message,
      type: notificationType,
      requestId,
      priority,
      // Default action type based on notification type
      actionType: type.includes('approved') 
        ? 'view' 
        : type.includes('changes') 
          ? 'update' 
          : type.includes('rejected') 
            ? 'acknowledge' 
            : 'view'
    });
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

/**
 * @deprecated Use notificationService.createApprovalNotification instead
 */
export async function createApprovalNotification(
  requesterId: number,
  requestId: number,
  approverName: string,
  department: string,
  status: 'approved' | 'rejected' | 'changes_requested',
  comments?: string
) {
  logNotification('deprecated-call', { requesterId, requestId, approverName, department, status, comments });
  
  const statusMap = {
    approved: {
      type: 'request_approved',
      title: 'Request Approved',
      priority: 'high' as const,
      message: `Your request has been approved by ${approverName} from ${department}`,
      actionType: 'view' as const
    },
    rejected: {
      type: 'request_rejected',
      title: 'Request Rejected',
      priority: 'high' as const,
      message: `Your request has been rejected by ${approverName} from ${department}`,
      actionType: 'acknowledge' as const
    },
    changes_requested: {
      type: 'request_changes',
      title: 'Changes Requested',
      priority: 'high' as const,
      message: `${approverName} from ${department} has requested changes to your request`,
      actionType: 'update' as const
    }
  };

  const notificationData = statusMap[status];
  const finalMessage = comments 
    ? `${notificationData.message}. Comments: ${comments}`
    : notificationData.message;

  return await notificationService.createNotification({
    userId: requesterId,
    title: notificationData.title,
    message: finalMessage,
    type: notificationData.type,
    requestId,
    priority: notificationData.priority,
    actionType: notificationData.actionType
  });
}

/**
 * @deprecated Use notificationService.getNotifications instead
 */
export async function getNotifications(userId: number, lastFetchTime?: Date) {
  logNotification('deprecated-call', { userId, lastFetchTime });
  
  try {
    return await notificationService.getNotifications(userId, {
      lastFetchTime,
      includeRead: true
    });
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

/**
 * @deprecated Use notificationService.markNotificationAsRead instead
 */
export async function markNotificationAsRead(notificationId: number, userId: number) {
  logNotification('deprecated-call', { notificationId, userId });
  
  try {
    return await notificationService.markNotificationAsRead(notificationId, userId);
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

/**
 * @deprecated Use notificationService.getUnreadCount instead
 */
export async function getUnreadCount(userId: number) {
  logNotification('deprecated-call', { userId });
  
  try {
    const notifications = await notificationService.getNotifications(userId, {
      includeRead: false
    });
    return notifications.length;
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

/**
 * @deprecated Use notificationService.cleanupOldNotifications instead
 */
export async function cleanupOldNotifications(days: number = 30) {
  logNotification('deprecated-call', { days });
  
  try {
    await notificationService.cleanupOldNotifications(days);
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