import { useToast } from "@/components/ui/use-toast";

interface ErrorLogData {
  message: string;
  code?: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  path?: string;
  details?: Record<string, unknown>;
}

// Keep track of recent error messages to prevent duplicates
const recentErrors = new Map<string, number>();
const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds

export async function logError(error: Error | unknown, context?: Record<string, unknown>) {
  try {
    const errorData: ErrorLogData = {
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
      path: window.location.pathname,
      details: context
    };

    // Send error to server for logging
    const response = await fetch('/api/error-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('Failed to log error:', await response.text());
    }

    return errorData;
  } catch (loggingError) {
    console.error('Error while logging error:', loggingError);
  }
}

export function getFormattedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle validation errors
    if (error.message.includes('Validation failed')) {
      try {
        const errorData = JSON.parse(error.message);
        if (Array.isArray(errorData.errors)) {
          return errorData.errors.join('\n');
        }
      } catch (_) {
        // If parsing fails, return original message
      }
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// Hook for centralized error handling with toast notifications
export function useErrorHandler() {
  const { toast } = useToast();

  return async (error: unknown, context?: { title?: string; silent?: boolean }) => {
    const errorData = await logError(error);

    if (!context?.silent) {
      const errorMessage = getFormattedErrorMessage(error);
      const errorKey = `${context?.title || 'Error'}-${errorMessage}`;
      const now = Date.now();

      // Check if we've shown this error recently
      const lastShown = recentErrors.get(errorKey);
      if (!lastShown || (now - lastShown) > ERROR_DEBOUNCE_TIME) {
        toast({
          title: context?.title || 'Error',
          description: errorMessage,
          variant: 'destructive',
          duration: 7000, // Show errors for longer
        });

        // Update the last shown time
        recentErrors.set(errorKey, now);

        // Clean up old errors after debounce time
        setTimeout(() => {
          recentErrors.delete(errorKey);
        }, ERROR_DEBOUNCE_TIME);
      }
    }

    return errorData;
  };
}