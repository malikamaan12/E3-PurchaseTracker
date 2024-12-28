import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest, PurchaseRequestWithRelations, Approval } from "@db/schema";

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all requests with caching
  const { data: requests, isLoading, error } = useQuery<PurchaseRequestWithRelations[]>({
    queryKey: ["/api/requests"],
    retry: 1,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Fetch single request with caching
  const getRequest = (id: number) => {
    return useQuery<PurchaseRequestWithRelations>({
      queryKey: [`/api/requests/${id}`],
      enabled: !!id,
      staleTime: 30000,
      queryFn: async () => {
        const res = await fetch(`/api/requests/${id}`, {
          credentials: "include",
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await res.json();
            throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
          }
          const errorText = await res.text();
          throw new Error(errorText || `${res.status}: ${res.statusText}`);
        }

        return res.json();
      },
    });
  };

  // Create approval mutation with enhanced error handling
  const createApproval = useMutation({
    mutationFn: async ({ requestId, status, comments }: { requestId: number; status: 'approved' | 'rejected'; comments?: string }) => {
      try {
        const res = await fetch(`/api/requests/${requestId}/approvals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status, comments }),
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errorData = await res.json();
            throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
          }
          const errorText = await res.text();
          if (errorText.toLowerCase().includes('<!doctype html>')) {
            throw new Error(`Server Error (${res.status}): The server encountered an error`);
          }
          throw new Error(errorText || `${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          throw new Error(`Invalid response format: Expected JSON but got ${contentType}`);
        }

        return res.json();
      } catch (error) {
        console.error('Approval error:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to process approval');
      }
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
        description: error.message || "Failed to process approval",
        variant: "destructive",
      });
    },
  });

  const createRequest = useMutation({
    mutationFn: async (data: Partial<PurchaseRequest>) => {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create request");
      }

      return res.json();
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

  const updateRequest = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<PurchaseRequest>;
    }) => {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/requests/${variables.id}`] });
      toast({
        title: "Success",
        description: "Request updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
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