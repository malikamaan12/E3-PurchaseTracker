import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// Constants
const POLLING_INTERVAL = 30000; // 30 seconds
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

  // Safe fetch function with comprehensive error handling
  const fetchNotifications = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = buildQueryParams();
      const queryString = params ? `?${params}` : '';
      
      const response = await fetch(`/api/notifications${queryString}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setNotifications(Array.isArray(data) ? data : []);
      setLastFetchTime(new Date());
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err);
      // Don't update notifications on error to maintain current state
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryParams]);

  // Setup polling with cleanup
  useEffect(() => {
    // Add sample notifications to demonstrate quick actions
    const sampleNotifications: Notification[] = [
      {
        id: 1,
        userId: 32,
        requestId: 177,
        title: "Purchase Request Approval Required",
        message: "Trade Show Booth Materials request requires your approval. Total cost: $4,200",
        type: "approval_required",
        priority: "high",
        isRead: false,
        isAcknowledged: false,
        link: "/requests/177",
        actionType: "approve",
        actionData: { requestId: 177 },
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        userId: 32,
        requestId: 178,
        title: "Request Needs Review",
        message: "Marketing Materials request has been updated and needs review",
        type: "review_required",
        priority: "normal",
        isRead: false,
        isAcknowledged: false,
        link: "/requests/178",
        actionType: "review",
        actionData: { requestId: 178 },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        updatedAt: new Date().toISOString()
      },
      {
        id: 3,
        userId: 32,
        requestId: 179,
        title: "System Notification",
        message: "Budget threshold exceeded for Q2 2025. Please acknowledge this alert.",
        type: "system_alert",
        priority: "low",
        isRead: false,
        isAcknowledged: false,
        link: "/dashboard",
        actionType: "acknowledge",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        updatedAt: new Date().toISOString()
      }
    ];

    // Set sample notifications instead of fetching
    setNotifications(sampleNotifications);
    setIsLoading(false);

    // Uncomment the lines below to enable real API calls
    // fetchNotifications();
    // if (autoPolling) {
    //   const interval = setInterval(fetchNotifications, pollInterval);
    //   return () => clearInterval(interval);
    // }
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
        
        // Refetch notifications after successful mutation
        await fetchNotifications();
        
        return result;
      } catch (err) {
        console.error(`Error in ${method} ${endpoint}:`, err);
        throw err;
      }
    };
  };

  // Action handlers
  const markAsRead = useCallback(createSafeMutation('/api/notifications/:id/read'), []);
  const acknowledgeNotification = useCallback(createSafeMutation('/api/notifications/:id/acknowledge'), []);
  
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
          body = { action: 'approve', ...actionData };
          break;
        case 'reject':
          endpoint = `/api/requests/${requestId}/approvals`;
          body = { action: 'reject', ...actionData };
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
        default:
          throw new Error(`Unsupported action type: ${actionType}`);
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

      if (onActionError) {
        onActionError(actionType, notificationId, err as NotificationError);
      }
      
      throw err;
    }
  }, [markAsRead, toast, onActionSuccess, onActionError]);

  // Navigation handler
  const handleNavigate = useCallback((notification: Notification) => {
    if (notification.requestId) {
      setLocation(`/requests/${notification.requestId}`);
    } else if (notification.link) {
      setLocation(notification.link);
    } else {
      setLocation('/dashboard');
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