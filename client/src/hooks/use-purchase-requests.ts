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

  // Delete mutation with proper type safety
  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: async (requestId) => {
      if (!requestId) {
        throw new Error("Request ID is required for deletion");
      }

      const response = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to delete request: ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request deleted successfully",
      });
    },
    onError: async (error) => {
      await handleError(error, {
        title: "Error deleting request"
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request submitted successfully",
      });
    },
    onError: async (error) => {
      await handleError(error, {
        title: "Error submitting request"
      });
    }
  });

  // Approval mutation with proper type safety and duplicate prevention
  const approvalMutation = useMutation<{ message: string }, Error, ApprovalData>({
    mutationFn: async (data) => {
      if (!data.requestId) {
        throw new Error("Request ID is required for approval");
      }

      // First, fetch current approvals to check for duplicates
      const checkResponse = await fetch(`/api/requests/${data.requestId}`, {
        credentials: 'include'
      });

      if (!checkResponse.ok) {
        throw new Error(`Failed to verify approval status: ${checkResponse.status}`);
      }

      const request = await checkResponse.json();
      const existingDepartmentApproval = request.approvals?.find(
        (a: any) => a.department === data.department && 
                    ["approved", "rejected", "changes_requested"].includes(a.status)
      );

      if (existingDepartmentApproval) {
        throw new Error(`Your department has already processed this request at ${
          new Date(existingDepartmentApproval.processedAt).toLocaleString()
        }`);
      }

      // Proceed with approval if no duplicates found
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
        throw new Error(errorText || `Failed to process approval: ${response.status}`);
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
    deleteRequest: deleteMutation.mutateAsync,
  };
}