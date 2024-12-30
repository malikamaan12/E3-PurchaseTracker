import { useToast } from "@/hooks/use-toast";

interface ErrorLogData {
  message: string;
  code?: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  path?: string;
  details?: Record<string, unknown>;
}

export async function logError(error: Error | unknown, context?: Record<string, unknown>) {
  try {
    const errorData: ErrorLogData = {
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
      path: window.location.pathname,
      details: {
        ...context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
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

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

export function getReadableValidationError(error: unknown): string {
  if (error instanceof Error) {
    // Check for validation error patterns
    const message = error.message;
    if (message.includes('required')) {
      return message.replace(/\[\w+\]/, '').trim();
    }
    if (message.includes('must be')) {
      return message;
    }
  }
  return getErrorMessage(error);
}

// Hook for centralized error handling with toast notifications
export function useErrorHandler() {
  const { toast } = useToast();

  return async (error: unknown, context?: { title?: string; silent?: boolean }) => {
    const errorData = await logError(error);
    
    if (!context?.silent) {
      toast({
        title: context?.title || 'Error',
        description: getReadableValidationError(error),
        variant: 'destructive',
      });
    }

    return errorData;
  };
}
