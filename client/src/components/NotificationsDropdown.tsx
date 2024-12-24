import { useState } from "react";
import { useLocation } from "wouter";
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

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();

  const handleNotificationClick = async (notificationId: number, link?: string) => {
    if (!notifications.find(n => n.id === notificationId)?.isRead) {
      await markAsRead(notificationId);
    }

    if (link) {
      setOpen(false);
      setLocation(link);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative interactive-bounce"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-fade-in">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h4 className="font-medium">Notifications</h4>
          {unreadCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id, notification.link)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group ${
                    !notification.isRead ? "bg-muted/20" : ""
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm mb-1 flex-1">{notification.message}</p>
                    {notification.link && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                  {!notification.isRead && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}