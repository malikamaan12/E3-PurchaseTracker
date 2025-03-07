import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Enhanced notification type
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

// Error type
interface NotificationError extends Error {
  status?: number;
  details?: any;
}

// Configuration constants
const POLLING_INTERVAL = 30000; // 30 seconds
const STALE_TIME = 30000; // 30 seconds
const MAX_RETRIES = 3;

/**
 * Enhanced hook for interacting with notifications
 */
export function useEnhancedNotifications(options?: {
  autoPolling?: boolean;
  pollInterval?: number;
  includeRead?: boolean;
  filterType?: string;
  filterPriority?: 'high' | 'normal' | 'low';
}) {
  const {
    autoPolling = true,
    pollInterval = POLLING_INTERVAL,
    includeRead = true,
    filterType,
    filterPriority
  } = options || {};

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pollTimerRef, setPollTimerRef] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Build query params
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    if (lastFetchTime) {
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
    
    return params.toString();
  }, [lastFetchTime, includeRead, filterType, filterPriority]);

  // Fetch notifications
  const { 
    data: notifications = [], 
    isLoading,
    error,
    refetch
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', includeRead, filterType, filterPriority],
    queryFn: async () => {
      const params = buildQueryParams();
      const queryString = params ? `?${params}` : '';
      const response = await fetch(`/api/notifications${queryString}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = new Error('Failed to fetch notifications') as NotificationError;
        error.status = response.status;
        throw error;
      }
      
      return response.json();
    },
    staleTime: STALE_TIME,
    enabled: true,
    retry: MAX_RETRIES,
    refetchOnWindowFocus: true
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = new Error('Failed to mark notification as read') as NotificationError;
        error.status = response.status;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error: NotificationError) => {
      console.error("Failed to mark notification as read:", error);
      toast({
        title: "Error",
        description: error.status === 404 
          ? "Notification not found or already processed"
          : "Failed to update notification",
        variant: "destructive",
      });
    },
    retry: MAX_RETRIES
  });

  // Acknowledge notification
  const acknowledgeNotification = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/acknowledge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = new Error('Failed to acknowledge notification') as NotificationError;
        error.status = response.status;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error: NotificationError) => {
      console.error("Failed to acknowledge notification:", error);
      toast({
        title: "Error",
        description: error.status === 404 
          ? "Notification not found or already processed"
          : "Failed to acknowledge notification",
        variant: "destructive",
      });
    },
    retry: MAX_RETRIES
  });

  // Mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = new Error('Failed to mark all notifications as read') as NotificationError;
        error.status = response.status;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error: NotificationError) => {
      console.error("Failed to mark all notifications as read:", error);
      toast({
        title: "Error",
        description: "Failed to update notifications",
        variant: "destructive",
      });
    },
    retry: MAX_RETRIES
  });

  // Setup polling
  useEffect(() => {
    const startPolling = () => {
      if (autoPolling && !pollTimerRef) {
        const id = window.setInterval(() => {
          setLastFetchTime(new Date());
          refetch();
        }, pollInterval);
        setPollTimerRef(id);
        return id;
      }
      return null;
    };

    const timerId = startPolling();

    // Cleanup polling on unmount
    return () => {
      if (pollTimerRef) {
        window.clearInterval(pollTimerRef);
        setPollTimerRef(null);
      }
      if (timerId) {
        window.clearInterval(timerId);
      }
    };
  }, [autoPolling, pollInterval, refetch]);

  // Safely calculate counts
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
    markAsRead: (id: number) => markAsRead.mutate(id),
    acknowledgeNotification: (id: number) => acknowledgeNotification.mutate(id),
    markAllAsRead: () => markAllAsRead.mutate(),
    refetch: () => {
      setLastFetchTime(new Date());
      return queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  };
}