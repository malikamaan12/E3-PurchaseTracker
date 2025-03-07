import { db } from "@db";
import { 
  notifications, 
  notificationPreferences, 
  users,
  purchaseRequests,
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  type NotificationEventType
} from "@db/schema";
import { and, eq, desc, sql, or, isNull } from "drizzle-orm";
import { AppError } from "../utils/errors";

/**
 * Notification Priority Levels
 */
export type NotificationPriority = 'high' | 'normal' | 'low';

/**
 * Notification Action Types
 */
export type NotificationActionType = 
  | 'approve' 
  | 'reject' 
  | 'review' 
  | 'acknowledge' 
  | 'complete' 
  | 'update' 
  | 'view';

/**
 * Define valid notification types and their route patterns
 */
export const NOTIFICATION_ROUTES = {
  // Request related
  new_request: (id: number) => `/requests/${id}`,
  request_approved: (id: number) => `/requests/${id}`,
  request_rejected: (id: number) => `/requests/${id}`,
  request_changes: (id: number) => `/requests/${id}`,
  request_comment: (id: number) => `/requests/${id}`,
  request_mention: (id: number) => `/requests/${id}`,
  
  // Approval related
  pending_approval: (id: number) => `/requests/${id}/approve`,
  approval_required: (id: number) => `/requests/${id}/approve`,
  approval_reminder: (id: number) => `/requests/${id}/approve`,

  // System related  
  system_maintenance: () => '/system-status',
  system_update: () => '/system-status',
  
  // Account related
  account_request: () => '/admin/account-requests',
  account_status_change: () => '/profile',
  
  // Vendor related
  vendor_status_change: (id: number) => `/vendors/${id}`,
  
  // Error related
  error_analytics: () => '/admin/error-analytics',
  
  // Default
  default: () => '/'
} as const;

/**
 * NotificationService class encapsulates all notification-related functionality
 */
export class NotificationService {
  private static instance: NotificationService;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a notification
   */
  public async createNotification({
    userId,
    title,
    message,
    type,
    requestId,
    priority = 'normal',
    actionType,
    actionData,
    expiresAt
  }: {
    userId: number;
    title: string;
    message: string;
    type: string;
    requestId?: number;
    priority?: NotificationPriority;
    actionType?: NotificationActionType;
    actionData?: Record<string, any>;
    expiresAt?: Date;
  }) {
    try {
      // Determine the correct link based on notification type
      let link: string | null = null;
      
      // Cast type to check if it's a valid notification type with a defined route
      const notificationType = type as keyof typeof NOTIFICATION_ROUTES;
      
      if (requestId && NOTIFICATION_ROUTES[notificationType] && typeof NOTIFICATION_ROUTES[notificationType] === 'function') {
        // @ts-ignore - We've already checked that the function exists
        link = NOTIFICATION_ROUTES[notificationType](requestId);
      } else if (NOTIFICATION_ROUTES[notificationType] && typeof NOTIFICATION_ROUTES[notificationType] === 'function') {
        // @ts-ignore - We've already checked that the function exists
        link = NOTIFICATION_ROUTES[notificationType]();
      } else {
        link = NOTIFICATION_ROUTES.default();
      }

      // Check if user has opted out of this notification type
      const userPreference = await this.getUserNotificationPreference(userId, type);
      if (userPreference && !userPreference.enabled) {
        console.log(`User ${userId} has opted out of notification type ${type}`);
        return null;
      }

      // Insert the notification
      const [notification] = await db
        .insert(notifications)
        .values({
          userId,
          requestId,
          title,
          message,
          type,
          priority,
          link,
          actionType,
          actionData,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new AppError('Failed to create notification', 500);
    }
  }

  /**
   * Create an approval notification
   */
  public async createApprovalNotification({
    requesterId,
    requestId,
    approverName,
    department,
    status,
    comments
  }: {
    requesterId: number;
    requestId: number;
    approverName: string;
    department: string;
    status: 'approved' | 'rejected' | 'changes_requested';
    comments?: string;
  }) {
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

    return this.createNotification({
      userId: requesterId,
      title: notificationData.title,
      message: finalMessage,
      type: notificationData.type,
      requestId,
      priority: notificationData.priority,
      actionType: status === 'changes_requested' ? 'update' : 'view'
    });
  }

  /**
   * Create a pending approval notification for approvers
   */
  public async createPendingApprovalNotification({
    approverId,
    requestId,
    requestTitle,
    requestNumber,
    requesterName
  }: {
    approverId: number;
    requestId: number;
    requestTitle: string;
    requestNumber: string;
    requesterName: string;
  }) {
    return this.createNotification({
      userId: approverId,
      title: 'Approval Requested',
      message: `Your approval is requested for ${requestTitle} (${requestNumber}) submitted by ${requesterName}`,
      type: 'pending_approval',
      requestId,
      priority: 'high',
      actionType: 'approve'
    });
  }

  /**
   * Create a new submission notification for admins
   */
  public async createNewSubmissionNotification({
    adminIds,
    requestId,
    requestTitle,
    requestNumber,
    requesterName,
    department
  }: {
    adminIds: number[];
    requestId: number;
    requestTitle: string;
    requestNumber: string;
    requesterName: string;
    department: string;
  }) {
    const notifications = [];

    for (const adminId of adminIds) {
      const notification = await this.createNotification({
        userId: adminId,
        title: 'New Purchase Request',
        message: `A new purchase request ${requestTitle} (${requestNumber}) has been submitted by ${requesterName} from ${department}`,
        type: 'new_request',
        requestId,
        priority: 'normal',
        actionType: 'review'
      });
      
      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  }

  /**
   * Get notifications for a user
   */
  public async getNotifications(userId: number, options?: {
    lastFetchTime?: Date;
    limit?: number;
    includeRead?: boolean;
    type?: string;
    priority?: NotificationPriority;
  }) {
    try {
      const { 
        lastFetchTime, 
        limit = 50, 
        includeRead = true,
        type,
        priority
      } = options || {};

      let whereClause = eq(notifications.userId, userId);

      if (lastFetchTime) {
        whereClause = and(
          whereClause,
          sql`${notifications.createdAt} > ${lastFetchTime}`
        );
      }

      if (!includeRead) {
        whereClause = and(
          whereClause,
          eq(notifications.isRead, false)
        );
      }

      if (type) {
        whereClause = and(
          whereClause,
          eq(notifications.type, type)
        );
      }

      if (priority) {
        whereClause = and(
          whereClause,
          eq(notifications.priority, priority)
        );
      }

      const results = await db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      return results;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw new AppError('Failed to fetch notifications', 500);
    }
  }

  /**
   * Mark a notification as read
   */
  public async markNotificationAsRead(notificationId: number, userId: number) {
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

  /**
   * Mark a notification as acknowledged
   */
  public async acknowledgeNotification(notificationId: number, userId: number) {
    try {
      const [updatedNotification] = await db
        .update(notifications)
        .set({ 
          isAcknowledged: true,
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
      console.error('Error acknowledging notification:', error);

      if (error instanceof AppError) throw error;
      throw new AppError('Failed to acknowledge notification', 500);
    }
  }

  /**
   * Get unread notification count for a user
   */
  public async getUnreadCount(userId: number) {
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

  /**
   * Get notification preferences for a user
   */
  public async getUserNotificationPreferences(userId: number) {
    try {
      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .orderBy(notificationPreferences.category, notificationPreferences.type);

      // If no preferences exist, create defaults
      if (preferences.length === 0) {
        return this.createDefaultNotificationPreferences(userId);
      }

      return preferences;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      throw new AppError('Failed to fetch notification preferences', 500);
    }
  }

  /**
   * Get a specific notification preference for a user
   */
  private async getUserNotificationPreference(userId: number, type: string) {
    try {
      const [preference] = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, type)
        ))
        .limit(1);

      return preference;
    } catch (error) {
      console.error('Error fetching notification preference:', error);
      return null;
    }
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultNotificationPreferences(userId: number) {
    try {
      const defaultPreferences = Object.keys(NOTIFICATION_CATEGORIES).flatMap(category =>
        Object.keys(NOTIFICATION_TYPES)
          .filter(type => type.toLowerCase().startsWith(category.toLowerCase()))
          .map(type => ({
            userId,
            category,
            type,
            enabled: true,
            inAppEnabled: true,
            emailEnabled: false,
          }))
      );

      const insertedPreferences = await db
        .insert(notificationPreferences)
        .values(defaultPreferences)
        .returning();

      return insertedPreferences;
    } catch (error) {
      console.error('Error creating default notification preferences:', error);
      throw new AppError('Failed to create default notification preferences', 500);
    }
  }

  /**
   * Update notification preference
   */
  public async updateNotificationPreference(preferenceId: number, userId: number, data: {
    enabled?: boolean;
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
  }) {
    try {
      // Verify the preference belongs to the user
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.id, preferenceId),
          eq(notificationPreferences.userId, userId)
        ))
        .limit(1);

      if (!existing) {
        throw new AppError('Notification preference not found', 404);
      }

      const [updated] = await db
        .update(notificationPreferences)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(notificationPreferences.id, preferenceId))
        .returning();

      return updated;
    } catch (error) {
      console.error('Error updating notification preference:', error);
      
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update notification preference', 500);
    }
  }

  /**
   * Cleanup old notifications to prevent database bloat
   */
  public async cleanupOldNotifications(days: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      await db
        .delete(notifications)
        .where(
          and(
            lte(notifications.createdAt, cutoffDate),
            or(
              eq(notifications.isRead, true),
              eq(notifications.isAcknowledged, true)
            )
          )
        );
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }
}

// Re-export for backwards compatibility
export const notificationService = NotificationService.getInstance();

// Helper function to log notification creation
function lte(createdAt: any, cutoffDate: Date) {
  return sql`${createdAt} <= ${cutoffDate}`;
}