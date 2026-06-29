import { db } from "@db";
import {
  notifications,
  notificationPreferences,
  users,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  type InsertNotification
} from "@db/schema";
import { eq, and, lt, desc, gte, or, SQL, sql } from "drizzle-orm";

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
  // Purchase request related notifications
  purchase_request_submitted: '/dashboard/requests/{id}',
  purchase_request_approved: '/dashboard/requests/{id}',
  purchase_request_rejected: '/dashboard/requests/{id}',
  purchase_request_changes_requested: '/dashboard/requests/{id}',
  purchase_request_updated: '/dashboard/requests/{id}',
  purchase_request_canceled: '/dashboard/requests/{id}',
  purchase_request_completed: '/dashboard/requests/{id}',
  
  // Approval related notifications
  approval_required: '/dashboard/requests/{id}',
  approval_reminder: '/dashboard/requests/{id}',
  approval_delegated: '/dashboard/requests/{id}',
  approval_overridden: '/dashboard/requests/{id}',
  
  // Vendor related notifications
  vendor_created: '/dashboard/vendors/{id}',
  vendor_updated: '/dashboard/vendors/{id}',
  vendor_deactivated: '/dashboard/vendors/{id}',
  
  // Account related notifications
  account_created: '/dashboard/user-profile',
  account_updated: '/dashboard/user-profile',
  password_reset: '/login', // Typically outside dashboard
  
  // System notifications
  system_maintenance: '/dashboard/notifications',
  system_update: '/dashboard/notifications',
  system_error: '/dashboard/error-dashboard'
};

/**
 * NotificationService class encapsulates all notification-related functionality
 */
export class NotificationService {
  private static instance: NotificationService;
  private cache = new Map<string, { data: any[], timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache

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
    actionData = {},
    expiresAt,
    roleRestrictions,
    departmentRestrictions
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
    roleRestrictions?: string | string[];
    departmentRestrictions?: string | string[];
  }) {
    // Generate link based on type
    const link = this.generateLink(type, { requestId });

    // Add role and department restrictions to action data if provided
    const enhancedActionData = { ...actionData };
    
    if (roleRestrictions) {
      enhancedActionData.roleRestrictions = roleRestrictions;
    }
    
    if (departmentRestrictions) {
      enhancedActionData.departmentRestrictions = departmentRestrictions;
    }

    const notification: InsertNotification = {
      userId,
      title,
      message,
      type,
      priority,
      link,
      requestId,
      isRead: false,
      isAcknowledged: false,
      expiresAt,
      actionType: actionType ?? null,
      actionData: Object.keys(enhancedActionData).length > 0 ? enhancedActionData : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const results = await db
      .insert(notifications)
      .values(notification)
      .returning();

    const result = results[0];
    if (!result) {
      console.warn("[NotificationService] No record returned from insertion, but proceeding...");
    }

    return result;
  }

  /**
   * Create an approval notification
   */
  public async createApprovalNotification({
    requestId,
    requestTitle,
    requesterName,
    approverIds,
    department
  }: {
    requestId: number;
    requestTitle: string;
    requesterName: string;
    approverIds: number[];
    department: string;
  }) {
    const results = [];

    for (const approverId of approverIds) {
      const notification = await this.createNotification({
        userId: approverId,
        title: 'Approval Required',
        message: `A purchase request "${requestTitle}" from ${requesterName} requires your approval.`,
        type: 'approval_required',
        requestId,
        priority: 'high',
        actionType: 'approve',
        actionData: {
          department,
          requestId
        },
        // For approval notifications, restrict to approver roles and specific department
        roleRestrictions: ['approver', 'manager', 'admin'],
        departmentRestrictions: department,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
      });

      results.push(notification);
    }

    return results;
  }

  /**
   * Create a pending approval notification for approvers
   */
  public async createPendingApprovalNotification({
    requestId,
    requestTitle,
    requesterName,
    requesterDepartment,
    approverIds
  }: {
    requestId: number;
    requestTitle: string;
    requesterName: string;
    requesterDepartment: string;
    approverIds: number[];
  }) {
    const results = [];

    for (const approverId of approverIds) {
      const notification = await this.createNotification({
        userId: approverId,
        title: 'Pending Approval',
        message: `${requesterName} from ${requesterDepartment} submitted a new request "${requestTitle}" that requires your approval.`,
        type: 'approval_required',
        requestId,
        priority: 'high',
        actionType: 'review',
        actionData: {
          requestId,
          requesterDepartment
        },
        // Only approver roles should see these notifications
        roleRestrictions: ['approver', 'manager', 'admin'],
        // Approvers from the same department as the requester or managers/admins
        departmentRestrictions: [requesterDepartment, 'Management', 'Finance']
      });

      results.push(notification);
    }

    return results;
  }

  /**
   * Create a new submission notification for admins
   */
  public async createNewSubmissionNotification({
    requestId,
    requestTitle,
    requesterName,
    adminIds
  }: {
    requestId: number;
    requestTitle: string;
    requesterName: string;
    adminIds: number[];
  }) {
    const results = [];

    for (const adminId of adminIds) {
      const notification = await this.createNotification({
        userId: adminId,
        title: 'New Purchase Request',
        message: `${requesterName} has submitted a new purchase request: "${requestTitle}".`,
        type: 'purchase_request_submitted',
        requestId,
        priority: 'normal',
        actionType: 'view',
        actionData: {
          requestId
        },
        // Only admins and managers should see these notifications
        roleRestrictions: ['admin', 'manager']
      });

      results.push(notification);
    }

    return results;
  }

  /**
   * Get notifications for a user - Ultra-optimized version
   */
  public async getNotifications(userId: number, options?: {
    lastFetchTime?: Date;
    includeRead?: boolean;
    type?: string;
    priority?: NotificationPriority;
    userRole?: string;
    userDepartment?: string;
  }) {
    // Aggressive caching - return cached results immediately
    const cacheKey = `notifications_${userId}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    
    // 30-second cache for ultra-fast responses
    if (cached && (now - cached.timestamp) < 30000) {
      return cached.data;
    }

    try {
      // Construct filters
      const filters = [eq(notifications.userId, userId)];
      
      if (options?.includeRead === false) {
        filters.push(eq(notifications.isRead, false));
      }

      if (options?.type) {
        filters.push(eq(notifications.type, options.type));
      }

      const result = await db
        .select()
        .from(notifications)
        .where(and(...filters))
        .orderBy(desc(notifications.createdAt))
        .limit(20); 

      // Minimal filtering - just expired notifications
      const currentTime = new Date();
      const validNotifications = result.filter((notification: any) => 
        !notification.expiresAt || new Date(notification.expiresAt) >= currentTime
      );

      // Apply lastFetchTime filter if provided
      const filteredResults = options?.lastFetchTime 
        ? validNotifications.filter((n: any) => new Date(n.createdAt) >= options.lastFetchTime!)
        : validNotifications;

      // Cache the results
      this.cache.set(cacheKey, { data: filteredResults, timestamp: now });
      
      return filteredResults;
      
    } catch (error) {
      console.error('Notification fetch error:', error);
      return []; // Return empty array to prevent UI crashes
    }
  }

  /**
   * Mark a notification as read
   */
  public async markNotificationAsRead(notificationId: number, userId: number) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (!notification) {
      throw new Error('Notification not found');
    }

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updated;
  }

  /**
   * Mark a notification as acknowledged
   */
  public async acknowledgeNotification(notificationId: number, userId: number) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (!notification) {
      throw new Error('Notification not found');
    }

    const [updated] = await db
      .update(notifications)
      .set({
        isAcknowledged: true,
        isRead: true, // Also mark as read when acknowledged
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updated;
  }

  /**
   * Get unread notification count for a user
   */
  public async getUnreadCount(userId: number) {
    const now = new Date();
    
    const [result] = await db
      .select({ count: sql`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          or(
            sql`${notifications.expiresAt} IS NULL`,
            sql`${notifications.expiresAt} >= ${now}`
          ) as SQL<unknown>
        )
      );

    return Number(result.count);
  }

  /**
   * Get notification preferences for a user
   */
  public async getUserNotificationPreferences(userId: number) {
    const preferences = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .orderBy(notificationPreferences.category, notificationPreferences.type);

    // If no preferences exist, create defaults
    if (preferences.length === 0) {
      const defaultPreferences = Object.keys(NOTIFICATION_CATEGORIES).flatMap(category =>
        Object.keys(NOTIFICATION_TYPES)
          .filter(type => type.startsWith(category.toLowerCase()))
          .map(type => ({
            userId,
            category,
            type,
            enabled: true,
            inAppEnabled: true,
            emailEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
      );

      const insertedPreferences = await db
        .insert(notificationPreferences)
        .values(defaultPreferences)
        .returning();

      return insertedPreferences;
    }

    return preferences;
  }

  /**
   * Get a specific notification preference for a user
   */
  private async getUserNotificationPreference(userId: number, type: string) {
    const [preference] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, type)
        )
      )
      .limit(1);

    return preference;
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultNotificationPreferences(userId: number) {
    const defaultPreferences = Object.keys(NOTIFICATION_CATEGORIES).flatMap(category =>
      Object.keys(NOTIFICATION_TYPES)
        .filter(type => type.startsWith(category.toLowerCase()))
        .map(type => ({
          userId,
          category,
          type,
          enabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
    );

    const insertedPreferences = await db
      .insert(notificationPreferences)
      .values(defaultPreferences)
      .returning();

    return insertedPreferences;
  }

  /**
   * Update notification preference
   */
  public async updateNotificationPreference(preferenceId: number, userId: number, data: {
    enabled?: boolean;
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
  }) {
    // Verify preference belongs to user
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.id, preferenceId),
          eq(notificationPreferences.userId, userId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error('Notification preference not found');
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
  }

  /**
   * Cleanup old notifications to prevent database bloat
   */
  public async cleanupOldNotifications(days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Delete read notifications older than the cutoff date
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.isRead, true),
          lt(notifications.createdAt, cutoffDate)
        )
      )
      .returning({ count: sql`count(*)::int` });

    const deleteCount = result[0]?.count ?? 0;
    return { count: Number(deleteCount) };
  }

  /**
   * Generate link for notification based on type
   */
  private generateLink(type: string, params: Record<string, any> = {}): string | null {
    const routePattern = NOTIFICATION_ROUTES[type as keyof typeof NOTIFICATION_ROUTES];
    if (!routePattern) return null;

    let link = routePattern;
    
    // Replace parameters in route pattern
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        link = link.replace(`{${key}}`, params[key]);
      }
    });

    return link;
  }
}

export const notificationService = NotificationService.getInstance();

// Helper function to compare dates
function lte(createdAt: any, cutoffDate: Date) {
  if (createdAt instanceof Date) {
    return createdAt <= cutoffDate;
  }
  
  if (typeof createdAt === 'string') {
    return new Date(createdAt) <= cutoffDate;
  }
  
  return false;
}