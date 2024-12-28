import { QueryClient } from "@tanstack/react-query";
import { visualizeError } from "./errorUtils";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        try {
          const res = await fetch(queryKey[0] as string, {
            credentials: "include",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          });

          // Clone response before reading
          const resClone = res.clone();

          // Always try to parse JSON first
          try {
            const data = await resClone.json();

            // If response is not ok, throw the error data
            if (!res.ok) {
              if (res.status === 404) {
                throw new Error(`API endpoint not found: ${queryKey[0]}`);
              }

              // Enhanced error visualization with context
              visualizeError({
                message: data.message || `${res.status}: ${res.statusText}`,
                severity: res.status >= 500 ? 'critical' : 'error',
                code: data.code || 'UNKNOWN_ERROR',
                details: data.details || `Failed to fetch data from ${queryKey[0]}`
              });

              throw new Error(data.message || `${res.status}: ${res.statusText}`);
            }

            // Cache configuration based on route
            const route = queryKey[0].toString();
            const cacheTime = route.includes('/admin') ? 
              30 * 1000 : // 30 seconds for admin routes
              5 * 60 * 1000; // 5 minutes for other routes

            queryClient.setQueryDefaults([route], {
              staleTime: cacheTime,
              gcTime: cacheTime * 2,
            });

            return data;
          } catch (parseError) {
            console.error('Response parsing error:', parseError);

            // Try to read the original response if clone parsing failed
            const text = await res.text();
            console.error('Original response text:', text);

            if (!res.ok) {
              throw new Error(text || `${res.status}: ${res.statusText}`);
            }

            if (text.toLowerCase().includes('<!doctype html>')) {
              throw new Error(`Server Error (${res.status}): The server encountered an error`);
            }

            throw new Error(`Invalid response format: Expected JSON but got ${res.headers.get('content-type')}`);
          }
        } catch (error) {
          // Enhanced error logging
          console.error('Query error:', {
            queryKey,
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : error,
            timestamp: new Date().toISOString()
          });

          if (error instanceof Error) {
            throw error;
          }
          throw new Error('An unexpected error occurred');
        }
      },
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error instanceof Error) {
          const shouldRetry = 
            error.message.includes('Failed to fetch') || 
            error.message.includes('Server Error') ||
            error.message.includes('NetworkError');

          return shouldRetry && failureCount < 3;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error);
        visualizeError({
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          severity: 'error',
          details: error instanceof Error ? error.stack : undefined
        });
      }
    }
  },
});

// Add global cache invalidation utilities
export const invalidateQueries = async (queryKey: string | string[]) => {
  await queryClient.invalidateQueries({ 
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    refetchType: 'active'
  });
};

export const prefetchQuery = async (queryKey: string | string[]) => {
  await queryClient.prefetchQuery({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    staleTime: 30 * 1000,
  });
};

// Helper to handle API errors consistently
export const handleQueryError = (error: unknown) => {
  if (error instanceof Error) {
    visualizeError({
      message: error.message,
      severity: error.message.includes('Server Error') ? 'critical' : 'error',
      details: error.stack
    });
  } else {
    visualizeError({
      message: 'An unexpected error occurred',
      severity: 'error',
      details: String(error)
    });
  }
};