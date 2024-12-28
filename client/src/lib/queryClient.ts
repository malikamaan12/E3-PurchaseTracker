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

          // Always try to parse JSON first
          try {
            const data = await res.json();

            // If response is not ok, throw the error data
            if (!res.ok) {
              if (res.status === 404) {
                throw new Error(`API endpoint not found: ${queryKey[0]}`);
              }

              // Visualize the error using our error utility
              visualizeError({
                message: data.message || `${res.status}: ${res.statusText}`,
                severity: res.status >= 500 ? 'critical' : 'error',
                code: data.code,
                details: data.details
              });

              throw new Error(data.message || `${res.status}: ${res.statusText}`);
            }

            return data;
          } catch (parseError) {
            // If JSON parsing fails, handle text response
            const text = await res.text();

            // If the response looks like HTML, it's probably an error page
            if (text.toLowerCase().includes('<!doctype html>')) {
              throw new Error(`Server Error (${res.status}): The server encountered an error`);
            }

            // If not ok and not HTML, throw the text as error
            if (!res.ok) {
              throw new Error(text || `${res.status}: ${res.statusText}`);
            }

            // If ok but not JSON, throw format error
            throw new Error(`Invalid response format: Expected JSON but got ${res.headers.get('content-type')}`);
          }
        } catch (error) {
          // Log error for debugging
          console.error('Query error:', {
            queryKey,
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack
            } : error
          });

          if (error instanceof Error) {
            throw error;
          }
          throw new Error('An unexpected error occurred');
        }
      },
      staleTime: 30 * 1000, // Data considered fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchOnWindowFocus: true, // Refetch when window regains focus
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Only retry on network errors or 5xx errors, not on 404s or validation errors
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