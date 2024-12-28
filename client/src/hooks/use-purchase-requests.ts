import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest, PurchaseRequestWithRelations } from "@db/schema";

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Improved error handling helper that clones the response
  const handleApiError = async (res: Response) => {
    const contentType = res.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const resClone = res.clone(); // Clone response for multiple reads

    try {
      // If content type is JSON or unknown, try JSON first
      if (isJson || !contentType) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `${res.status}: ${res.statusText}`);
        }
        return data;
      } 

      // For non-JSON responses, read as text
      const text = await resClone.text();

      // Handle HTML error pages
      if (text.toLowerCase().includes('<!doctype html')) {
        throw new Error(`Server error (${res.status}): Please try again later`);
      }

      // For non-OK responses, throw the text
      if (!res.ok) {
        throw new Error(text || `${res.status}: ${res.statusText}`);
      }

      throw new Error(`Invalid response format: Expected JSON but got ${contentType}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  };

  // Fetch all requests
  const { data: requests, isLoading, error } = useQuery<PurchaseRequestWithRelations[]>({
    queryKey: ["/api/requests"],
    retry: 1,
    staleTime: 30000,
  });

  // Fetch single request
  const getRequest = (id: number) => {
    return useQuery<PurchaseRequestWithRelations>({
      queryKey: [`/api/requests/${id}`],
      enabled: !!id,
      staleTime: 30000,
    });
  };

  // Create approval mutation
  const createApproval = useMutation({
    mutationFn: async ({ requestId, status, comments }: { requestId: number; status: 'approved' | 'rejected'; comments?: string }) => {
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
      console.error('Approval error:', error);
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
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleApiError(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Purchase request created successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Create request error:", error);
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
        body: JSON.stringify(data),
        credentials: "include",
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
    getRequest,
    createRequest: createRequest.mutateAsync,
    updateRequest: updateRequest.mutateAsync,
    deleteRequest: deleteRequest.mutateAsync,
    createApproval: createApproval.mutateAsync,
  };
}