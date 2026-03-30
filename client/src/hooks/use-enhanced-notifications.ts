import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// Constants - reduced polling to prevent excessive refreshing
const POLLING_INTERVAL = 120000; // 2 minutes (reduced from 30 seconds)
const API_BASE_URL = '/api/notifications';

export interface Notification {
  id: number;
  userId: number;
  requestId?: number;
  title: string;
  message: string;
  type: string;
  priority: 'high' | 'normal' | 'low';
  isRead: boolean;
  isAcknowledged: boolean;
  link: string | null;
  actionType?: string;
  actionData?: Record<string, any>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationError extends Error {
  status?: number;
  details?: any;
}

const MAX_RETRIES = 3;

/**
 * Enhanced hook for interacting with notifications with improved stability
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
    autoPolling = true, // Re-enabled with aggressive caching
    pollInterval = POLLING_INTERVAL,
    includeRead = true,
    filterType,
    filterPriority,
    userRole,
    userDepartment,
    onActionSuccess,
    onActionError
  } = options || {};

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Build query parameters
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    if (lastFetchTime && lastFetchTime instanceof Date && !isNaN(lastFetchTime.getTime())) {
      params.append('lastFetchTime', lastFetchTime.toISOString());
    }
    
    if (!includeRead) {
      params.append('includeRead', 'false');
    }
    
    if (filterType) {
      params.append('type', filterType);
    }
    
    if (filterPriority) {
      params.append('priority', filterPriority);
    }

    if (userRole) {
      params.append('userRole', userRole);
    }
    
    if (userDepartment) {
      params.append('userDepartment', userDepartment);
    }
    
    return params.toString();
  }, [lastFetchTime, includeRead, filterType, filterPriority, userRole, userDepartment]);

  // Optimized fetch function with aggressive client-side caching
  const fetchNotifications = useCallback(async (): Promise<void> => {
    // Check localStorage cache first (5-minute cache)
    const cacheKey = 'notifications_cache';
    const cached = localStorage.getItem(cacheKey);
    const now = Date.now();
    
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < 300000) { // 5 minutes cache
          console.log('Using cached notifications');
          setNotifications(Array.isArray(data) ? data : []);
          setIsLoading(false);
          setError(null);
          return;
        }
      } catch (e) {
        // Invalid cache, continue to fetch
      }
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Use fast endpoint
      const response = await fetch(`/api/notifications/fast`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const notifications = Array.isArray(data) ? data : [];
      
      setNotifications(notifications);
      setLastFetchTime(new Date());
      
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({
        data: notifications,
        timestamp: now
      }));
      
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err);
      // Use cached data if available on error
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          setNotifications(Array.isArray(data) ? data : []);
        } catch (e) {
          setNotifications([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear cache function
  const clearNotificationsCache = useCallback(() => {
    localStorage.removeItem('notifications_cache');
  }, []);

  // Setup polling with cleanup
  useEffect(() => {
    // Only fetch on mount if autoPolling is enabled, otherwise manual only
    if (autoPolling) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications, autoPolling, pollInterval]);

  // Safe mutation function wrapper
  const createSafeMutation = (endpoint: string, method: string = 'PUT') => {
    return async (id: number, body?: any) => {
      try {
        const response = await fetch(endpoint.replace(':id', id.toString()), {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        // Clear cache and refetch notifications after successful mutation
        clearNotificationsCache();
        await fetchNotifications();
        
        return result;
      } catch (err) {
        console.error(`Error in ${method} ${endpoint}:`, err);
        throw err;
      }
    };
  };

  // Action handlers
  const markAsRead = useCallback(createSafeMutation('/api/notifications/:id/read'), [clearNotificationsCache]);
  const acknowledgeNotification = useCallback(createSafeMutation('/api/notifications/:id/acknowledge'), [clearNotificationsCache]);
  
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      clearNotificationsCache();
      await fetchNotifications();
      
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
      
      return await response.json();
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
      throw err;
    }
  }, [toast, fetchNotifications]);

  // Enhanced quick action handler
  const performQuickAction = useCallback(async (params: {
    actionType?: string;
    notificationId: number;
    requestId?: number;
    actionData?: Record<string, any>;
  }) => {
    const { actionType, notificationId, requestId, actionData = {} } = params;
    
    if (!actionType) {
      throw new Error('Action type is required');
    }
    
    try {
      let endpoint = '';
      let method = 'POST';
      let body = actionData;
      
      // Determine endpoint based on action type
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
          endpoint = `/api/notifications/${notificationId}/acknowledge`;
          method = 'PUT';
          body = {};
          break;
        case 'dismiss':
          endpoint = `/api/notifications/${notificationId}/read`;
          method = 'PUT';
          body = {};
          break;
        case 'review':
        case 'view':
        case 'update':
        case 'complete':
        default:
          // For navigation-based actions, mark notification as read and navigate
          await markAsRead(notificationId);
          if (requestId) {
            setLocation(`/requests/${requestId}`);
          }
          if (onActionSuccess) {
            onActionSuccess(actionType, notificationId, {});
          }
          return {};
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Mark notification as read after successful action
      await markAsRead(notificationId);
      
      // Show success toast
      toast({
        title: "Success",
        description: `Action "${actionType}" completed successfully`,
      });

      if (onActionSuccess) {
        onActionSuccess(actionType, notificationId, result);
      }

      return result;
    } catch (err) {
      console.error(`Error performing quick action ${actionType}:`, err);
      
      toast({
        title: "Error",
        description: `Failed to ${actionType} notification`,
        variant: "destructive",
      });

      if (onActionError && actionType) {
        onActionError(actionType, notificationId, err as NotificationError);
      }
      
      throw err;
    }
  }, [markAsRead, toast, onActionSuccess, onActionError]);

  // Navigation handler
  const handleNavigate = useCallback((notification: Notification) => {
    if (notification.requestId) {
      setLocation(`/requests/${notification.requestId}`);
    } else if (notification.link && notification.link !== '/' && notification.link !== '') {
      setLocation(notification.link);
    } else {
      setLocation('/');
    }
  }, [setLocation]);

  // Calculate counts safely
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
    refetch: fetchNotifications
  };
}

export default useEnhancedNotifications;