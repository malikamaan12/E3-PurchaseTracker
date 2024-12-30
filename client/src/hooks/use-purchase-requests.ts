import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { saveDraft, submitRequest, createRequest, updateRequest } from "@/services/requests";

interface ApprovalData {
  requestId: number;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  department: string;
}

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    onError: (error) => {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch requests",
        variant: "destructive",
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
    onError: (error: Error) => {
      console.error("Error saving draft:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
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
    onError: (error: Error) => {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  // Create approval mutation
  const createApproval = useMutation({
    mutationFn: async (data: ApprovalData) => {
      // Validate required fields
      if (!data.requestId || !data.status || !data.department) {
        throw new Error('Missing required fields: requestId, status, and department are required');
      }

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
    onError: (error: Error) => {
      console.error("Error creating approval:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create approval",
        variant: "destructive",
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