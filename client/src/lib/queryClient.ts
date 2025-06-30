import { QueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Create a toast function that can be used outside of React components
let globalToast: any = null;
export const setGlobalToast = (toastFunction: any) => {
  globalToast = toastFunction;
};

// Helper to validate URLs
const isValidUrl = (url: string) => {
  try {
    return Boolean(url.startsWith('/api/') || new URL(url));
  } catch {
    return false;
  }
};

// Helper to determine if error is retryable
const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network Error') ||
      error.message.includes('ECONNREFUSED')
    );
  }
  return false;
};

// Add logging for debugging purposes
const logQueryError = (error: unknown, url: string) => {
  console.error('Query error:', {
    url,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : String(error),
    timestamp: new Date().toISOString()
  });
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0];
        if (typeof url !== 'string' || !isValidUrl(url)) {
          throw new Error(`Invalid URL in query key: ${String(url)}`);
        }

        try {
          console.log(`[Query] Fetching: ${url}`);
          const res = await fetch(url, {
            credentials: "include",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            console.log(`[Query] Error response:`, { status: res.status, errorData });

            // Handle 404 errors specifically for request routes
            if (res.status === 404) {
              if (url.includes('/api/requests/')) {
                throw new Error('Request not found');
              }
              if (url.includes('/api/notifications/')) {
                throw new Error('Notification not found');
              }
            }

            const errorMessage = errorData?.message || `${res.status}: ${res.statusText}`;
            // Only show toast for non-404 errors to reduce noise
            if (res.status !== 404 && globalToast) {
              globalToast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
              });
            }

            throw new Error(errorMessage);
          }

          const data = await res.json();
          console.log(`[Query] Success:`, { url, dataShape: Object.keys(data) });
          return data;
        } catch (error) {
          logQueryError(error, url);

          // Only show toast for network errors to reduce noise
          if (isRetryableError(error) && globalToast) {
            globalToast({
              title: "Connection Issue", 
              description: "Network connection problem. Please check your connection.",
              variant: "destructive",
            });
          }

          throw error;
        }
      },
      retry: (failureCount, error) => {
        // Only retry network/connection errors, up to 3 times
        return isRetryableError(error) && failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      staleTime: 30000, // Consider data stale after 30 seconds
      gcTime: 5 * 60 * 1000, // Cache for 5 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    },
    mutations: {
      onError: (error) => {
        logQueryError(error, 'mutation');
        if (globalToast) {
          globalToast({
            title: "Error",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
        }
      }
    }
  }
});

// Cache invalidation helper
export const invalidateQueries = async (queryKey: string | string[]) => {
  const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
  console.log('[Cache] Invalidating queries:', keys);
  await Promise.all(
    keys.map(key => queryClient.invalidateQueries({ queryKey: [key] }))
  );
};

export const prefetchQuery = async (queryKey: string | string[]) => {
  const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
  console.log('[Cache] Prefetching queries:', keys);
  await queryClient.prefetchQuery({
    queryKey: keys,
    staleTime: 30 * 1000,
  });
};

// Helper to handle API errors consistently
export const handleQueryError = (error: unknown) => {
  if (error instanceof Error) {
    console.error('[Error Handler]', error);
    if (globalToast) {
      globalToast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  } else {
    console.error('[Error Handler] Unknown error:', error);
    if (globalToast) {
      globalToast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  }
};