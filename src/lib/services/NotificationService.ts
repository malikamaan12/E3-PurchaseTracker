import { db } from "@db";
import {
  notifications,
  notificationPreferences,
  users,
  purchaseRequests,
  vendors,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  type InsertNotification
} from "@db/schema";
import { eq, and, lt, desc, gte, or, SQL, sql, inArray } from "drizzle-orm";
import { normalizeDepartmentAssignments, type AuthenticatedUser } from "@/lib/auth-shared";
import { emailService } from "./EmailService";
import { emailActionService } from "./EmailActionService";

export const GLOBAL_EMAIL_PREFERENCE_TYPE = 'email_notifications_global';

export interface NotificationTypeDefinition {
  category: 'approvals' | 'requests' | 'vendors' | 'system';
  type: string;
  label: string;
  description: string;
  defaultEmail: boolean;
  defaultInApp: boolean;
}

export const DEFAULT_NOTIFICATION_TYPES: NotificationTypeDefinition[] = [
  {
    category: 'approvals',
    type: 'pending_approval',
    label: 'Pending Approvals',
    description: 'Requests waiting for your review and sign-off',
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    category: 'requests',
    type: 'new_request',
    label: 'New Purchase Requests',
    description: 'Submissions made in your department or assigned areas',
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    category: 'approvals',
    type: 'approval_granted',
    label: 'Request Approved',
    description: 'Sign-offs and approvals granted on your requests',
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    category: 'approvals',
    type: 'approval_rejected',
    label: 'Request Rejected',
    description: 'Rejection notices and feedback on your requests',
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    category: 'requests',
    type: 'changes_requested',
    label: 'Changes Requested',
    description: 'Modifications or information requested by approvers',
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    category: 'vendors',
    type: 'vendor_status_change',
    label: 'Vendor Onboarding & Status',
    description: 'Vendor registration, banking updates, and status changes',
    defaultEmail: false,
    defaultInApp: true,
  },
  {
    category: 'system',
    type: 'system_update',
    label: 'System & Policy Updates',
    description: 'System maintenance, SLA warnings, and compliance alerts',
    defaultEmail: false,
    defaultInApp: true,
  },
];

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
  vendor_created: '/dashboard/vendors',
  vendor_updated: '/dashboard/vendors',
  vendor_deactivated: '/dashboard/vendors',

  // Account related notifications
  account_created: '/dashboard/requests',
  account_updated: '/dashboard/requests',
  password_reset: '/login',

  // System notifications
  system_maintenance: '/dashboard/requests',
  system_update: '/dashboard/requests',
  system_error: '/dashboard/admin/diagnostics'
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
   * Deduplicate notification items in memory by unique event signature
   */
  public static deduplicateNotifications(items: any[]): any[] {
    if (!Array.isArray(items)) return [];
    const seen = new Map<string, any>();
    for (const item of items) {
      const signature = item.idempotencyKey || item.actionData?.idempotencyKey ||
        NotificationService.generateIdempotencyKey({
          recipientId: item.userId,
          entityType: item.requestId ? 'purchase_request' : 'system',
          entityId: item.requestId,
          eventType: item.type,
          stage: item.actionData?.stage || null,
          causalEventId: item.actionData?.versionId || null
        }) + `_${(item.title || '').trim()}_${(item.message || '').trim()}`;

      if (!seen.has(signature)) {
        seen.set(signature, item);
      } else {
        const existing = seen.get(signature);
        if (item.isRead && !existing.isRead) {
          existing.isRead = true;
        }
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Create a notification with strict idempotency protection
   */
  /**
   * Deterministic idempotency key generator for multi-worker atomic notification deduplication.
   */
  public static generateIdempotencyKey({
    recipientId,
    entityType = 'purchase_request',
    entityId,
    eventType,
    stage,
    causalEventId
  }: {
    recipientId: number;
    entityType?: string;
    entityId?: number | string | null;
    eventType: string;
    stage?: string | null;
    causalEventId?: string | number | null;
  }): string {
    return [
      `rec:${recipientId}`,
      `ent:${entityType}`,
      `id:${entityId ?? 'none'}`,
      `evt:${eventType}`,
      `stg:${stage ?? 'none'}`,
      `csl:${causalEventId ?? 'none'}`
    ].join("|");
  }

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
    departmentRestrictions,
    stage,
    causalEventId,
    customIdempotencyKey,
    link: customLink
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
    stage?: string;
    causalEventId?: string | number;
    customIdempotencyKey?: string;
    link?: string;
  }) {
    // 1. Generate Deterministic Idempotency Key
    const idempotencyKey = customIdempotencyKey || NotificationService.generateIdempotencyKey({
      recipientId: userId,
      entityType: requestId ? "purchase_request" : "system",
      entityId: requestId,
      eventType: type,
      stage: stage || (actionData?.stage as string) || null,
      causalEventId: causalEventId || (actionData?.versionId as string) || null
    });

    // 2. Pre-insert Idempotency Check (supports environments where unique index migration is pending)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingNotifications = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        requestId ? eq(notifications.requestId, requestId) : sql`TRUE`,
        eq(notifications.type, type),
        gte(notifications.createdAt, twentyFourHoursAgo)
      ));

    const exactMatch = existingNotifications.find((n: any) =>
      (n.idempotencyKey && n.idempotencyKey === idempotencyKey) ||
      ((n.title || "").trim() === title.trim() && (n.message || "").trim() === message.trim())
    );

    if (exactMatch) {
      console.log(`[NotificationService] Idempotency: Suppressed duplicate notification for user ${userId}, req ${requestId}, type ${type}, key ${idempotencyKey}`);
      return exactMatch;
    }

    // Generate link based on type or use custom link
    const link = customLink || this.generateLink(type, { requestId });

    // Add role and department restrictions and idempotency key to action data
    const enhancedActionData: Record<string, any> = { ...actionData, idempotencyKey };

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
      idempotencyKey,
      isRead: false,
      isAcknowledged: false,
      expiresAt,
      actionType: actionType ?? null,
      actionData: enhancedActionData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      this.cache.delete(`notifications_${userId}`);
      const results = await db
        .insert(notifications)
        .values(notification)
        .onConflictDoNothing({ target: notifications.idempotencyKey })
        .returning();

      if (results.length > 0) {
        const created = results[0];

        // Trigger asynchronous email notification dispatch (non-blocking, errors caught internally)
        this.dispatchEmailNotificationIfEligible({
          userId,
          title,
          message,
          type,
          requestId,
          priority,
          actionType,
          link
        }).catch(err => {
          console.error(`[NotificationService] Asynchronous email dispatch failed for user ${userId}:`, err);
        });

        return created;
      }

      // Conflict occurred: retrieve existing record
      const [existing] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.idempotencyKey, idempotencyKey))
        .limit(1);

      return existing || notification;
    } catch (err: any) {
      if (err?.code === '42703') {
        // Strict failure when migration is missing — no silent unindexed degraded insertion
        console.error("[NotificationService] Schema readiness error: column 'idempotency_key' is missing from 'notifications' table. Apply migration 0001_notification_idempotency.sql before creating notifications.");
        throw new Error("SCHEMA_NOT_MIGRATED: Notification idempotency key column missing. Run database migration.");
      }
      throw err;
    }
  }

  /**
   * Deployment health check to verify database column and index readiness.
   * Does not log or expose credentials, bank details, or personal data.
   */
  public static async verifySchemaHealth(): Promise<{ columnExists: boolean; indexExists: boolean; ready: boolean }> {
    try {
      const colCheck = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'notifications' AND column_name = 'idempotency_key'
      `);
      const columnExists = ((colCheck as any).rows?.length || 0) > 0;

      const idxCheck = await db.execute(sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'notifications' AND indexname = 'idx_notifications_idempotency_key'
      `);
      const indexExists = ((idxCheck as any).rows?.length || 0) > 0;

      return {
        columnExists,
        indexExists,
        ready: columnExists && indexExists
      };
    } catch (error) {
      console.error("[NotificationService] Schema health check failed");
      return { columnExists: false, indexExists: false, ready: false };
    }
  }

  /**
   * Resolves recipient user IDs of active users who have approval authority for the specified departments.
   * - super_admin and admin are always included (global oversight).
   * - approver role (or isApprover flag) is included if their primary department or an active assigned department matches.
   * - user and supervisor roles are NEVER included in approval notifications.
   * - Inactive users (isActive === false) are NEVER included.
   * - excludeUserId is omitted (e.g. requester/actor).
   */
  public async getAuthorizedApproverUserIds({
    targetDepartments,
    excludeUserId,
  }: {
    targetDepartments: string[];
    excludeUserId?: number;
  }): Promise<number[]> {
    const normalizedTargets = targetDepartments.map(d => d.toLowerCase().trim()).filter(Boolean);
    if (normalizedTargets.length === 0) return [];

    const activeUsers = await db
      .select({
        id: users.id,
        role: users.role,
        department: users.department,
        assignedDepartments: users.assignedDepartments,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.isActive, true));

    const eligibleIds = new Set<number>();

    for (const u of activeUsers) {
      if (excludeUserId && u.id === excludeUserId) continue;

      // 1. Super Admins have global oversight across all departments
      if (u.role === 'super_admin') {
        eligibleIds.add(u.id);
        continue;
      }

      // 2. Regular users and supervisors NEVER receive approval notifications
      if (u.role === 'user' || u.role === 'supervisor') {
        continue;
      }

      // 3. Department Admins & Approvers: check primary department
      const primary = (u.department || '').toLowerCase().trim();
      if (normalizedTargets.includes(primary) && (u.role === 'approver' || u.role === 'admin' || (u as any).isApprover)) {
        eligibleIds.add(u.id);
        continue;
      }

      // 4. Department Admins & Approvers: check assigned departments
      const assignments = normalizeDepartmentAssignments(u.assignedDepartments, u.department);
      const hasMatchingAssignment = assignments.some(
        a => normalizedTargets.includes(a.department.toLowerCase().trim()) &&
             a.status === 'active' &&
             (a.role === 'approver' || a.role === 'both')
      );

      if (hasMatchingAssignment) {
        eligibleIds.add(u.id);
      }
    }

    return Array.from(eligibleIds);
  }

  /**
   * Evaluates if a notification is permitted to be viewed by a given user based on
   * Role-Based Access Control (RBAC) and Department Restrictions.
   */
  public isUserEligibleForNotification(notification: any, user: AuthenticatedUser): boolean {
    if (!user) return false;

    // Super Admins have unrestricted system-wide visibility
    if (user.role === 'super_admin') return true;

    const actionData = notification.actionData || {};

    // 1. Role Restrictions Enforcement
    if (actionData.roleRestrictions) {
      const allowedRoles = Array.isArray(actionData.roleRestrictions)
        ? actionData.roleRestrictions
        : [actionData.roleRestrictions];
      if (!allowedRoles.includes(user.role)) {
        return false;
      }
    }

    // 2. Department Restrictions Enforcement (super_admin has global access, others scoped to department)
    if (actionData.departmentRestrictions) {
      const allowedDepts = (Array.isArray(actionData.departmentRestrictions)
        ? actionData.departmentRestrictions
        : [actionData.departmentRestrictions]
      ).map((d: string) => d.toLowerCase().trim()).filter(Boolean);

      if (allowedDepts.length > 0) {
        const userPrimaryDept = (user.department || '').toLowerCase().trim();
        const primaryMatches = allowedDepts.includes(userPrimaryDept);

        const assignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
        const assignmentMatches = assignments.some(
          a => allowedDepts.includes(a.department.toLowerCase().trim()) &&
               a.status === 'active' &&
               (a.role === 'approver' || a.role === 'both')
        );

        // For approval / actionable notifications, user must have authority in that department
        if (notification.type === 'approval_required' || notification.type === 'purchase_request_submitted') {
          if (!primaryMatches && !assignmentMatches) {
            return false;
          }
          if (primaryMatches && user.role !== 'approver' && user.role !== 'admin' && !user.isApprover) {
            if (!assignmentMatches) {
              return false;
            }
          }
        }
      }
    }

    return true;
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
        roleRestrictions: ['approver', 'admin', 'super_admin'],
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
    approverIds,
    targetDepartments,
  }: {
    requestId: number;
    requestTitle: string;
    requesterName: string;
    requesterDepartment: string;
    approverIds: number[];
    targetDepartments?: string[];
  }) {
    const results = [];
    const depts = targetDepartments && targetDepartments.length > 0 ? targetDepartments : [requesterDepartment];

    for (const approverId of approverIds) {
      const notification = await this.createNotification({
        userId: approverId,
        title: 'Pending Approval',
        message: `${requesterName} from ${requesterDepartment} submitted a request "${requestTitle}" that requires your approval.`,
        type: 'approval_required',
        requestId,
        priority: 'high',
        actionType: 'review',
        actionData: {
          requestId,
          requesterDepartment,
          targetDepartments: depts,
        },
        // Only approver roles should see these notifications
        roleRestrictions: ['approver', 'admin', 'super_admin'],
        departmentRestrictions: depts,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      results.push(notification);
    }

    return results;
  }

  /**
   * Create a new submission notification for admins and approvers
   */
  public async createNewSubmissionNotification({
    requestId,
    requestTitle,
    requesterName,
    adminIds,
    departmentRestrictions,
  }: {
    requestId: number;
    requestTitle: string;
    requesterName: string;
    adminIds: number[];
    departmentRestrictions?: string | string[];
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
        // Admins, approvers, and super admins should see these notifications
        roleRestrictions: ['admin', 'approver', 'super_admin'],
        departmentRestrictions
      });

      results.push(notification);
    }

    return results;
  }

  /**
   * Get notifications for a user - Ultra-optimized version with RBAC defense-in-depth
   */
  public async getNotifications(userId: number, options?: {
    lastFetchTime?: Date;
    includeRead?: boolean;
    type?: string;
    priority?: NotificationPriority;
    userRole?: string;
    userDepartment?: string;
    user?: AuthenticatedUser;
  }) {
    // Cache key incorporates user ID
    const cacheKey = `notifications_${userId}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // 30-second cache for ultra-fast responses
    if (cached && (now - cached.timestamp) < 30000 && !options?.lastFetchTime) {
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

      let result: any[];
      try {
        result = await db
          .select()
          .from(notifications)
          .where(and(...filters))
          .orderBy(desc(notifications.createdAt))
          .limit(50);
      } catch (e: any) {
        if (e?.code === '42703') {
          result = await db
            .select({
              id: notifications.id,
              userId: notifications.userId,
              requestId: notifications.requestId,
              title: notifications.title,
              message: notifications.message,
              type: notifications.type,
              priority: notifications.priority,
              isRead: notifications.isRead,
              isAcknowledged: notifications.isAcknowledged,
              link: notifications.link,
              actionType: notifications.actionType,
              actionData: notifications.actionData,
              expiresAt: notifications.expiresAt,
              createdAt: notifications.createdAt,
              updatedAt: notifications.updatedAt
            })
            .from(notifications)
            .where(and(...filters))
            .orderBy(desc(notifications.createdAt))
            .limit(50);
        } else {
          throw e;
        }
      }

      // Minimal filtering - expired notifications
      const currentTime = new Date();
      let validNotifications = result.filter((notification: any) =>
        !notification.expiresAt || new Date(notification.expiresAt) >= currentTime
      );

      // Defense-in-depth RBAC check
      if (options?.user) {
        validNotifications = validNotifications.filter((notification: any) =>
          this.isUserEligibleForNotification(notification, options.user!)
        );
      }

      // Deduplicate historical notifications in memory
      const deduplicated = NotificationService.deduplicateNotifications(validNotifications);

      // Apply lastFetchTime filter if provided
      const filteredResults = options?.lastFetchTime
        ? deduplicated.filter((n: any) => new Date(n.createdAt) >= options.lastFetchTime!)
        : deduplicated;

      // Cache the results
      this.cache.set(cacheKey, { data: filteredResults, timestamp: now });

      return filteredResults;

    } catch (error) {
      console.error('Notification fetch error:', error);
      return []; // Return empty array to prevent UI crashes
    }
  }

  /**
   * Get accurate unread count after deduplicating notifications and enforcing RBAC
   */
  public async getUnreadCount(userId: number, options?: { user?: AuthenticatedUser }): Promise<number> {
    try {
      let unreadList: any[];
      try {
        unreadList = await db
          .select()
          .from(notifications)
          .where(and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          ))
          .orderBy(desc(notifications.createdAt));
      } catch (e: any) {
        if (e?.code === '42703') {
          unreadList = await db
            .select({
              id: notifications.id,
              userId: notifications.userId,
              requestId: notifications.requestId,
              title: notifications.title,
              message: notifications.message,
              type: notifications.type,
              priority: notifications.priority,
              isRead: notifications.isRead,
              isAcknowledged: notifications.isAcknowledged,
              link: notifications.link,
              actionType: notifications.actionType,
              actionData: notifications.actionData,
              expiresAt: notifications.expiresAt,
              createdAt: notifications.createdAt,
              updatedAt: notifications.updatedAt
            })
            .from(notifications)
            .where(and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, false)
            ))
            .orderBy(desc(notifications.createdAt));
        } else {
          throw e;
        }
      }

      // Defense-in-depth RBAC check
      if (options?.user) {
        unreadList = unreadList.filter((notification: any) =>
          this.isUserEligibleForNotification(notification, options.user!)
        );
      }

      const deduplicated = NotificationService.deduplicateNotifications(unreadList);
      return deduplicated.length;
    } catch (error) {
      console.error('Get unread count error:', error);
      return 0;
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

    this.cache.delete(`notifications_${userId}`);
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

    this.cache.delete(`notifications_${userId}`);
    return updated;
  }

  /**
   * Mark pending action notifications (e.g. approval_required, purchase_request_submitted)
   * for a request as completed and read once an action is taken.
   */
  public async markPendingActionsCompleted(requestId: number, approverId?: number) {
    try {
      const filters: any[] = [
        eq(notifications.requestId, requestId),
        eq(notifications.isRead, false),
        or(
          eq(notifications.type, 'approval_required'),
          eq(notifications.type, 'purchase_request_submitted')
        )
      ];

      if (approverId) {
        filters.push(eq(notifications.userId, approverId));
      }

      await db
        .update(notifications)
        .set({
          isRead: true,
          isAcknowledged: true,
          updatedAt: new Date()
        })
        .where(and(...filters));

      if (approverId) {
        this.cache.delete(`notifications_${approverId}`);
      }
    } catch (error) {
      console.error('[NotificationService] Error marking pending actions completed:', error);
    }
  }

  /**
   * Map runtime notification types to user preference types
   */
  public static mapEventToPreferenceType(eventType: string): string {
    switch (eventType) {
      case 'approval_required':
      case 'pending_approval':
        return 'pending_approval';
      case 'purchase_request_submitted':
      case 'new_request':
        return 'new_request';
      case 'purchase_request_approved':
      case 'approval_granted':
        return 'approval_granted';
      case 'purchase_request_rejected':
      case 'approval_rejected':
        return 'approval_rejected';
      case 'purchase_request_changes_requested':
      case 'changes_requested':
        return 'changes_requested';
      case 'vendor_created':
      case 'vendor_updated':
      case 'vendor_status_change':
      case 'vendor_deactivated':
        return 'vendor_status_change';
      case 'system_maintenance':
      case 'system_update':
      case 'system_error':
        return 'system_update';
      default:
        return eventType;
    }
  }

  /**
   * Get notification preferences for a user, ensuring master switch and defaults exist.
   * Default state: email notifications are OFF (both master switch and all types).
   */
  public async getUserNotificationPreferences(userId: number) {
    const [user] = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userEmail = user?.email || "";

    const existingRows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    const existingMap = new Map(existingRows.map(r => [r.type, r]));
    const toInsert: Array<typeof notificationPreferences.$inferInsert> = [];

    // 1. Ensure Global Master Email Switch row exists (default: emailEnabled = false)
    if (!existingMap.has(GLOBAL_EMAIL_PREFERENCE_TYPE)) {
      toInsert.push({
        userId,
        category: 'global',
        type: GLOBAL_EMAIL_PREFERENCE_TYPE,
        enabled: true,
        inAppEnabled: true,
        emailEnabled: false, // Default is OFF
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 2. Ensure each default notification type row exists (default: emailEnabled = false)
    for (const def of DEFAULT_NOTIFICATION_TYPES) {
      if (!existingMap.has(def.type)) {
        toInsert.push({
          userId,
          category: def.category,
          type: def.type,
          enabled: true,
          inAppEnabled: def.defaultInApp,
          emailEnabled: def.defaultEmail, // Default is OFF
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (toInsert.length > 0) {
      const inserted = await db
        .insert(notificationPreferences)
        .values(toInsert)
        .returning();
      for (const row of inserted) {
        existingMap.set(row.type, row);
      }
    }

    // Extract master switch state
    const globalRow = existingMap.get(GLOBAL_EMAIL_PREFERENCE_TYPE);
    const masterEmailEnabled = Boolean(globalRow?.emailEnabled);

    // Build enriched list of granular preferences with human-friendly label and description
    const defMap = new Map(DEFAULT_NOTIFICATION_TYPES.map(d => [d.type, d]));
    const preferences = Array.from(existingMap.values())
      .filter(r => r.type !== GLOBAL_EMAIL_PREFERENCE_TYPE)
      .map(r => {
        const def = defMap.get(r.type);
        return {
          id: r.id,
          userId: r.userId,
          category: r.category,
          type: r.type,
          label: def?.label || r.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: def?.description || 'Receive alerts for this activity',
          enabled: r.enabled,
          inAppEnabled: r.inAppEnabled,
          emailEnabled: r.emailEnabled,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        };
      })
      .sort((a, b) => {
        const orderA = DEFAULT_NOTIFICATION_TYPES.findIndex(d => d.type === a.type);
        const orderB = DEFAULT_NOTIFICATION_TYPES.findIndex(d => d.type === b.type);
        if (orderA !== -1 && orderB !== -1) return orderA - orderB;
        return a.label.localeCompare(b.label);
      });

    return {
      masterEmailEnabled,
      userEmail,
      preferences
    };
  }

  /**
   * Update all preferences in one request (master toggle + granular toggles)
   */
  public async updateAllPreferences(userId: number, data: {
    masterEmailEnabled?: boolean;
    preferences?: Array<{
      id?: number;
      type: string;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
      enabled?: boolean;
    }>;
  }) {
    // 1. Update Master Email Switch
    if (typeof data.masterEmailEnabled === 'boolean') {
      const [existingGlobal] = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, GLOBAL_EMAIL_PREFERENCE_TYPE)
        ))
        .limit(1);

      if (existingGlobal) {
        await db
          .update(notificationPreferences)
          .set({
            emailEnabled: data.masterEmailEnabled,
            updatedAt: new Date()
          })
          .where(eq(notificationPreferences.id, existingGlobal.id));
      } else {
        await db
          .insert(notificationPreferences)
          .values({
            userId,
            category: 'global',
            type: GLOBAL_EMAIL_PREFERENCE_TYPE,
            enabled: true,
            inAppEnabled: true,
            emailEnabled: data.masterEmailEnabled,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
    }

    // 2. Update individual granular preferences
    if (Array.isArray(data.preferences)) {
      for (const item of data.preferences) {
        if (!item.type) continue;

        const updateData: { emailEnabled?: boolean; inAppEnabled?: boolean; enabled?: boolean; updatedAt: Date } = {
          updatedAt: new Date()
        };
        if (typeof item.emailEnabled === 'boolean') updateData.emailEnabled = item.emailEnabled;
        if (typeof item.inAppEnabled === 'boolean') updateData.inAppEnabled = item.inAppEnabled;
        if (typeof item.enabled === 'boolean') updateData.enabled = item.enabled;

        if (item.id) {
          await db
            .update(notificationPreferences)
            .set(updateData)
            .where(and(
              eq(notificationPreferences.id, item.id),
              eq(notificationPreferences.userId, userId)
            ));
        } else {
          // Find by type
          const [found] = await db
            .select()
            .from(notificationPreferences)
            .where(and(
              eq(notificationPreferences.userId, userId),
              eq(notificationPreferences.type, item.type)
            ))
            .limit(1);

          if (found) {
            await db
              .update(notificationPreferences)
              .set(updateData)
              .where(eq(notificationPreferences.id, found.id));
          }
        }
      }
    }

    return this.getUserNotificationPreferences(userId);
  }

  /**
   * Update a specific notification preference
   */
  public async updateNotificationPreference(preferenceId: number, userId: number, data: {
    enabled?: boolean;
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
  }) {
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
   * Evaluates user preferences and dispatches an email via Resend if eligible.
   * Completely non-blocking and safe against uncaught exceptions.
   */
  public async dispatchEmailNotificationIfEligible({
    userId,
    title,
    message,
    type,
    requestId,
    priority,
    actionType,
    link
  }: {
    userId: number;
    title: string;
    message: string;
    type: string;
    requestId?: number;
    priority?: NotificationPriority;
    actionType?: NotificationActionType;
    link?: string | null;
  }): Promise<void> {
    try {
      // 1. Fetch user email
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || !user.email) {
        return;
      }

      // 2. Check Master Email Switch (Default is OFF)
      const [globalPref] = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, GLOBAL_EMAIL_PREFERENCE_TYPE)
        ))
        .limit(1);

      if (!globalPref || !globalPref.emailEnabled) {
        // Master switch is OFF: skip sending email
        return;
      }

      // 3. Map event type to granular preference type
      const prefType = NotificationService.mapEventToPreferenceType(type);

      // 4. Check Granular Event Preference
      const [eventPref] = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, prefType)
        ))
        .limit(1);

      // If user hasn't explicitly enabled this event type, skip email
      if (!eventPref || !eventPref.emailEnabled) {
        return;
      }

      // 5. Gather request context if available
      let requestNumber: string | undefined;
      let requesterName: string | undefined;
      let department: string | undefined;
      let amount: number | string | undefined;
      let currency: string | undefined;
      let vendorName: string | undefined;
      let paymentStructure: string | undefined;
      let items: any[] | undefined;
      let actions: { approveUrl: string; rejectUrl: string; changesUrl: string } | undefined;

      if (requestId) {
        try {
          const [req] = await db
            .select({
              requestNumber: purchaseRequests.requestNumber,
              department: purchaseRequests.department,
              totalEstimatedCost: purchaseRequests.totalEstimatedCost,
              currency: purchaseRequests.currency,
              paymentStructure: purchaseRequests.paymentStructure,
              items: purchaseRequests.items,
              requesterId: purchaseRequests.requesterId,
              vendorId: purchaseRequests.vendorId,
            })
            .from(purchaseRequests)
            .where(eq(purchaseRequests.id, requestId))
            .limit(1);

          if (req) {
            requestNumber = req.requestNumber;
            department = req.department || undefined;
            amount = req.totalEstimatedCost ?? undefined;
            currency = req.currency || "QAR";
            paymentStructure = req.paymentStructure || undefined;

            try {
              items = typeof req.items === "string" ? JSON.parse(req.items) : (req.items || []);
            } catch {
              items = undefined;
            }

            if (req.requesterId) {
              const [reqUser] = await db
                .select({ username: users.username })
                .from(users)
                .where(eq(users.id, req.requesterId))
                .limit(1);
              if (reqUser) requesterName = reqUser.username;
            }

            if (req.vendorId) {
              const [ven] = await db
                .select({ companyName: vendors.companyName })
                .from(vendors)
                .where(eq(vendors.id, req.vendorId))
                .limit(1);
              if (ven) vendorName = ven.companyName;
            }

            // If this notification is for an approver, generate personalized 1-click action URLs
            if (type.includes("approval_required") || type.includes("pending_approval")) {
              try {
                actions = await emailActionService.generateActionUrls({
                  requestId,
                  approverId: userId,
                });
              } catch (tokenErr) {
                console.warn("[NotificationService] Failed to generate email action token:", tokenErr);
              }
            }
          }
        } catch (ctxErr) {
          console.warn("[NotificationService] Non-fatal error loading request context for email:", ctxErr);
        }
      }

      // 6. Send email via Resend
      await emailService.sendNotificationEmail({
        to: user.email,
        userName: user.username,
        type,
        title,
        message,
        requestId,
        requestNumber,
        requesterName,
        department,
        amount,
        currency,
        vendorName,
        paymentStructure,
        items,
        actions,
        actionUrl: link || undefined,
        priority
      });
    } catch (err) {
      console.error(`[NotificationService] Error in dispatchEmailNotificationIfEligible for user ${userId}:`, err);
    }
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
    if (!routePattern) return '/dashboard/requests';

    let link = routePattern;
    const resolvedId = params.requestId ?? params.id ?? params.vendorId ?? '';

    // Replace both {id} and {requestId}
    link = link.replace(/\{id\}/g, String(resolvedId)).replace(/\{requestId\}/g, String(resolvedId));

    // Replace any remaining parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        link = link.replace(new RegExp(`\\{${key}\\}`, 'g'), String(params[key]));
      }
    });

    // If an ID placeholder was not provided or empty, fallback cleanly
    link = link.replace(/\/\{[^}]+\}/g, '').replace(/\{[^}]+\}/g, '');

    return link || '/dashboard/requests';
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