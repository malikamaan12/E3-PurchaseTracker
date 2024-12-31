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

  // Draft mutation
  const draftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchaseRequest> }) => {
      return saveDraft(id, data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });

      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData(["/api/requests"]);

      // Optimistically update to the new value
      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        return old.map(request => 
          request.id === id 
            ? { ...request, ...data, status: "draft", updatedAt: new Date().toISOString() }
            : request
        );
      });

      // Return a context object with the snapshotted value
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
      // Rollback to the previous value
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      await handleError(error, {
        title: "Error saving draft"
      });
    }
  });

  // Submit mutation
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
        title: "Error submitting request"
      });
    }
  });

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async (data: ApprovalData) => {
      const response = await fetch(`/api/requests/${data.requestId}/approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to create approval: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: data.message || "Approval submitted successfully",
      });
    },
    onError: async (error: Error) => {
      await handleError(error, {
        title: "Error processing approval"
      });
    }
  });

  return {
    requests,
    isLoading,
    error,
    saveDraft: draftMutation.mutateAsync,
    submitRequest: submitMutation.mutateAsync,
    createApproval: approvalMutation.mutateAsync,
  };
}