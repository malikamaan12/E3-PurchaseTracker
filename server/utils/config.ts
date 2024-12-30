// Configuration constants for the application
export const NOTIFICATION_CONFIG = {
  // Polling and refresh intervals (in milliseconds)
  POLLING_INTERVAL: 30000, // 30 seconds
  REFRESH_ON_FOCUS: true,
  
  // Pagination and limits
  MAX_NOTIFICATIONS_PER_PAGE: 50,
  
  // Retry configuration
  MAX_RETRIES: 3,
  MIN_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
  
  // Cache configuration
  CACHE_TIME: 60000, // 1 minute
  STALE_TIME: 30000, // 30 seconds
} as const;

// Routes configuration
export const API_ROUTES = {
  NOTIFICATIONS: '/api/notifications',
  MARK_READ: (id: number) => `/api/notifications/${id}/read`,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to fetch notifications',
  UNAUTHORIZED: 'Please log in to view notifications',
  UPDATE_FAILED: 'Failed to update notification',
  NOT_FOUND: 'Notification not found or already processed',
  GENERAL_ERROR: 'Something went wrong. Please try again.',
} as const;
