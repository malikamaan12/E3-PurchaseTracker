import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

export function useNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchOnWindowFocus: true, // Also refetch when window regains focus
    onError: (error) => {
      console.error("Failed to fetch notifications:", error);
      toast({
        title: "Error",
        description: "Failed to load notifications. Please try again.",
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
        const error = await res.json();
        throw new Error(error.message || "Failed to mark notification as read");
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notifications immediately
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error) => {
      console.error("Failed to mark notification as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read. Please try again.",
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