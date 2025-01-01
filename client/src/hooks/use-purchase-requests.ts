import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";

interface ApprovalData {
  requestId: number;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  department: string;
}

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    onError: (error) => {
      toast({
        title: "Error saving draft",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Submit mutation with type safety
  const submitMutation = useMutation<PurchaseRequest, Error, PurchaseRequest>({
    mutationFn: async (data) => {
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
    onError: (error) => {
      toast({
        title: "Error submitting request",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: async (requestId) => {
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
    onError: (error) => {
      toast({
        title: "Error deleting request",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    saveDraft: draftMutation.mutateAsync,
    submitRequest: submitMutation.mutateAsync,
    deleteRequest: deleteMutation.mutateAsync,
  };
}