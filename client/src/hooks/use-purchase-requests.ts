import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { useErrorHandler } from "@/services/error-logging";
import { NOTIFICATION_CONFIG } from "@/config/notification";

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
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });

      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData(["/api/requests"]) as PurchaseRequest[];

      // Optimistically update to the new value
      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        if (newData.id) {
          return old.map(request => 
            request.id === newData.id 
              ? { ...request, ...newData, status: "draft", updatedAt: new Date().toISOString() }
              : request
          );
        }
        return old;
      });

      return { previousRequests };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Draft saved successfully",
      });
    },
    onError: async (error, _, context) => {
      // Rollback to the previous value
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      await handleError(error, {
        title: "Error saving draft"
      });
    }
  });

  // Submit mutation with type safety
  const submitMutation = useMutation<PurchaseRequest, Error, PurchaseRequest>({
    mutationFn: async (data) => {
      if (!data.id) {
        throw new Error("Request ID is required for submission");
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          data
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to submit request: ${response.status}`);
      }

      return response.json();
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/requests"] });
      const previousRequests = queryClient.getQueryData(["/api/requests"]) as PurchaseRequest[];

      queryClient.setQueryData<PurchaseRequest[]>(["/api/requests"], (old = []) => {
        return old.map(request => 
          request.id === newData.id 
            ? { ...request, ...newData, status: "pending", updatedAt: new Date().toISOString() }
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
    onError: async (error, _, context) => {
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/requests"], context.previousRequests);
      }

      await handleError(error, {
        title: "Error submitting request"
      });
    }
  });

  // Approval mutation with proper type safety
  const approvalMutation = useMutation<{ message: string }, Error, ApprovalData>({
    mutationFn: async (data) => {
      if (!data.requestId) {
        throw new Error("Request ID is required for approval");
      }

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
    onError: async (error) => {
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