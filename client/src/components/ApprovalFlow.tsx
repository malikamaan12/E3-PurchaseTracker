import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  type PurchaseRequest, 
  type User, 
  type Approval 
} from "@db/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ApprovalFlowProps {
  approvals: (Approval & { approver?: User })[];
  requestId: number;
  requesterId: number;
  status: string;
  additionalApprovers?: string[];
  onApprovalUpdate?: () => void;
}

export default function ApprovalFlow({
  approvals,
  requestId,
  requesterId,
  status,
  additionalApprovers = [],
  onApprovalUpdate,
}: ApprovalFlowProps) {
  const { user } = useUser();
  const { createApproval, updateRequestStatus } = usePurchaseRequests();
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get all required departments
  const requiredDepartments = useMemo(() => {
    const mandatoryDepartments = ['CEO Office', 'Finance', 'Director'];
    const uniqueDepartments = [...new Set([...mandatoryDepartments, ...additionalApprovers])];
    return uniqueDepartments;
  }, [additionalApprovers]);

  // Check if all required departments have approved
  const checkAllApproved = useMemo(() => {
    return requiredDepartments.every(dept => 
      approvals.some(a => a.department === dept && a.status === 'approved')
    );
  }, [approvals, requiredDepartments]);

  // Track department and user approval states
  const approvalState = useMemo(() => {
    if (!user?.department || !user?.id) {
      return { canApprove: false, message: "You must be logged in to approve requests" };
    }

    // Check if request is in an approvable state
    if (!["pending", "changes_requested"].includes(status)) {
      return { 
        canApprove: false, 
        message: `Request is not in an approvable state (current status: ${status})` 
      };
    }

    // Cannot approve own requests
    if (requesterId === user.id) {
      return { canApprove: false, message: "You cannot approve your own requests" };
    }

    // Find existing department approval if any
    const departmentApproval = approvals.find(
      (a) => a.department === user.department && 
             ["approved", "rejected", "changes_requested"].includes(a.status)
    );

    // Department already processed
    if (departmentApproval) {
      const action = departmentApproval.status === 'approved' 
        ? 'approved' 
        : departmentApproval.status === 'rejected'
          ? 'rejected'
          : 'requested changes for';

      const time = departmentApproval.processedAt 
        ? format(new Date(departmentApproval.processedAt), "PPp")
        : 'previously';

      return { 
        canApprove: false, 
        message: `Your department has already ${action} this request at ${time}` 
      };
    }

    // Check if user's department is required for approval
    if (!requiredDepartments.includes(user.department)) {
      return { 
        canApprove: false, 
        message: "Your department is not required for this approval" 
      };
    }

    // All checks passed
    return { canApprove: true, message: "" };
  }, [approvals, user, requesterId, status, requiredDepartments]);

  const handleApproval = async (approvalStatus: "approved" | "rejected" | "changes_requested") => {
    if (!user?.department || !user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to approve requests",
        variant: "destructive",
      });
      return;
    }

    if (isSubmitting || !approvalState.canApprove) {
      toast({
        title: "Error",
        description: approvalState.message,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // First, create the approval
      await createApproval({
        requestId,
        status: approvalStatus,
        department: user.department,
        comments: comments.trim() || undefined,
      });

      // Check if all required departments have approved
      const updatedApprovals = await fetch(`/api/requests/${requestId}/approvals`).then(res => res.json());
      const allDepartmentsApproved = requiredDepartments.every(dept => 
        updatedApprovals.some((a: Approval) => a.department === dept && a.status === 'approved')
      );

      // If all departments have approved, update the request status
      if (allDepartmentsApproved && approvalStatus === 'approved') {
        await updateRequestStatus({ 
          requestId, 
          status: 'approved' 
        });

        toast({
          title: "Success",
          description: "All departments have approved. Request status updated to approved.",
        });
      } else {
        toast({
          title: "Success",
          description: `Request ${approvalStatus.replace('_', ' ')} successfully`,
        });
      }

      setComments("");
      onApprovalUpdate?.();
    } catch (error: any) {
      console.error('Error in handleApproval:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process approval",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "changes_requested":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "rejected":
        return "bg-red-500/10 text-red-700 border-red-500/20";
      case "changes_requested":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Approval Flow</h4>
        {checkAllApproved && (
          <Badge variant="outline" className="bg-green-50 text-green-700 animate-fade-in">
            All Approvals Complete
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {/* Show all required departments with their status */}
        {requiredDepartments.map((department) => {
          const departmentApproval = approvals.find(a => a.department === department);
          const isMandatory = ['CEO Office', 'Finance', 'Director'].includes(department);

          return (
            <Card key={department}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(departmentApproval?.status || 'pending')}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{department}</p>
                        {isMandatory && (
                          <Badge variant="outline" className="text-xs">
                            Mandatory
                          </Badge>
                        )}
                      </div>
                      {departmentApproval?.approver && (
                        <p className="text-sm text-gray-500">
                          {departmentApproval.approver.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge className={getStatusColor(departmentApproval?.status || 'pending')}>
                      {(departmentApproval?.status || 'PENDING').toUpperCase().replace('_', ' ')}
                    </Badge>
                    {departmentApproval?.processedAt && (
                      <span className="text-sm text-gray-500">
                        {format(new Date(departmentApproval.processedAt), "PPp")}
                      </span>
                    )}
                  </div>
                </div>
                {departmentApproval?.comments && (
                  <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {departmentApproval.comments}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Only show approval form if user can approve */}
        {status === "pending" && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <h5 className="font-medium mb-2">Add Your Approval</h5>
              <div className="space-y-4">
                <Textarea
                  placeholder="Add comments (optional)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full"
                  disabled={isSubmitting || !approvalState.canApprove}
                />
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            onClick={() => handleApproval("approved")}
                            disabled={isSubmitting || !approvalState.canApprove}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isSubmitting ? "Processing..." : "Approve"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!approvalState.canApprove && (
                        <TooltipContent>
                          <p>{approvalState.message}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            onClick={() => handleApproval("rejected")}
                            disabled={isSubmitting || !approvalState.canApprove}
                            variant="destructive"
                            className="w-full"
                          >
                            {isSubmitting ? "Processing..." : "Reject"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!approvalState.canApprove && (
                        <TooltipContent>
                          <p>{approvalState.message}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            onClick={() => handleApproval("changes_requested")}
                            disabled={isSubmitting || !approvalState.canApprove}
                            variant="outline"
                            className="w-full bg-orange-50 text-orange-600 hover:bg-orange-100"
                          >
                            {isSubmitting ? "Processing..." : "Request Changes"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!approvalState.canApprove && (
                        <TooltipContent>
                          <p>{approvalState.message}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {approvals.length === 0 && (
          <p className="text-sm text-gray-500">No approvals yet</p>
        )}
      </div>
    </div>
  );
}