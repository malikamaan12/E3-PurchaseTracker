import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastContext } from "@/contexts/ToastContext";
import type { PurchaseRequest } from "@db/schema";
import { useErrorHandler } from "@/services/error-logging";
import { NOTIFICATION_CONFIG } from "@/config/notification";
import { useEffect, useCallback, useRef, useState } from "react";

interface ApprovalData {
  requestId: number;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  departmentId: string;
}

interface RequestWithApprovals extends PurchaseRequest {
  approvals?: Array<{
    department: string;
    status: string;
    isMandatory?: boolean;
  }>;
  requester?: {
    department: string;
  };
}

export function usePurchaseRequests() {
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const handleError = useErrorHandler();
  const toastTimeoutRef = useRef<NodeJS.Timeout>();
  const [processedRequests] = useState(() => new Set<string>());

  // Required departments for approval
  const requiredDepartments = ['CEO Office', 'Finance', 'Director'];

  // Helper function to determine if all other departments except the given one have approved
  const allOtherDepartmentsApproved = useCallback((request: RequestWithApprovals, excludeDepartment: string) => {
    if (!request?.approvals) return false;

    const otherDepartments = requiredDepartments.filter(dept => dept !== excludeDepartment);
    return otherDepartments.every(dept =>
      request.approvals.some(approval =>
        approval.department === dept && approval.status === 'approved'
      )
    );
  }, []);

  // Helper function to determine effective status
  const getEffectiveStatus = useCallback((request: RequestWithApprovals) => {
    if (!request?.approvals) return request?.status || 'pending';

    const allDepartmentsApproved = requiredDepartments.every(dept =>
      request.approvals.some(approval =>
        approval.department === dept && approval.status === 'approved'
      )
    );

    return allDepartmentsApproved ? 'approved' : request.status;
  }, []);

  // Fetch all requests
  const { data: rawRequests = [], isLoading, error } = useQuery<RequestWithApprovals[]>({
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
    }
  });

  // Submit request mutation
  const submitRequestMutation = useMutation({
    mutationFn: async (request: Partial<RequestWithApprovals>) => {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, status: 'pending' }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to submit request: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      showToast({
        title: "Success",
        description: "Request submitted successfully",
        variant: "success"
      });
    },
    onError: (error: Error) => {
      showToast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "error"
      });
    }
  });

  // Delete request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete request: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      showToast({
        title: "Success",
        description: "Request deleted successfully",
        variant: "success"
      });
    },
    onError: (error: Error) => {
      showToast({
        title: "Error",
        description: error.message || "Failed to delete request",
        variant: "error"
      });
    }
  });

  // Approval mutation
  const approvalMutation = useMutation<{ message: string }, Error, ApprovalData>({
    mutationFn: async (data) => {
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
        throw new Error(`Failed to process approval: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
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
  const processAutoApprovals = useCallback((requests: RequestWithApprovals[]) => {
    requests.forEach((request) => {
      if (!request?.requester?.department || !request.approvals) return;

      const requesterDepartment = request.requester.department;
      if (!requiredDepartments.includes(requesterDepartment)) return;

      // Create a unique key for this auto-approval
      const autoApprovalKey = `${request.id}-${requesterDepartment}`;

      // Skip if we've already processed this request
      if (processedRequests.has(autoApprovalKey)) return;

      // Check if conditions are met for auto-approval
      if (
        !request.approvals.some(a => a.department === requesterDepartment) &&
        allOtherDepartmentsApproved(request, requesterDepartment)
      ) {
        processedRequests.add(autoApprovalKey);

        approvalMutation.mutate({
          requestId: request.id,
          status: 'approved',
          departmentId: requesterDepartment,
          comments: `Auto-approved as all other departments have approved - ${new Date().toISOString()}`
        });
      }
    });
  }, [approvalMutation, allOtherDepartmentsApproved, processedRequests]);

  // Effect to handle auto-approvals
  useEffect(() => {
    if (rawRequests?.length) {
      processAutoApprovals(rawRequests);
    }
  }, [rawRequests, processAutoApprovals]);

  return {
    requests: rawRequests.map((request) => ({
      ...request,
      status: getEffectiveStatus(request)
    })),
    isLoading,
    error,
    submitRequest: submitRequestMutation.mutateAsync,
    deleteRequest: deleteRequestMutation.mutateAsync,
    processApproval: approvalMutation.mutateAsync,
  };
}