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
  onApprovalUpdate?: () => void;
}

export default function ApprovalFlow({
  approvals,
  requestId,
  requesterId,
  status,
  onApprovalUpdate,
}: ApprovalFlowProps) {
  const { user } = useUser();
  const { createApproval } = usePurchaseRequests();
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Find existing department approval if any
    const departmentApproval = approvals.find(
      (a) => a.department === user.department && 
             ["approved", "rejected", "changes_requested"].includes(a.status)
    );

    // Find existing user approval if any
    const userApproval = approvals.find(
      (a) => a.approverId === user.id && 
             ["approved", "rejected", "changes_requested"].includes(a.status)
    );

    // Special roles check
    const isSpecialRole = ["CEO Office", "Director", "Finance"].includes(user.department);

    // Cannot approve own requests
    if (requesterId === user.id) {
      return { canApprove: false, message: "You cannot approve your own requests" };
    }

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

    // User already processed
    if (userApproval) {
      const action = userApproval.status === 'approved' 
        ? 'approved' 
        : userApproval.status === 'rejected'
          ? 'rejected'
          : 'requested changes for';

      const time = userApproval.processedAt 
        ? format(new Date(userApproval.processedAt), "PPp")
        : 'previously';

      return { 
        canApprove: false, 
        message: `You have already ${action} this request at ${time}` 
      };
    }

    // All checks passed
    return { canApprove: true, message: "" };
  }, [approvals, user, requesterId, status]);

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

      // Double-check approval state before proceeding
      const currentDepartmentApproval = approvals.find(
        (a) => a.department === user.department && 
               ["approved", "rejected", "changes_requested"].includes(a.status)
      );

      const currentUserApproval = approvals.find(
        (a) => a.approverId === user.id && 
               ["approved", "rejected", "changes_requested"].includes(a.status)
      );

      if (currentDepartmentApproval || currentUserApproval) {
        toast({
          title: "Error",
          description: "This request has already been processed",
          variant: "destructive",
        });
        return;
      }

      const approvalData = {
        requestId,
        status: approvalStatus,
        department: user.department,
        comments: comments.trim() || undefined,
        approverId: user.id,
        processedAt: new Date().toISOString()
      };

      await createApproval(approvalData);

      toast({
        title: "Success",
        description: `Request ${approvalStatus.replace('_', ' ')} successfully at ${format(new Date(), "PPp")}`,
      });

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
      <h4 className="font-medium">Approval Flow</h4>
      <div className="space-y-2">
        {approvals.map((approval) => (
          <Card key={approval.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(approval.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{approval.department}</p>
                      {approval.isMandatory && (
                        <Badge variant="outline" className="text-xs">
                          Mandatory
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {approval.approver?.username || 'Unknown Approver'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge className={getStatusColor(approval.status)}>
                    {approval.status.toUpperCase().replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {approval.processedAt && format(new Date(approval.processedAt), "PPp")}
                  </span>
                </div>
              </div>
              {approval.comments && (
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {approval.comments}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

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