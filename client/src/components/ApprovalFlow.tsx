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

  // Check if department has already approved
  const departmentHasApproved = useMemo(() => {
    if (!user?.department) return false;
    return approvals.some(
      (a) => a.department === user.department && 
             ["approved", "rejected", "changes_requested"].includes(a.status)
    );
  }, [approvals, user?.department]);

  // Check if user can approve this request
  const canApprove = useMemo(() => {
    if (!user?.department) return false;

    // Check if request is in an approvable state
    if (!["pending", "changes_requested"].includes(status)) return false;

    // Special roles can approve any request except their own
    const isSpecialRole = ["CEO Office", "Director", "Finance"].includes(user.department);
    if (isSpecialRole && requesterId === user.id) return false;

    // For non-special roles, users cannot approve their own requests
    if (!isSpecialRole && requesterId === user.id) return false;

    // Cannot approve if department has already processed
    return !departmentHasApproved;
  }, [approvals, user, requesterId, status, departmentHasApproved]);

  // Get the reason why approval is not possible
  const getApprovalDisabledReason = () => {
    if (!user?.department) return "You must be logged in to approve requests";
    if (!["pending", "changes_requested"].includes(status)) return "Request is not in an approvable state";
    if (requesterId === user.id) return "You cannot approve your own requests";

    if (departmentHasApproved) {
      const existingApproval = approvals.find(
        (a) => a.department === user.department && 
               ["approved", "rejected", "changes_requested"].includes(a.status)
      );

      if (existingApproval) {
        const action = existingApproval.status === 'approved' 
          ? 'approved' 
          : existingApproval.status === 'rejected'
            ? 'rejected'
            : 'requested changes for';

        const time = existingApproval.processedAt 
          ? format(new Date(existingApproval.processedAt), "PPp")
          : 'previously';

        return `Your department has already ${action} this request at ${time}`;
      }
    }

    return "";
  };

  const handleApproval = async (approvalStatus: "approved" | "rejected" | "changes_requested") => {
    if (isSubmitting || !canApprove) {
      toast({
        title: "Error",
        description: getApprovalDisabledReason(),
        variant: "destructive",
      });
      return;
    }

    if (!user?.department) {
      toast({
        title: "Error",
        description: "You don't have permission to approve this request",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const approvalData = {
        requestId,
        status: approvalStatus,
        department: user.department,
        comments: comments.trim() || undefined,
        approverId: user.id,
        processedAt: new Date().toISOString()
      };

      await createApproval(approvalData);

      // Show success notification with timestamp
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

        {canApprove && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <h5 className="font-medium mb-2">Add Your Approval</h5>
              <div className="space-y-4">
                <Textarea
                  placeholder="Add comments (optional)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full"
                  disabled={isSubmitting}
                />
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            onClick={() => handleApproval("approved")}
                            disabled={isSubmitting || !canApprove}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isSubmitting ? "Processing..." : "Approve"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canApprove && (
                        <TooltipContent>
                          <p>{getApprovalDisabledReason()}</p>
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
                            disabled={isSubmitting || !canApprove}
                            variant="destructive"
                            className="w-full"
                          >
                            {isSubmitting ? "Processing..." : "Reject"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canApprove && (
                        <TooltipContent>
                          <p>{getApprovalDisabledReason()}</p>
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
                            disabled={isSubmitting || !canApprove}
                            variant="outline"
                            className="w-full bg-orange-50 text-orange-600 hover:bg-orange-100"
                          >
                            {isSubmitting ? "Processing..." : "Request Changes"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canApprove && (
                        <TooltipContent>
                          <p>{getApprovalDisabledReason()}</p>
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