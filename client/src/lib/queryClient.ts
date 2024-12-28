import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        try {
          const res = await fetch(queryKey[0] as string, {
            credentials: "include",
          });

          if (!res.ok) {
            // First try to get JSON error
            const contentType = res.headers.get("content-type");
            if (contentType?.includes("application/json")) {
              const errorData = await res.json();
              throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
            }

            // Fallback to text error
            const errorText = await res.text();
            // Check if the response is HTML (likely an error page)
            if (errorText.toLowerCase().includes('<!doctype html>')) {
              throw new Error(`Server Error (${res.status}): The server encountered an error`);
            }
            throw new Error(errorText || `${res.status}: ${res.statusText}`);
          }

          // Verify JSON content type
          const contentType = res.headers.get("content-type");
          if (!contentType?.includes("application/json")) {
            throw new Error(`Invalid response format: Expected JSON but got ${contentType}`);
          }

          return res.json();
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('An unexpected error occurred');
        }
      },
      staleTime: 30 * 1000, // Data considered fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        // Only retry on network errors or 5xx errors
        if (error instanceof Error && (
          error.message.includes('Failed to fetch') || 
          error.message.includes('Server Error')
        )) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    }
  },
});

// Add global cache invalidation utilities
export const invalidateQueries = async (queryKey: string | string[]) => {
  await queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
};

export const prefetchQuery = async (queryKey: string | string[]) => {
  await queryClient.prefetchQuery({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    staleTime: 30 * 1000,
  });
};