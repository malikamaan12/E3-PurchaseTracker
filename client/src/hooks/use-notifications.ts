import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { NOTIFICATION_CONFIG, API_ROUTES, ERROR_MESSAGES } from "../../../server/utils/config";

// Define our own notification type since importing from schema causes TS errors
interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  priority?: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationError extends Error {
  status?: number;
  details?: any;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Enhanced real-time notification query with proper error handling
  const { data: notifications = [], isLoading, error } = useQuery<Notification[], NotificationError>({
    queryKey: [API_ROUTES.NOTIFICATIONS],
    retry: NOTIFICATION_CONFIG.MAX_RETRIES,
    retryDelay: (attemptIndex) => Math.min(
      NOTIFICATION_CONFIG.MIN_RETRY_DELAY * Math.pow(2, attemptIndex),
      NOTIFICATION_CONFIG.MAX_RETRY_DELAY
    ),
    // Removed redundant refetchInterval to prevent duplicate polling that was causing
    // Maximum update depth exceeded errors. This is now handled manually in the NotificationsDropdown
    refetchOnWindowFocus: true,
    staleTime: 5000, // Consider data stale after 5 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnReconnect: true,
    onError: (error: any) => {
      console.error("Failed to fetch notifications:", error);
      toast({
        title: "Error Loading Notifications",
        description: error.status === 401 
          ? ERROR_MESSAGES.UNAUTHORIZED 
          : ERROR_MESSAGES.FETCH_FAILED,
        variant: "destructive",
      });
    },
    select: (data) => {
      // Transform and sort notifications, prioritizing unread and high priority
      return [...data].sort((a, b) => {
        // First sort by read status
        if (!a.isRead && b.isRead) return -1;
        if (a.isRead && !b.isRead) return 1;

        // Then by priority
        const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
        const aPriority = (a.priority || 'normal') as string;
        const bPriority = (b.priority || 'normal') as string;
        const priorityDiff = (priorityOrder[aPriority] || 1) - (priorityOrder[bPriority] || 1);
        if (priorityDiff !== 0) return priorityDiff;

        // Finally by date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await fetch(API_ROUTES.MARK_READ(notificationId), {
        method: "PUT",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.message || ERROR_MESSAGES.UPDATE_FAILED) as NotificationError;
        error.status = res.status;
        error.details = errorData;
        throw error;
      }

      return res.json();
    },
    onSuccess: (_, notificationId) => {
      // Optimistic update
      queryClient.setQueryData<Notification[]>([API_ROUTES.NOTIFICATIONS], (oldData) => {
        if (!oldData) return [];
        return oldData.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        );
      });

      // Then refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.NOTIFICATIONS] });
    },
    onError: (error: NotificationError) => {
      console.error("Failed to mark notification as read:", error);
      toast({
        title: "Error",
        description: error.status === 404 
          ? ERROR_MESSAGES.NOT_FOUND
          : ERROR_MESSAGES.UPDATE_FAILED,
        variant: "destructive",
      });
    },
    retry: NOTIFICATION_CONFIG.MAX_RETRIES
  });

  // Safely calculate unread and high priority counts to avoid type errors
  const notificationArray = Array.isArray(notifications) ? notifications : [];
  const unreadCount = notificationArray.filter((n: any) => !n.isRead).length;
  const highPriorityCount = notificationArray.filter((n: any) => !n.isRead && n.priority === 'high').length;

  return {
    notifications,
    unreadCount,
    highPriorityCount,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    refetch: () => queryClient.invalidateQueries({ queryKey: [API_ROUTES.NOTIFICATIONS] })
  };
}