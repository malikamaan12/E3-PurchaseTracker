import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        try {
          const res = await fetch(queryKey[0] as string, {
            credentials: "include",
          });

          // Always try to parse JSON first
          try {
            const data = await res.json();

            // If response is not ok, throw the error data
            if (!res.ok) {
              if (res.status === 404) {
                throw new Error(`API endpoint not found: ${queryKey[0]}`);
              }
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
        // Only retry on network errors or 5xx errors, not on 404s
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