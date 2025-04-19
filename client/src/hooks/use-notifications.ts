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
  requestId?: number;
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

  // Enhanced real-time notification query with proper error handling and optimization
  const { data: notifications = [], isLoading, error } = useQuery<Notification[], NotificationError>({
    queryKey: [API_ROUTES.NOTIFICATIONS],
    retry: NOTIFICATION_CONFIG.MAX_RETRIES,
    retryDelay: (attemptIndex) => Math.min(
      NOTIFICATION_CONFIG.MIN_RETRY_DELAY * Math.pow(2, attemptIndex),
      NOTIFICATION_CONFIG.MAX_RETRY_DELAY
    ),
    // Performance optimization: Increase stale time and decrease refetch frequency
    refetchOnWindowFocus: false, // Only refetch on manual trigger or interval
    staleTime: 60000, // Consider data stale after 60 seconds instead of 5
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnReconnect: true,
    select: (data: Notification[]) => {
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
      queryClient.setQueryData<Notification[]>([API_ROUTES.NOTIFICATIONS], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map((notification: Notification) => 
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
  const unreadCount = notificationArray.filter((n: Notification) => !n.isRead).length;
  const highPriorityCount = notificationArray.filter((n: Notification) => !n.isRead && n.priority === 'high').length;

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