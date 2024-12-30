// Configuration constants for notifications
export const NOTIFICATION_CONFIG = {
  // Polling and refresh intervals (in milliseconds)
  POLLING_INTERVAL: 30000, // 30 seconds
  REFRESH_ON_FOCUS: true,
  
  // Cache configuration
  CACHE_TIME: 60000, // 1 minute
  STALE_TIME: 30000, // 30 seconds
  
  // Retry configuration
  MAX_RETRIES: 3,
  MIN_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
} as const;

// Error messages for the client
export const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to fetch notifications',
  UNAUTHORIZED: 'Please log in to view notifications',
  UPDATE_FAILED: 'Failed to update notification',
  NOT_FOUND: 'Notification not found or already processed',
  GENERAL_ERROR: 'Something went wrong. Please try again.',
} as const;
