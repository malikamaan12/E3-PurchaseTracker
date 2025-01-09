import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest } from "@db/schema";
import { useErrorHandler } from "@/services/error-logging";
import { NOTIFICATION_CONFIG } from "@/config/notification";
import { useEffect, useCallback, useRef } from "react";

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

  // Ref to track processed auto-approvals
  const processedAutoApprovals = useRef(new Set<string>());

  // Helper function to determine if all other departments except the given one have approved
  const allOtherDepartmentsApproved = useCallback((request: any, excludeDepartment: string) => {
    const otherDepartments = requiredDepartments.filter(dept => dept !== excludeDepartment);
    return otherDepartments.every(dept =>
      request.approvals?.some((approval: any) =>
        approval.department === dept && approval.status === 'approved'
      )
    );
  }, []);

  // Helper function to determine effective status
  const getEffectiveStatus = useCallback((request: any) => {
    if (!request.approvals) return request.status;

    // Check if all departments have approved
    const allDepartmentsApproved = requiredDepartments.every(dept =>
      request.approvals?.some((approval: any) =>
        approval.department === dept && approval.status === 'approved'
      )
    );

    return allDepartmentsApproved ? 'approved' : request.status;
  }, []);

  // Fetch all requests
  const { data: rawRequests = [], isLoading, error } = useQuery({
    queryKey: ["/api/requests"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/requests", {
          credentials: 'include'
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Failed to fetch requests: ${response.status}`);
        }
        return response.json();
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

  // Approval mutation
  const approvalMutation = useMutation<{ message: string }, Error, ApprovalData>({
    mutationFn: async (data) => {
      if (!data.requestId || !data.status || !data.departmentId) {
        throw new Error("Missing required fields");
      }

      const requestBody = {
        status: data.status,
        department: data.departmentId,
        comments: data.comments?.trim() || undefined,
        isAutoApproval: data.comments?.includes('Auto-approved') || false
      };

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
        throw new Error(errorText || `Failed to process approval: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Success",
        description: "Approval submitted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process approval",
        variant: "destructive"
      });
    }
  });

  // Process auto-approvals
  const processAutoApprovals = useCallback((requests: any[]) => {
    requests.forEach((request: any) => {
      if (!request.requester || !request.approvals) return;

      const requesterDepartment = request.requester.department;
      if (!requiredDepartments.includes(requesterDepartment)) return;

      const requesterDeptApproval = request.approvals.find(
        (approval: any) => approval.department === requesterDepartment
      );

      // Create a unique key for this auto-approval
      const autoApprovalKey = `${request.id}-${requesterDepartment}`;

      // Check if we haven't processed this auto-approval yet
      if (
        !processedAutoApprovals.current.has(autoApprovalKey) &&
        requesterDeptApproval?.status === 'pending' &&
        allOtherDepartmentsApproved(request, requesterDepartment)
      ) {
        // Mark this auto-approval as processed
        processedAutoApprovals.current.add(autoApprovalKey);

        // Schedule the auto-approval for the next tick to avoid render cycle issues
        setTimeout(() => {
          approvalMutation.mutate({
            requestId: request.id,
            status: 'approved',
            departmentId: requesterDepartment,
            comments: 'Auto-approved as all other departments have approved'
          });
        }, 0);
      }
    });
  }, [approvalMutation, allOtherDepartmentsApproved]);

  // Effect to handle auto-approvals
  useEffect(() => {
    if (!rawRequests?.length) return;
    processAutoApprovals(rawRequests);

    // Cleanup function
    return () => {
      processedAutoApprovals.current.clear();
    };
  }, [rawRequests, processAutoApprovals]);

  return {
    requests: rawRequests.map((request: any) => ({
      ...request,
      status: getEffectiveStatus(request)
    })),
    isLoading,
    error,
    processApproval: approvalMutation.mutateAsync,
  };
}