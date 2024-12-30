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

interface MutationParams {
  id: number;
  data: Partial<PurchaseRequest>;
  formData: FormData;
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
    mutationFn: async ({ id, data, formData }: MutationParams) => {
      console.log('Saving draft mutation:', { id, data });
      return saveDraft(id, data, formData);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });
      const previousRequests = queryClient.getQueryData<PurchaseRequest[]>(["/api/requests"]);

      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        if (id === 0) {
          // For new drafts, add to the beginning of the list
          const newRequest = {
            ...data,
            id: Date.now(), // Temporary ID
            status: "draft",
            isLocked: false,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          return [newRequest, ...old];
        }

        // For existing drafts, update in place
        return old.map(request => 
          request.id === id 
            ? { 
                ...request, 
                ...data, 
                status: "draft",
                isLocked: false,
                updatedAt: new Date().toISOString()
              }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: (result, variables) => {
      console.log('Draft saved successfully:', result);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Draft saved successfully",
      });
    },
    onError: async (error: Error, variables, context) => {
      console.error('Error saving draft:', error);
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      toast({
        title: "Error saving draft",
        description: error.message || ERROR_MESSAGES.UPDATE_FAILED,
        variant: "destructive"
      });

      await handleError(error, {
        title: "Error saving draft",
      });
    }
  });

  // Submit mutation with optimistic updates
  const submitMutation = useMutation({
    mutationFn: async ({ id, data, formData }: MutationParams) => {
      console.log('Submitting request mutation:', { id, data });
      return submitRequest(id, data, formData);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });
      const previousRequests = queryClient.getQueryData<PurchaseRequest[]>(["/api/requests"]);

      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        if (id === 0) {
          // For new requests, add to the beginning of the list
          const newRequest = {
            ...data,
            id: Date.now(), // Temporary ID
            status: "pending",
            isLocked: true,
            submittedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          return [newRequest, ...old];
        }

        // For existing requests, update in place
        return old.map(request => 
          request.id === id 
            ? { 
                ...request, 
                ...data, 
                status: "pending",
                isLocked: true,
                submittedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: (result, variables) => {
      console.log('Request submitted successfully:', result);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request submitted successfully",
      });
    },
    onError: async (error: Error, variables, context) => {
      console.error('Error submitting request:', error);
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      toast({
        title: "Error submitting request",
        description: error.message || ERROR_MESSAGES.UPDATE_FAILED,
        variant: "destructive"
      });

      await handleError(error, {
        title: "Error submitting request",
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