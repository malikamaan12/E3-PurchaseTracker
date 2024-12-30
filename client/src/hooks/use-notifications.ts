import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { NOTIFICATION_CONFIG, API_ROUTES, ERROR_MESSAGES } from "../../../server/utils/config";

interface NotificationError extends Error {
  status?: number;
  details?: any;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading, error } = useQuery<Notification[], NotificationError>({
    queryKey: [API_ROUTES.NOTIFICATIONS],
    retry: NOTIFICATION_CONFIG.MAX_RETRIES,
    retryDelay: (attemptIndex) => Math.min(
      NOTIFICATION_CONFIG.MIN_RETRY_DELAY * Math.pow(2, attemptIndex),
      NOTIFICATION_CONFIG.MAX_RETRY_DELAY
    ),
    refetchInterval: NOTIFICATION_CONFIG.POLLING_INTERVAL,
    refetchOnWindowFocus: NOTIFICATION_CONFIG.REFRESH_ON_FOCUS,
    staleTime: NOTIFICATION_CONFIG.STALE_TIME,
    cacheTime: NOTIFICATION_CONFIG.CACHE_TIME,
    onError: (error) => {
      console.error("Failed to fetch notifications:", error);
      toast({
        title: "Error Loading Notifications",
        description: error.status === 401 
          ? ERROR_MESSAGES.UNAUTHORIZED 
          : ERROR_MESSAGES.FETCH_FAILED,
        variant: "destructive",
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
    onSuccess: () => {
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
    }
  });

  // Calculate unread count and sort notifications
  const sortedNotifications = [...(notifications || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const unreadCount = sortedNotifications.filter((n) => !n.isRead).length;

  return {
    notifications: sortedNotifications,
    unreadCount,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    refetch: () => queryClient.invalidateQueries({ queryKey: [API_ROUTES.NOTIFICATIONS] })
  };
}