import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

interface NotificationError extends Error {
  status?: number;
  details?: any;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading, error } = useQuery<Notification[], NotificationError>({
    queryKey: ["/api/notifications"],
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchOnWindowFocus: true, // Also refetch when window regains focus
    onError: (error) => {
      console.error("Failed to fetch notifications:", error);
      toast({
        title: "Error Loading Notifications",
        description: error.status === 401 
          ? "Please log in to view notifications" 
          : "Unable to load notifications. Please try again.",
        variant: "destructive",
      });
    }
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.message || "Failed to mark notification as read") as NotificationError;
        error.status = res.status;
        error.details = errorData;
        throw error;
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notifications immediately
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: NotificationError) => {
      console.error("Failed to mark notification as read:", error);
      toast({
        title: "Error",
        description: error.status === 404 
          ? "Notification not found or already processed"
          : "Failed to update notification. Please try again.",
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
    refetch: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] })
  };
}