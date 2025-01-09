import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest, Approval } from "@db/schema";
import { NOTIFICATION_CONFIG } from "@/config/notification";
import { useEffect, useCallback, useRef } from "react";

interface ApprovalData {
  requestId: number;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  departmentId: string;
}

interface RequestWithApprovals extends PurchaseRequest {
  approvals?: Approval[];
  requester?: {
    id: number;
    department: string;
  };
}

export function usePurchaseRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Required departments for approval
  const mandatoryDepartments = ['CEO Office', 'Finance', 'Director'];

  // Ref to track processed auto-approvals
  const processedAutoApprovals = useRef(new Set<string>());

  // Helper function to check if department is mandatory
  const isMandatoryDepartment = useCallback((department: string) => {
    return mandatoryDepartments.includes(department);
  }, []);

  // Helper function to determine if all other departments except the given one have approved
  const allOtherDepartmentsApproved = useCallback((request: RequestWithApprovals, excludeDepartment: string) => {
    const otherDepartments = mandatoryDepartments.filter(dept => dept !== excludeDepartment);
    return otherDepartments.every(dept =>
      request.approvals?.some(approval =>
        approval.department === dept && approval.status === 'approved'
      )
    );
  }, []);

  // Helper function to determine effective status
  const getEffectiveStatus = useCallback((request: RequestWithApprovals) => {
    if (!request.approvals) return request.status;

    // Check if all departments have approved
    const allDepartmentsApproved = mandatoryDepartments.every(dept =>
      request.approvals?.some(approval =>
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

        const data = await response.json();
        return data as RequestWithApprovals[];
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      const approvalType = variables.comments?.includes('Auto-approved') ? 'auto-approved' : 'approved';
      toast({
        title: "Success",
        description: `Request ${approvalType} successfully`
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

  // Process auto-approvals immediately when conditions are met
  const processAutoApprovals = useCallback((requests: RequestWithApprovals[]) => {
    requests.forEach((request) => {
      // Skip if request is not pending or missing required data
      if (!request.requester || !request.approvals || request.status !== 'pending') return;

      const requesterDepartment = request.requester.department;

      // Only process if requester is from a mandatory department
      if (!isMandatoryDepartment(requesterDepartment)) return;

      const requesterDeptApproval = request.approvals.find(
        (approval) => approval.department === requesterDepartment
      );

      // Create a unique key for this auto-approval
      const autoApprovalKey = `${request.id}-${requesterDepartment}`;

      // Check if we haven't processed this auto-approval yet and if other departments have approved
      if (
        !processedAutoApprovals.current.has(autoApprovalKey) &&
        requesterDeptApproval?.status === 'pending' &&
        allOtherDepartmentsApproved(request, requesterDepartment)
      ) {
        // Mark this auto-approval as processed immediately
        processedAutoApprovals.current.add(autoApprovalKey);

        // Execute auto-approval immediately
        approvalMutation.mutate({
          requestId: request.id,
          status: 'approved',
          departmentId: requesterDepartment,
          comments: `Auto-approved as all other departments have approved. This request was created by ${requesterDepartment}.`
        });

        // Notify about the auto-approval
        toast({
          title: "Auto-Approval",
          description: `Request automatically approved for ${requesterDepartment} as all other departments have approved.`
        });
      }
    });
  }, [approvalMutation, allOtherDepartmentsApproved, isMandatoryDepartment, toast]);

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
    requests: rawRequests.map((request) => ({
      ...request,
      status: getEffectiveStatus(request)
    })),
    isLoading,
    error,
    processApproval: approvalMutation.mutateAsync,
  };
}