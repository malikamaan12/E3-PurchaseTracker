// Application Configuration
export const NOTIFICATION_CONFIG = {
  MAX_RETRIES: 3,
  MIN_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 10000,
  CACHE_DURATION: 300000, // 5 minutes
  POLLING_INTERVAL: 30000, // 30 seconds
  FAST_POLLING_INTERVAL: 5000, // 5 seconds for active sessions
};

export const API_ROUTES = {
  NOTIFICATIONS: '/api/notifications',
  MARK_READ: (id: number) => `/api/notifications/${id}/read`,
  ACKNOWLEDGE: (id: number) => `/api/notifications/${id}/acknowledge`,
  MARK_ALL_READ: '/api/notifications/mark-all-read',
  FAST_NOTIFICATIONS: '/api/notifications/fast',
};

export const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to fetch notifications',
  UPDATE_FAILED: 'Failed to update notification',
  NOT_FOUND: 'Notification not found',
  UNAUTHORIZED: 'Unauthorized access',
  CONNECTION_ERROR: 'Connection error occurred',
  TIMEOUT_ERROR: 'Request timed out',
  VALIDATION_ERROR: 'Invalid data provided',
};

export const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  MAX_CONCURRENT_REQUESTS: 3,
  REQUEST_TIMEOUT: 30000,
};

export const CACHE_KEYS = {
  NOTIFICATIONS: 'notifications_cache',
  USER_PREFERENCES: 'user_preferences_cache',
  EXPORT_SETTINGS: 'export_settings_cache',
};