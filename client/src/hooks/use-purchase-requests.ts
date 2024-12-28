import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleApiError = async (res: Response) => {
    const contentType = res.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const resClone = res.clone();

    try {
      if (isJson || !contentType) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `${res.status}: ${res.statusText}`);
        }
        return data;
      }

      const text = await resClone.text();
      if (!res.ok) {
        throw new Error(text || `${res.status}: ${res.statusText}`);
      }

      return text;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  };

  // Fetch all requests
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["/api/requests"],
    retry: 1,
    staleTime: 30000
  });

  // Create approval mutation
  const createApproval = useMutation({
    mutationFn: async ({ requestId, status, comments }: { 
      requestId: number; 
      status: 'approved' | 'rejected' | 'changes_requested'; 
      comments?: string;
      department?: string;
    }) => {
      const res = await fetch(`/api/requests/${requestId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, comments }),
      });
      return handleApiError(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/requests/${variables.requestId}`] });
      toast({
        title: "Success",
        description: `Request ${variables.status} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: async (data: Partial<PurchaseRequest>) => {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return handleApiError(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update request mutation
  const updateRequest = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchaseRequest> }) => {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return handleApiError(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/requests/${variables.id}`] });
      toast({
        title: "Success",
        description: "Request updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete request mutation
  const deleteRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleApiError(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Request deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    requests,
    isLoading,
    error,
    createRequest: createRequest.mutateAsync,
    updateRequest: updateRequest.mutateAsync,
    deleteRequest: deleteRequest.mutateAsync,
    createApproval: createApproval.mutateAsync,
  };
}