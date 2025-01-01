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
          data: {
            ...data,
            status: "draft"
          }
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

  // Submit mutation with proper type safety and validation
  const submitMutation = useMutation<PurchaseRequest, Error, Partial<PurchaseRequest>>({
    mutationFn: async (data) => {
      if (!data) {
        throw new Error("Request data is required");
      }

      // Validate required fields before submission
      const requiredFields = ['title', 'description', 'items', 'vendorId', 'purposeType'];
      const missingFields = requiredFields.filter(field => !data[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          data: {
            ...data,
            status: "pending"
          }
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

  return {
    requests,
    isLoading,
    error,
    saveDraft: draftMutation.mutateAsync,
    submitRequest: submitMutation.mutateAsync,
    deleteRequest: deleteMutation.mutateAsync,
  };
}