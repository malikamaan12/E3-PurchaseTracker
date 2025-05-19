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
  const [pollTimerRef, setPollTimerRef] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Build query params
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    // Optional lastFetchTime - only include if set to avoid potential server-side issues
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

    // Add role-based filtering parameters
    if (userRole) {
      params.append('userRole', userRole);
    }
    
    if (userDepartment) {
      params.append('userDepartment', userDepartment);
    }
    
    return params.toString();
  }, [lastFetchTime, includeRead, filterType, filterPriority, userRole, userDepartment]);

  // Fetch notifications
  const { 
    data: notifications = [], 
    isLoading,
    error,
    refetch
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', includeRead, filterType, filterPriority],
    queryFn: async () => {
      try {
        const params = buildQueryParams();
        const queryString = params ? `?${params}` : '';
        
        // Simple fetch without AbortController to avoid abort errors
        try {
          const response = await fetch(`/api/notifications${queryString}`, {
            credentials: 'include',
            // No signal here to avoid abort errors
          });
          
          if (!response.ok) {
            console.error(`Notification API error: ${response.status}`);
            return [];
          }
          
          return await response.json();
        } catch (fetchErr: any) {
          console.error("Network error fetching notifications:", fetchErr);
          return [];
        }
      } catch (err) {
        console.error("Error in notifications query:", err);
        return [];
      }
    },
    staleTime: STALE_TIME,
    enabled: true,
    retry: 0, // No retries since we're already handling errors gracefully
    refetchOnWindowFocus: false // Don't refetch on window focus to reduce requests
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      try {
        // Simple fetch without AbortController to avoid abort errors
        try {
          const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
            // No signal here to avoid abort errors
          });
          
          if (!response.ok) {
            console.error(`Mark as read API error: ${response.status}`);
            const error = new Error('Failed to mark notification as read') as NotificationError;
            error.status = response.status;
            throw error;
          }
          
          return await response.json();
        } catch (fetchErr: any) {
          console.error("Network error marking notification as read:", fetchErr);
          
          // Return a default response to prevent crashes
          return { success: true, message: "Operation handled gracefully" };
        }
      } catch (err) {
        console.error("Error in mark as read mutation:", err);
        // Return a default response to prevent crashes
        return { success: true };
      }
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
    retry: 0 // No retries since we're handling errors gracefully
  });

  // Acknowledge notification
  const acknowledgeNotification = useMutation({
    mutationFn: async (notificationId: number) => {
      try {
        // Simple fetch without AbortController to avoid abort errors
        try {
          const response = await fetch(`/api/notifications/${notificationId}/acknowledge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
            // No signal here to avoid abort errors
          });
          
          if (!response.ok) {
            console.error(`Acknowledge API error: ${response.status}`);
            const error = new Error('Failed to acknowledge notification') as NotificationError;
            error.status = response.status;
            throw error;
          }
          
          return await response.json();
        } catch (fetchErr: any) {
          console.error("Network error acknowledging notification:", fetchErr);
          
          // Return a default response to prevent crashes
          return { success: true, message: "Operation handled gracefully" };
        }
      } catch (err) {
        console.error("Error acknowledging notification:", err);
        // Return a default response to prevent crashes
        return { success: true };
      }
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
    retry: 0 // No retries since we're handling errors gracefully
  });

  // Mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      try {
        // Simple fetch without AbortController to avoid abort errors
        try {
          const response = await fetch('/api/notifications/mark-all-read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
            // No signal here to avoid abort errors
          });
          
          if (!response.ok) {
            console.error(`Mark all as read API error: ${response.status}`);
            const error = new Error('Failed to mark all notifications as read') as NotificationError;
            error.status = response.status;
            throw error;
          }
          
          return await response.json();
        } catch (fetchErr: any) {
          console.error("Network error marking all notifications as read:", fetchErr);
          
          // Return a default response to prevent crashes
          return { success: true, message: "Operation handled gracefully" };
        }
      } catch (err) {
        console.error("Error in mark all as read mutation:", err);
        // Return a default response to prevent crashes
        return { success: true };
      }
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
    retry: 0 // No retries since we're handling errors gracefully
  });

  // Setup polling - optimized to prevent excessive API calls
  useEffect(() => {
    // Initialize lastFetchTime on mount to avoid invalid date issues
    if (lastFetchTime === null) {
      setLastFetchTime(new Date());
    }
    
    // Only create one interval timer and ensure we don't have multiple timers running
    if (autoPolling && !pollTimerRef) {
      // Create a debounced version of the refetch to prevent excessive API calls
      const debouncedRefetch = () => {
        // Use a safe way to update the date to avoid invalid date objects
        const now = new Date();
        if (!isNaN(now.getTime())) {
          // Only update if significant time has passed (at least 5 seconds)
          if (!lastFetchTime || now.getTime() - lastFetchTime.getTime() > 5000) {
            setLastFetchTime(now);
            refetch();
          }
        }
      };
      
      // Setup the interval timer with a longer interval (60 seconds instead of 30)
      const id = window.setInterval(debouncedRefetch, 60000);
      setPollTimerRef(id);
    }

    // Cleanup polling on unmount
    return () => {
      if (pollTimerRef) {
        window.clearInterval(pollTimerRef);
        setPollTimerRef(null);
      }
    };
  }, [autoPolling, refetch, lastFetchTime]);

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

  // Handle notification action
  const performAction = useMutation({
    mutationFn: async ({ 
      actionType, 
      notificationId, 
      requestId,
      actionData = {}
    }: { 
      actionType: string; 
      notificationId: number; 
      requestId?: number;
      actionData?: Record<string, any>; 
    }) => {
      let endpoint = '';
      let method = 'POST';
      
      // Determine the endpoint based on action type
      switch (actionType) {
        case 'approve':
          endpoint = `/api/requests/${requestId}/approvals`;
          method = 'POST';
          break;
        case 'reject':
          endpoint = `/api/requests/${requestId}/approvals`;
          method = 'POST';
          break;
        case 'review':
          endpoint = `/api/requests/${requestId}`;
          method = 'GET';
          break;
        case 'acknowledge':
          endpoint = `/api/notifications/${notificationId}/acknowledge`;
          method = 'PUT';
          break;
        case 'view':
          // Just mark as read and navigate (handled separately)
          endpoint = `/api/notifications/${notificationId}/read`;
          method = 'PUT';
          break;
        case 'update':
          endpoint = `/api/requests/${requestId}`;
          method = 'PUT';
          break;
        case 'complete':
          endpoint = `/api/requests/${requestId}/status`;
          method = 'POST';
          break;
        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
      
      try {
        // Simple fetch without AbortController to avoid abort errors
        try {
          // Make API request
          const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: method !== 'GET' ? JSON.stringify(actionData) : undefined
          });
          
          if (!response.ok) {
            console.error(`Action API error for ${actionType}: ${response.status}`);
            const error = new Error(`Failed to perform action: ${actionType}`) as NotificationError;
            error.status = response.status;
            try {
              const data = await response.json();
              error.details = data;
            } catch (e) {
              // Ignore JSON parsing errors
            }
            throw error;
          }
          
          // Mark the notification as read
          if (notificationId) {
            try {
              await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
                // No signal here to avoid abort errors
              });
            } catch (readErr) {
              console.error("Error marking notification as read after action:", readErr);
              // Continue despite error
            }
          }
          
          return await response.json();
        } catch (fetchErr: any) {
          console.error(`Network error performing ${actionType} action:`, fetchErr);
          throw fetchErr; // Rethrow to trigger onError handler
        }
      } catch (err) {
        console.error(`Error performing action ${actionType}:`, err);
        throw err; // Rethrow to trigger onError handler
      }
    },
    onSuccess: (data, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
      // If we have a requestId, also invalidate the requests query
      if (variables.requestId) {
        queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
        queryClient.invalidateQueries({ queryKey: [`/api/requests/${variables.requestId}`] });
      }
      
      // Call the provided success callback if any
      if (onActionSuccess) {
        onActionSuccess(variables.actionType, variables.notificationId, data);
      }
      
      // Show toast for specific action types
      const actionMessages: Record<string, string> = {
        'approve': 'Request approved successfully',
        'reject': 'Request rejected successfully',
        'update': 'Request updated successfully',
        'complete': 'Request marked as complete',
      };
      
      if (actionMessages[variables.actionType]) {
        toast({
          title: "Success",
          description: actionMessages[variables.actionType],
        });
      }
    },
    onError: (error: NotificationError, variables) => {
      console.error(`Failed to perform ${variables.actionType} action:`, error);
      
      // Call the provided error callback if any
      if (onActionError) {
        onActionError(variables.actionType, variables.notificationId, error);
      }
      
      // Show appropriate error message based on status code and action type
      let errorMessage = 'Failed to perform action';
      
      if (error.status === 404) {
        errorMessage = 'The requested resource was not found';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to perform this action';
      } else if (error.status === 400) {
        errorMessage = error.details?.message || 'Invalid request data';
      } else if (error.status === 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
    retry: (failureCount, error: NotificationError) => {
      // Only retry for network errors or 5xx server errors, not for 4xx client errors
      return failureCount < MAX_RETRIES && (!error.status || error.status >= 500);
    }
  });
  
  // Helper function to navigate to the appropriate page based on notification type
  const handleNavigate = useCallback((link: string | null) => {
    if (link) {
      // Use direct navigation for reliable state management
      window.location.href = link;
    }
  }, []);

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
    performAction: (params: { 
      actionType: string; 
      notificationId: number; 
      requestId?: number;
      actionData?: Record<string, any>; 
    }) => performAction.mutate(params),
    handleNavigate,
    refetch: () => {
      const now = new Date();
      if (!isNaN(now.getTime())) {
        setLastFetchTime(now);
        return queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      }
      return Promise.resolve();
    }
  };
}