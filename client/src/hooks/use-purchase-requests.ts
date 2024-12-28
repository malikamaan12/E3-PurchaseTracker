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

  // Create approval mutation
  const createApproval = useMutation({
    mutationFn: async ({ requestId, status, comments, department }: { 
      requestId: number; 
      status: 'approved' | 'rejected' | 'changes_requested'; 
      comments?: string;
      department: string;  // Make department required
    }) => {
      console.log('Creating approval with:', { requestId, status, comments, department });

      const res = await fetch(`/api/requests/${requestId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, comments, department }),
      });
      return handleApiError(res);
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    requests,
    isLoading,
    error,
    createApproval: createApproval.mutateAsync,
  };
}