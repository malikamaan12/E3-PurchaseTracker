import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useEnhancedNotifications } from '@/hooks/use-enhanced-notifications';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Clock,
  XCircle,
  CheckSquare,
  Filter,
  SlidersHorizontal,
  Trash2,
  ArrowLeft,
  Eye,
  Check,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  
  const { 
    notifications, 
    markAsRead,
    acknowledgeNotification,
    markAllAsRead,
    refetch,
    isLoading 
  } = useEnhancedNotifications({
    autoPolling: true,
    pollInterval: 30000,
    includeRead: true
  });

  const filteredNotifications = notifications.filter(notification => {
    // Filter by read status
    if (activeTab === 'unread' && notification.isRead) return false;
    if (activeTab === 'read' && !notification.isRead) return false;
    if (activeTab === 'actionable' && (!notification.actionType || notification.isRead)) return false;
    if (activeTab === 'high-priority' && notification.priority !== 'high') return false;
    
    // Filter by priority
    if (selectedPriority !== 'all' && notification.priority !== selectedPriority) return false;
    
    // Filter by type
    if (selectedType !== 'all' && !notification.type.includes(selectedType)) return false;
    
    return true;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = parseISO(notification.createdAt);
    let groupKey = '';
    
    if (isToday(date)) {
      groupKey = 'Today';
    } else if (isYesterday(date)) {
      groupKey = 'Yesterday';
    } else if (isThisWeek(date)) {
      groupKey = 'This Week';
    } else {
      groupKey = 'Earlier';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push(notification);
    return groups;
  }, {} as Record<string, typeof notifications>);

  // Calculate counts
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const highPriorityCount = notifications.filter(n => n.priority === 'high').length;
  const actionableCount = notifications.filter(n => n.actionType && !n.isRead).length;

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = parseISO(dateString);
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

    return format(date, 'MMM d, yyyy');
  };

  // Get notification icon based on type and priority
  const getNotificationIcon = (type: string, priority: string) => {
    const iconProps = { className: 'h-5 w-5', strokeWidth: 2 };
    
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
    
    // Navigation
    if (notification.link) {
      setLocation(notification.link);
    } else if (notification.requestId) {
      setLocation(`/requests/${notification.requestId}`);
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = () => {
    markAllAsRead();
    toast({
      title: "Success",
      description: "All notifications marked as read",
    });
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/dashboard')}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {unreadCount} unread
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <div className="flex flex-col w-full">
                    <span className="text-sm font-medium mb-1.5">Priority</span>
                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="All Priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <div className="flex flex-col w-full">
                    <span className="text-sm font-medium mb-1.5">Type</span>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="request">Requests</SelectItem>
                        <SelectItem value="approval">Approvals</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Mark all as read</span>
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all" className="flex items-center gap-1.5">
            <Bell className="h-4 w-4" />
            <span>All</span>
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            <span>Unread</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="high-priority" className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            <span>High Priority</span>
            {highPriorityCount > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">
                {highPriorityCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="actionable" className="flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4" />
            <span>Actionable</span>
            {actionableCount > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">
                {actionableCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read" className="flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            <span>Read</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <svg
                className="h-8 w-8 animate-spin text-primary"
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
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
                <h3 className="text-lg font-medium">No notifications found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {activeTab === 'unread' 
                    ? "You're all caught up! No unread notifications."
                    : activeTab === 'high-priority'
                    ? "No high priority notifications at the moment."
                    : activeTab === 'actionable'
                    ? "No actionable notifications requiring your attention."
                    : "There are no notifications matching your filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedNotifications).map(([date, notificationGroup]) => (
              <div key={date} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground pl-2 mb-2">{date}</h3>
                <div className="space-y-3">
                  {notificationGroup.map((notification) => (
                    <Card 
                      key={notification.id} 
                      className={cn(
                        "transition-all duration-200 hover:shadow-md",
                        !notification.isRead && "border-l-4 border-l-primary bg-primary/5"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0 p-2 rounded-full bg-muted">
                            {getNotificationIcon(notification.type, notification.priority)}
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-start justify-between">
                              <h4 className={cn(
                                "text-base",
                                !notification.isRead && "font-medium"
                              )}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                {notification.priority === 'high' && (
                                  <Badge variant="destructive" className="rounded-sm text-xs py-0 px-1.5">
                                    High
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(notification.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-2">
                                {notification.actionType && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => handleNotificationClick(notification)}
                                  >
                                    {notification.actionType === 'approve' && 'Review & Approve'}
                                    {notification.actionType === 'reject' && 'Review & Reject'}
                                    {notification.actionType === 'review' && 'Review'}
                                    {notification.actionType === 'acknowledge' && 'Acknowledge'}
                                    {notification.actionType === 'update' && 'Update'}
                                    {notification.actionType === 'view' && 'View'}
                                    {notification.actionType === 'complete' && 'Complete'}
                                  </Button>
                                )}
                                {!notification.actionType && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => handleNotificationClick(notification)}
                                  >
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    View Details
                                  </Button>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {!notification.isRead && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => markAsRead(notification.id)}
                                  >
                                    <Check className="mr-1.5 h-3 w-3" />
                                    Mark as read
                                  </Button>
                                )}
                                {notification.actionType && !notification.isAcknowledged && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => acknowledgeNotification(notification.id)}
                                  >
                                    <X className="mr-1.5 h-3 w-3" />
                                    Dismiss
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}