import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastContext } from "@/contexts/ToastContext";
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
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const handleError = useErrorHandler();
  const toastTimeoutRef = useRef<NodeJS.Timeout>();

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
          throw new Error(`Failed to fetch requests: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        handleError(error, {
          title: 'Error Fetching Requests',
          silent: false
        });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });

      // Show different toast messages based on auto-approval
      const isAutoApproval = variables.comments?.includes('Auto-approved');
      showToast({
        title: isAutoApproval ? "Auto-Approval Completed" : "Success",
        description: isAutoApproval
          ? `Request automatically approved for ${variables.departmentId}`
          : "Approval submitted successfully",
        variant: "success",
        duration: 3000
      });
    },
    onError: (error) => {
      showToast({
        title: "Error",
        description: error.message || "Failed to process approval",
        variant: "error",
        duration: 7000
      });
    }
  });

  // Process auto-approvals
  const processAutoApprovals = useCallback((requests: any[]) => {
    requests.forEach((request: any) => {
      if (!request.requester || !request.approvals) return;

      const requesterDepartment = request.requester.department;
      if (!requiredDepartments.includes(requesterDepartment)) return;

      // Create a unique key for this auto-approval
      const autoApprovalKey = `${request.id}-${requesterDepartment}`;

      // Check if we haven't processed this auto-approval yet and conditions are met
      if (
        !processedAutoApprovals.current.has(autoApprovalKey) &&
        !request.approvals.some((a: any) => a.department === requesterDepartment && a.status !== 'pending') &&
        allOtherDepartmentsApproved(request, requesterDepartment)
      ) {
        // Mark this auto-approval as processed
        processedAutoApprovals.current.add(autoApprovalKey);

        // Execute the auto-approval
        setTimeout(() => {
          approvalMutation.mutate({
            requestId: request.id,
            status: 'approved',
            departmentId: requesterDepartment,
            comments: `Auto-approved as all other departments have approved - ${new Date().toISOString()}`
          });
        }, 0);
      }
    });
  }, [approvalMutation, allOtherDepartmentsApproved]);

  // Effect to handle auto-approvals
  useEffect(() => {
    if (!rawRequests?.length) return;
    processAutoApprovals(rawRequests);

    return () => {
      processedAutoApprovals.current.clear();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
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