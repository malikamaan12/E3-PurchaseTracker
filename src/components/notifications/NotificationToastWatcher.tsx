"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { 
  resolveNotificationLink, 
  formatNotificationTitle, 
  formatNotificationMessage 
} from "@/lib/utils/notification-formatter";

/**
 * NotificationToastWatcher
 * 
 * Background listener that queries unread notifications periodically and triggers
 * rich, actionable Sonner toast notifications in real-time when:
 * 1. A purchase request is approved, rejected, or has changes requested (for the requester)
 * 2. An approval task is assigned or pending review (for approvers/admins)
 * 
 * Automatically synchronizes with the TopNav bell badge and query cache.
 */
export function NotificationToastWatcher() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const knownIdsRef = useRef<Set<number>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  // Poll unread notifications every 10 seconds when user is authenticated
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications-live-feed"],
    queryFn: () => apiClient.notifications.list({ includeRead: false }),
    enabled: !!user,
    refetchInterval: 10000, // 10 seconds
    refetchIntervalInBackground: false,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!user) {
      knownIdsRef.current.clear();
      isInitialLoadRef.current = true;
      return;
    }

    if (!Array.isArray(notifications)) return;

    if (isInitialLoadRef.current) {
      // First load: Record all existing unread notification IDs so we don't spam toasts
      notifications.forEach((n: any) => {
        if (n?.id) knownIdsRef.current.add(n.id);
      });
      isInitialLoadRef.current = false;
      return;
    }

    // Identify newly arrived unread notifications
    const newNotifications = notifications.filter((n: any) => n?.id && !knownIdsRef.current.has(n.id));

    if (newNotifications.length > 0) {
      newNotifications.forEach((notif: any) => {
        knownIdsRef.current.add(notif.id);

        const targetUrl = resolveNotificationLink(notif);

        const actionHandler = targetUrl
          ? {
              label: notif.type === "purchase_request_changes_requested" ? "Revise" : 
                     notif.type === "approval_required" ? "Review" : "View",
              onClick: () => {
                // Mark notification as read when clicking action
                apiClient.notifications.markAsRead(notif.id).catch(() => {});
                queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
                router.push(targetUrl);
              },
            }
          : undefined;

        // Clean and format message content
        const cleanTitle = formatNotificationTitle(notif);
        const cleanMessage = formatNotificationMessage(notif);

        switch (notif.type) {
          case "purchase_request_approved":
            toast.success(cleanTitle, {
              description: cleanMessage,
              action: actionHandler,
              duration: 4000,
            });
            break;

          case "purchase_request_rejected":
            toast.error(cleanTitle, {
              description: cleanMessage,
              action: actionHandler,
              duration: 5000,
            });
            break;

          case "purchase_request_changes_requested":
            toast.warning(cleanTitle, {
              description: cleanMessage,
              action: actionHandler,
              duration: 5000,
            });
            break;

          case "approval_required":
          case "purchase_request_submitted":
            toast.info(cleanTitle, {
              description: cleanMessage,
              action: actionHandler,
              duration: 4000,
            });
            break;

          default:
            toast(cleanTitle, {
              description: cleanMessage,
              action: actionHandler,
              duration: 4000,
            });
            break;
        }
      });

      // Synchronize the unread count badge in TopNav
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  }, [notifications, user, router, queryClient]);

  return null;
}
