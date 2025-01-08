import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  type PurchaseRequest, 
  type User, 
  type Approval 
} from "@db/schema";

interface ApprovalFlowProps {
  request: PurchaseRequest;
  onApprovalUpdate?: () => void;
}

export default function ApprovalFlow({
  request,
  onApprovalUpdate
}: ApprovalFlowProps) {
  const { user } = useUser();
  const { createApproval } = usePurchaseRequests();
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Required departments for approval
  const requiredDepartments = ['CEO Office', 'Finance', 'Director'];

  // Cannot approve own requests
  const isOwnRequest = request.requesterId === user?.id;

  // Check if user's department is required and hasn't approved yet
  const canApprove = user?.department && 
    requiredDepartments.includes(user.department) &&
    !isOwnRequest &&
    request.status === 'pending' &&
    !request.approvals?.some(a => a.department === user.department);

  const handleApproval = async (approvalStatus: "approved" | "rejected" | "changes_requested") => {
    if (!user?.department || !user?.id || isSubmitting || !canApprove) {
      return;
    }

    try {
      setIsSubmitting(true);

      await createApproval({
        requestId: request.id,
        status: approvalStatus,
        department: user.department,
        comments: comments.trim() || undefined
      });

      setComments("");
      toast({
        title: "Success",
        description: `Request ${approvalStatus.replace('_', ' ')} successfully`
      });

      onApprovalUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process approval",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Display approval status for each required department
  const departmentStatuses = requiredDepartments.map(dept => {
    const approval = request.approvals?.find(a => a.department === dept);
    return {
      department: dept,
      status: approval?.status || 'pending',
      approver: approval?.approver?.username,
      processedAt: approval?.processedAt,
      comments: approval?.comments
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Department Approvals</h4>
      </div>

      <div className="space-y-2">
        {departmentStatuses.map(({ department, status, approver, processedAt, comments }) => (
          <Card key={department}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {status === 'approved' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : status === 'rejected' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : status === 'changes_requested' ? (
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{department}</p>
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    </div>
                    {approver && (
                      <p className="text-sm text-gray-500">{approver}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge 
                    className={
                      status === 'approved' 
                        ? "bg-green-500/10 text-green-700 border-green-500/20"
                        : status === 'rejected'
                        ? "bg-red-500/10 text-red-700 border-red-500/20"
                        : status === 'changes_requested'
                        ? "bg-orange-500/10 text-orange-700 border-orange-500/20"
                        : "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                    }
                  >
                    {status.toUpperCase().replace('_', ' ')}
                  </Badge>
                  {processedAt && (
                    <span className="text-sm text-gray-500">
                      {format(new Date(processedAt), "PPp")}
                    </span>
                  )}
                </div>
              </div>
              {comments && (
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {comments}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {request.status === "pending" && canApprove && (
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
                  <Button
                    onClick={() => handleApproval("approved")}
                    disabled={isSubmitting}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? "Processing..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => handleApproval("rejected")}
                    disabled={isSubmitting}
                    variant="destructive"
                    className="flex-1"
                  >
                    {isSubmitting ? "Processing..." : "Reject"}
                  </Button>
                  <Button
                    onClick={() => handleApproval("changes_requested")}
                    disabled={isSubmitting}
                    variant="outline"
                    className="flex-1 bg-orange-50 text-orange-600 hover:bg-orange-100"
                  >
                    {isSubmitting ? "Processing..." : "Request Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}