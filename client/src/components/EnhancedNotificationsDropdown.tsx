import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Bell, 
  Check, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  X,
  CheckSquare,
  XCircle
} from 'lucide-react';
import { useEnhancedNotifications } from '@/hooks/use-enhanced-notifications';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnhancedNotificationsDropdownProps {
  onNotificationClick?: (notification: { id: number; link: string | null; requestId?: number }) => void;
}

export function EnhancedNotificationsDropdown({ 
  onNotificationClick 
}: EnhancedNotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { 
    notifications, 
    unreadCount, 
    highPriorityCount, 
    actionableCount,
    isLoading, 
    markAsRead,
    acknowledgeNotification,
    markAllAsRead,
    refetch 
  } = useEnhancedNotifications({
    autoPolling: true,
    pollInterval: 30000,
    includeRead: true
  });

  // Format notification date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Get icon based on notification type and priority
  const getNotificationIcon = (type: string, priority: string) => {
    const iconProps = { className: 'h-4 w-4', strokeWidth: 2 };
    
    if (priority === 'high') {
      if (type.includes('approved')) return <CheckCircle {...iconProps} className="text-green-500" />;
      if (type.includes('rejected')) return <XCircle {...iconProps} className="text-red-500" />;
      if (type.includes('changes')) return <AlertCircle {...iconProps} className="text-yellow-500" />;
      return <AlertCircle {...iconProps} className="text-red-500" />;
    }
    
    if (type.includes('request')) return <Info {...iconProps} className="text-blue-500" />;
    if (type.includes('approval')) return <CheckSquare {...iconProps} className="text-green-500" />;
    if (type.includes('system')) return <Info {...iconProps} className="text-gray-500" />;
    
    return <Info {...iconProps} className="text-gray-500" />;
  };

  // Handle notification click
  const handleNotificationClick = (notification: { id: number; link: string | null; requestId?: number }) => {
    // Mark as read first
    markAsRead(notification.id);
    
    // Close dropdown
    setOpen(false);
    
    // Use custom handler if provided
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else if (notification.requestId) {
      // If notification has requestId, prioritize navigating to the request
      // This fixes issues where notifications might have a generic "/" link
      setLocation(`/requests/${notification.requestId}`);
    } else if (notification.link && notification.link !== '/') {
      // Only use link if it's not the root path
      setLocation(notification.link);
    } else {
      // Fallback to dashboard if no valid target is available
      setLocation('/dashboard');
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  // Initial fetch when dropdown opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative"
                onClick={() => setOpen(true)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute -top-1 -right-1"
                    >
                      <Badge 
                        variant={highPriorityCount > 0 ? "destructive" : "default"} 
                        className="flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                      >
                        {unreadCount}
                      </Badge>
                    </motion.div>
                  </AnimatePresence>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="flex justify-center py-4">
            <svg
              className="h-6 w-6 animate-spin text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Bell className="mb-2 h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You're all caught up!
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <DropdownMenuGroup>
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleNotificationClick(notification);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-start p-3 text-left",
                    !notification.isRead && "bg-muted/50"
                  )}
                >
                  <div className="flex w-full items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className={cn(
                          "text-sm font-medium",
                          !notification.isRead && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-1">
                          {notification.actionType && (
                            <Badge 
                              variant="outline" 
                              className="ml-auto h-5 px-1.5 text-xs"
                            >
                              {notification.actionType}
                            </Badge>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      
                      {notification.actionType && (
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                          >
                            {notification.actionType === 'approve' && 'Review & Approve'}
                            {notification.actionType === 'reject' && 'Review & Reject'}
                            {notification.actionType === 'review' && 'Review'}
                            {notification.actionType === 'acknowledge' && 'Acknowledge'}
                            {notification.actionType === 'update' && 'Update'}
                            {notification.actionType === 'view' && 'View'}
                            {notification.actionType === 'complete' && 'Complete'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                              toast({
                                title: "Notification marked as read",
                                description: "You can find it in your notification history.",
                              });
                            }}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </ScrollArea>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            setLocation('/notifications');
          }}
          className="justify-center text-center text-sm font-medium"
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}