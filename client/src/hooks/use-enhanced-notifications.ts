import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// Constants
const POLLING_INTERVAL = 120000; // 2 minutes
const API_BASE_URL = '/api/notifications';
const CACHE_KEY = 'notifications_cache';
const CACHE_TTL = 60000; // 1 minute cache (reduced from 5 min so reads show faster)

export interface Notification {
  id: number;
  userId: number;
  requestId?: number | null;
  title: string;
  message: string;
  type: string;
  priority: 'high' | 'normal' | 'low';
  isRead: boolean;
  isAcknowledged: boolean;
  link: string | null;
  actionType?: string | null;
  actionData?: Record<string, any> | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotificationError extends Error {
  status?: number;
  details?: any;
}

/**
 * Enhanced hook for notifications with optimistic updates and stable UI
 */
export function useEnhancedNotifications(options?: {
  autoPolling?: boolean;
  pollInterval?: number;
  includeRead?: boolean;
  filterType?: string;
  filterPriority?: 'high' | 'normal' | 'low';
  userRole?: string;
  userDepartment?: string;
  onActionSuccess?: (actionType: string, notificationId: number, result: any) => void;
  onActionError?: (actionType: string, notificationId: number, error: NotificationError) => void;
}) {
  const {
    autoPolling = true,
    pollInterval = POLLING_INTERVAL,
    includeRead = true,
    filterType,
    filterPriority,
    userRole,
    userDepartment,
    onActionSuccess,
    onActionError
  } = options || {};

  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  // Track in-flight fetch to avoid double-fetching
  const fetchingRef = useRef(false);

  // Clear localStorage cache
  const clearNotificationsCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  // Fetch from server — always bypasses browser ETag cache with timestamp param
  const fetchFromServer = useCallback(async (): Promise<Notification[]> => {
    const bust = Date.now();
    const response = await fetch(`/api/notifications/fast?_=${bust}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }, []);

  // Main fetch — checks localStorage cache first, then server
  const fetchNotifications = useCallback(async (force = false): Promise<void> => {
    if (fetchingRef.current) return;

    // Check localStorage cache (unless force=true)
    if (!force) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            console.log('Using cached notifications');
            setNotifications(Array.isArray(data) ? data : []);
            setIsLoading(false);
            setError(null);
            return;
          }
        } catch (_) {
          // Invalid cache, fall through to fetch
        }
      }
    }

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchFromServer();
      setNotifications(data);

      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchFromServer]);

  // Setup polling
  useEffect(() => {
    if (autoPolling) {
      fetchNotifications();
      const interval = setInterval(() => fetchNotifications(), pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications, autoPolling, pollInterval]);

  // Optimistic markAsRead — updates local state immediately, then syncs with server
  const markAsRead = useCallback(async (id: number): Promise<void> => {
    // Optimistic update in local state
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

    // Update localStorage cache to reflect read status immediately
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const updatedData = parsed.data.map((n: Notification) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: updatedData, timestamp: parsed.timestamp }));
      } catch (_) {
        clearNotificationsCache();
      }
    }

    // Sync with server in background
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // On failure, force refresh from server to revert
      clearNotificationsCache();
      fetchNotifications(true);
    }
  }, [clearNotificationsCache, fetchNotifications]);

  // Acknowledge notification
  const acknowledgeNotification = useCallback(async (id: number): Promise<void> => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isAcknowledged: true, isRead: true } : n));

    try {
      const response = await fetch(`/api/notifications/${id}/acknowledge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.error('Error acknowledging notification:', err);
      clearNotificationsCache();
      fetchNotifications(true);
    }
  }, [clearNotificationsCache, fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async (): Promise<void> => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    // Update localStorage cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const updatedData = parsed.data.map((n: Notification) => ({ ...n, isRead: true }));
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: updatedData, timestamp: parsed.timestamp }));
      } catch (_) {
        clearNotificationsCache();
      }
    }

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
      // Revert on failure
      clearNotificationsCache();
      fetchNotifications(true);
    }
  }, [toast, clearNotificationsCache, fetchNotifications]);

  // Quick action handler — only one toast per action (no duplicate)
  const performQuickAction = useCallback(async (params: {
    actionType?: string;
    notificationId: number;
    requestId?: number | null;
    actionData?: Record<string, any>;
  }) => {
    const { actionType, notificationId, requestId, actionData = {} } = params;

    if (!actionType) {
      throw new Error('Action type is required');
    }

    try {
      let endpoint = '';
      let method = 'POST';
      let body: Record<string, any> = actionData;

      switch (actionType) {
        case 'approve':
          endpoint = `/api/requests/${requestId}/approvals`;
          body = { status: 'approved', ...actionData };
          break;
        case 'reject':
          endpoint = `/api/requests/${requestId}/approvals`;
          body = { status: 'rejected', ...actionData };
          break;
        case 'acknowledge':
          await acknowledgeNotification(notificationId);
          if (onActionSuccess) onActionSuccess(actionType, notificationId, {});
          return {};
        case 'dismiss':
          await markAsRead(notificationId);
          if (onActionSuccess) onActionSuccess(actionType, notificationId, {});
          return {};
        case 'review':
        case 'view':
        case 'update':
        case 'complete':
        default:
          // Navigate to request page and mark as read
          await markAsRead(notificationId);
          if (requestId) {
            setLocation(`/requests/${requestId}`);
          }
          if (onActionSuccess) onActionSuccess(actionType, notificationId, {});
          return {};
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Mark notification as read after successful action
      await markAsRead(notificationId);

      // Single toast for the action
      toast({
        title: "Success",
        description: `Request ${actionType}d successfully`,
      });

      if (onActionSuccess) onActionSuccess(actionType, notificationId, result);

      return result;
    } catch (err) {
      console.error(`Error performing quick action ${actionType}:`, err);

      toast({
        title: "Error",
        description: `Failed to ${actionType}. Please try again.`,
        variant: "destructive",
      });

      if (onActionError && actionType) {
        onActionError(actionType, notificationId, err as NotificationError);
      }

      throw err;
    }
  }, [markAsRead, acknowledgeNotification, toast, onActionSuccess, onActionError, setLocation]);

  // Navigation handler
  const handleNavigate = useCallback((notification: Notification) => {
    if (notification.requestId) {
      setLocation(`/requests/${notification.requestId}`);
    } else if (notification.link && notification.link !== '/' && notification.link !== '') {
      setLocation(notification.link);
    } else if (notification.type === 'account_request') {
      setLocation('/admin');
    } else {
      setLocation('/notifications');
    }
  }, [setLocation]);

  // Computed counts
  const notificationArray = Array.isArray(notifications) ? notifications : [];
  const unreadCount = notificationArray.filter(n => !n.isRead).length;
  const highPriorityCount = notificationArray.filter(n => !n.isRead && n.priority === 'high').length;
  const unacknowledgedCount = notificationArray.filter(n => !n.isAcknowledged).length;
  const expiredCount = notificationArray.filter(n =>
    n.expiresAt && new Date(n.expiresAt) < new Date() && !n.isRead
  ).length;
  const actionableCount = notificationArray.filter(n =>
    !n.isRead && n.actionType && ['approve', 'review', 'acknowledge', 'update'].includes(n.actionType)
  ).length;

  return {
    notifications,
    unreadCount,
    highPriorityCount,
    unacknowledgedCount,
    expiredCount,
    actionableCount,
    isLoading,
    error,
    markAsRead,
    acknowledgeNotification,
    markAllAsRead,
    performAction: performQuickAction,
    handleNavigate,
    refetch: () => fetchNotifications(true)
  };
}

export default useEnhancedNotifications;
