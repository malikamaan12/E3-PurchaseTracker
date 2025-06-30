import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// Constants
const POLLING_INTERVAL = 30000; // 30 seconds
const API_BASE_URL = '/api/notifications';

export interface Notification {
  id: number;
  userId: number;
  requestId?: number;
  title: string;
  message: string;
  type: string;
  priority: 'high' | 'normal' | 'low';
  isRead: boolean;
  isAcknowledged: boolean;
  link: string | null;
  actionType?: string;
  actionData?: Record<string, any>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationError extends Error {
  status?: number;
  details?: any;
}

const MAX_RETRIES = 3;

/**
 * Enhanced hook for interacting with notifications
 * TEMPORARILY DISABLED to resolve runtime errors
 */
export function useEnhancedNotifications(options?: {
  autoPolling?: boolean;
  pollInterval?: number;
  includeRead?: boolean;
  filterType?: string;
  filterPriority?: 'high' | 'normal' | 'low';
  userRole?: string;
  userDepartment?: string;
  onActionSuccess?: (actionType: string, notificationId: number, result: any) => void;
  onActionError?: (actionType: string, notificationId: number, error: NotificationError) => void;
}) {
  // TEMPORARILY DISABLED - Return stable empty state to prevent runtime errors
  return {
    notifications: [] as Notification[],
    unreadCount: 0,
    highPriorityCount: 0,
    unacknowledgedCount: 0,
    expiredCount: 0,
    actionableCount: 0,
    isLoading: false,
    error: null,
    markAsRead: (id: number) => Promise.resolve({ success: true }),
    acknowledgeNotification: (id: number) => Promise.resolve({ success: true }),
    markAllAsRead: () => Promise.resolve({ success: true }),
    performAction: (params: { 
      actionType: string; 
      notificationId: number; 
      requestId?: number;
      actionData?: Record<string, any>; 
    }) => Promise.resolve({ success: true }),
    handleNavigate: () => {},
    refetch: () => Promise.resolve()
  };
}

export default useEnhancedNotifications;