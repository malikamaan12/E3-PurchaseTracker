import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { saveDraft, submitRequest, createRequest } from "@/services/requests";
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

  // Fetch all requests
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["/api/requests"],
    queryFn: async ({ queryKey }) => {
      console.log('Fetching requests...');
      const res = await fetch(queryKey[0], {
        credentials: 'include'
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch requests: ${errorText}`);
      }
      const data = await res.json();
      console.log('Fetched requests:', data);
      return data;
    },
    retry: 1,
    staleTime: 30000,
    onError: async (error) => {
      await handleError(error, {
        title: "Error fetching requests"
      });
    }
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
      console.log('Creating approval with:', data);

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
      console.log('Approval created successfully');
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