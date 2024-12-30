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
    gcTime: NOTIFICATION_CONFIG.CACHE_TIME, // Updated from cacheTime to gcTime
    refetchOnReconnect: true, // Add automatic refetch on reconnection
    onError: (error) => {
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
      // Transform and sort notifications before returning
      return [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
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

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    refetch: () => queryClient.invalidateQueries({ queryKey: [API_ROUTES.NOTIFICATIONS] })
  };
}