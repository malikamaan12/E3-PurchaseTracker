import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { saveDraft, submitRequest } from "@/services/requests";
import { useErrorHandler } from "@/services/error-logging";
import { NOTIFICATION_CONFIG, ERROR_MESSAGES } from "@/config/notification";

interface ApprovalData {
  requestId: number;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  department: string;
}

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const handleError = useErrorHandler();

  // Fetch all requests with optimized fields and error handling
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["/api/requests"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/requests", {
          credentials: 'include'
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Failed to fetch requests:", errorText);
          throw new Error(errorText || `Failed to fetch requests: ${res.status}`);
        }

        const data = await res.json();
        console.log("Fetched requests:", data);
        return data;
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

  // Draft mutation with optimistic updates
  const draftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchaseRequest> }) => {
      return saveDraft(id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });
      const previousRequests = queryClient.getQueryData(["/api/requests"]);

      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        return old.map(request => 
          request.id === id 
            ? { ...request, ...data, status: "draft", updatedAt: new Date().toISOString() }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Draft saved successfully",
      });
    },
    onError: async (error: Error, variables, context) => {
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      await handleError(error, {
        title: "Error saving draft",
        fallbackMessage: ERROR_MESSAGES.UPDATE_FAILED
      });
    }
  });

  // Submit mutation with optimistic updates
  const submitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchaseRequest> }) => {
      return submitRequest(id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });
      const previousRequests = queryClient.getQueryData(["/api/requests"]);

      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        return old.map(request => 
          request.id === id 
            ? { ...request, ...data, status: "pending", submittedAt: new Date().toISOString() }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request submitted successfully",
      });
    },
    onError: async (error: Error, variables, context) => {
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      await handleError(error, {
        title: "Error submitting request",
        fallbackMessage: ERROR_MESSAGES.UPDATE_FAILED
      });
    }
  });

  return {
    requests,
    isLoading,
    error,
    saveDraft: draftMutation.mutateAsync,
    submitRequest: submitMutation.mutateAsync,
  };
}