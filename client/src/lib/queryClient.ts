import { QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0];
        if (typeof url !== 'string' || !isValidUrl(url)) {
          throw new Error(`Invalid URL in query key: ${String(url)}`);
        }

        try {
          const res = await fetch(url, {
            credentials: "include",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);

            // Handle 404 errors specifically for request routes
            if (res.status === 404 && url.includes('/api/requests/')) {
              throw new Error('Request not found');
            }

            const errorMessage = errorData?.message || `${res.status}: ${res.statusText}`;
            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });

            throw new Error(errorMessage);
          }

          const data = await res.json();
          return data;
        } catch (error) {
          console.error('Query error:', {
            url,
            error: error instanceof Error ? error.message : String(error)
          });

          // Show user-friendly error message
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to fetch data",
            variant: "destructive",
          });

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
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });
      }
    }
  }
});

// Cache invalidation helper
export const invalidateQueries = async (queryKey: string | string[]) => {
  const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
  await Promise.all(
    keys.map(key => queryClient.invalidateQueries({ queryKey: [key] }))
  );
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
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  } else {
    toast({
      title: "Error",
      description: "An unexpected error occurred",
      variant: "destructive",
    });
  }
};