import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Import Notification interface from use-notifications.ts
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

interface NotificationsDropdownProps {
  onNotificationClick: (notification: { id: number; link: string | null }) => void;
}

export function NotificationsDropdown({ onNotificationClick }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, highPriorityCount, isLoading, markAsRead, refetch } = useNotifications();
  const pollTimerRef = useRef<number | null>(null);

  // Setup polling with proper error handling and cleanup
  useEffect(() => {
    const pollNotifications = async () => {
      try {
        await refetch();
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    // Initial fetch when dropdown opens
    if (open) {
      // Start polling only if we don't have an active timer
      if (!pollTimerRef.current) {
        // Initial fetch, but only if we're not already loading
        if (!isLoading) {
          pollNotifications();
        }
        pollTimerRef.current = window.setInterval(pollNotifications, 30000); // Poll every 30 seconds
      }
    } else {
      // Clear polling when dropdown closes
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    // Cleanup function
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [open, refetch]);
  
  // Removed duplicate cleanup effect that was causing potential memory issues

  const handleNotificationClick = useCallback(async (notification: { id: number; link: string | null }) => {
    try {
      // Check if the notification exists and is not read yet
      // Use proper typing with our interface
      const notificationsList = Array.isArray(notifications) ? notifications as Notification[] : [];
      const notificationToMark = notificationsList.find(n => n && n.id === notification.id);
      
      if (notificationToMark && !notificationToMark.isRead) {
        await markAsRead(notification.id);
      }

      setOpen(false);
      onNotificationClick(notification);
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  }, [notifications, markAsRead, onNotificationClick]);

  const getPriorityStyles = (priority: string = 'normal') => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'normal':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative interactive-bounce"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className={cn(
            "h-5 w-5",
            highPriorityCount > 0 && "text-red-500"
          )} />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 h-5 w-5 rounded-full text-white text-xs flex items-center justify-center animate-fade-in",
              highPriorityCount > 0 ? "bg-red-500" : "bg-blue-500"
            )}>
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h4 className="font-medium">Notifications</h4>
          {unreadCount > 0 && (
            <div className="flex gap-2 items-center">
              {highPriorityCount > 0 && (
                <span className="text-sm text-red-500 font-medium">
                  {highPriorityCount} high priority
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {unreadCount} unread
              </span>
            </div>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (!Array.isArray(notifications) || notifications.length === 0) ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {(notifications as Notification[]).map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group relative",
                    notification.isRead === false && "bg-muted/20"
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNotificationClick({
                        id: notification.id,
                        link: notification.link
                      });
                    }}
                    className="w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{notification.title}</p>
                          {notification.priority === 'high' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              High Priority
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      </div>
                      {notification.link && (
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </button>
                  {notification.isRead === false && (
                    <div className={cn(
                      "absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
                      getPriorityStyles(notification.priority)
                    )} />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}