import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { saveDraft, submitRequest } from "@/services/requests";
import { useErrorHandler } from "@/services/error-logging";

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
      const res = await fetch("/api/requests", {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    staleTime: 30000 // Cache for 30 seconds
  });

  // Draft mutation
  const draftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchaseRequest> }) => {
      return saveDraft(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Draft saved successfully",
      });
    },
    onError: async (error: Error) => {
      await handleError(error, {
        title: "Error saving draft"
      });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchaseRequest> }) => {
      return submitRequest(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request submitted successfully",
      });
    },
    onError: async (error: Error) => {
      await handleError(error, {
        title: "Error submitting request"
      });
    },
  });

  // Create approval mutation
  const createApproval = useMutation({
    mutationFn: async (data: ApprovalData) => {
      const res = await fetch(`/api/requests/${data.requestId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Failed to create approval: ${res.status}`);
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: `Request ${variables.status} successfully`,
      });
    },
    onError: async (error: Error) => {
      await handleError(error, {
        title: "Error creating approval"
      });
    },
  });

  return {
    requests,
    isLoading,
    error,
    saveDraft: draftMutation.mutateAsync,
    submitRequest: submitMutation.mutateAsync,
    createApproval: createApproval.mutateAsync,
  };
}