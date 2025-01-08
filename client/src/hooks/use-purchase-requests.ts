import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { useErrorHandler } from "@/services/error-logging";
import { NOTIFICATION_CONFIG } from "@/config/notification";

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const handleError = useErrorHandler();

  // Fetch all requests with optimized fields
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["/api/requests"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/requests", {
          credentials: 'include'
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `Failed to fetch requests: ${res.status}`);
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching requests:", error);
        throw error;
      }
    },
    staleTime: NOTIFICATION_CONFIG.STALE_TIME,
    gcTime: NOTIFICATION_CONFIG.CACHE_TIME,
    retry: NOTIFICATION_CONFIG.MAX_RETRIES,
    refetchOnWindowFocus: NOTIFICATION_CONFIG.REFRESH_ON_FOCUS
  });

  // Draft mutation with proper type safety
  const draftMutation = useMutation<PurchaseRequest, Error, Partial<PurchaseRequest>>({
    mutationFn: async (data) => {
      if (!data) {
        throw new Error("Request data is required");
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "draft",
          data
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to save draft: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Draft saved successfully",
      });
    },
    onError: async (error) => {
      await handleError(error, {
        title: "Error saving draft"
      });
    }
  });

  return {
    requests,
    isLoading,
    error,
    saveDraft: draftMutation.mutateAsync,
  };
}