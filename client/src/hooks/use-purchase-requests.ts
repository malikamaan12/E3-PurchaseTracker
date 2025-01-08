import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { useErrorHandler } from "@/services/error-logging";
import { NOTIFICATION_CONFIG } from "@/config/notification";

interface ApprovalData {
  requestId: number;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  departmentId: string;
}

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const handleError = useErrorHandler();

  // Required departments for approval
  const requiredDepartments = ['CEO Office', 'Finance', 'Director'];

  // Helper function to determine effective status
  const getEffectiveStatus = (request: any) => {
    const allDepartmentsApproved = requiredDepartments.every(dept => 
      request.approvals?.some((approval: any) => 
        approval.department === dept && approval.status === 'approved'
      )
    );
    return allDepartmentsApproved ? 'approved' : request.status;
  };

  // Fetch all requests with optimized fields
  const { data: rawRequests = [], isLoading, error } = useQuery({
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

  // Process requests to include effective status
  const requests = rawRequests.map((request: any) => ({
    ...request,
    status: getEffectiveStatus(request)
  }));

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

  // Approval mutation with proper type safety
  const approvalMutation = useMutation<{ message: string }, Error, ApprovalData>({
    mutationFn: async (data) => {
      console.log("Starting approval mutation with data:", data);

      if (!data.requestId || !data.status || !data.departmentId) {
        const error = new Error("Missing required fields");
        console.error("Validation error:", { data, error });
        throw error;
      }

      try {
        console.log("Making API request to:", `/api/requests/${data.requestId}/approvals`);
        const requestBody = {
          status: data.status,
          department: data.departmentId, 
          comments: data.comments?.trim() || undefined
        };
        console.log("Request body:", requestBody);

        const response = await fetch(`/api/requests/${data.requestId}/approvals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          credentials: 'include'
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error response:", {
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          throw new Error(errorText || `Failed to process approval: ${response.status}`);
        }

        const result = await response.json();
        console.log("API success response:", result);
        return result;
      } catch (error) {
        console.error("API call error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Approval mutation succeeded:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Approval submitted successfully"
      });
    },
    onError: (error: Error) => {
      console.error("Approval mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process approval",
        variant: "destructive"
      });
    }
  });

  return {
    requests,
    isLoading,
    error,
    saveDraft: draftMutation.mutateAsync,
    processApproval: approvalMutation.mutateAsync,
  };
}