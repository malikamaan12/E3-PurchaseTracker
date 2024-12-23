import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { Approval, User } from "@db/schema";
import { Button } from "@/components/ui/button";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ApprovalFlowProps {
  approvals: (Approval & { approver: User })[];
  requestId: number;
  onApprovalUpdate?: () => void;
}

export default function ApprovalFlow({
  approvals,
  requestId,
  onApprovalUpdate,
}: ApprovalFlowProps) {
  const { user } = useUser();
  const { createApproval } = usePurchaseRequests();
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user can approve this request
  const canApprove = useMemo(() => {
    if (!user) return false;

    // User cannot approve their own request
    const request = approvals.find(a => a.requestId === requestId);
    if (request && request.requesterId === user.id) return false;

    // Check if user's department has already approved
    const departmentApproval = approvals.find(
      (a) => a.department === user?.department
    );

    return !departmentApproval || departmentApproval.status === "pending";
  }, [approvals, user, requestId]);

  const handleApproval = async (status: "approved" | "rejected") => {
    if (!user || !canApprove) return;

    try {
      setIsSubmitting(true);
      await createApproval({
        requestId,
        status,
        comments: comments.trim() || undefined,
      });

      toast({
        title: "Success",
        description: `Request ${status} successfully`,
      });

      setComments("");
      onApprovalUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string, isMandatory: boolean) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return isMandatory ? 
          <AlertTriangle className="h-5 w-5 text-orange-500" /> :
          <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  // Get unique approvals by department (keep only the latest approval for each department)
  const uniqueApprovals = approvals.reduce((acc, curr) => {
    const existing = acc.find(a => a.department === curr.department);
    if (!existing || new Date(curr.updatedAt) > new Date(existing.updatedAt)) {
      // Remove existing if found
      if (existing) {
        acc = acc.filter(a => a.department !== curr.department);
      }
      // Add current
      acc.push(curr);
    }
    return acc;
  }, [] as (Approval & { approver: User })[]);

  // Sort approvals: mandatory first, then by status (pending first)
  const sortedApprovals = uniqueApprovals.sort((a, b) => {
    if (a.isMandatory && !b.isMandatory) return -1;
    if (!a.isMandatory && b.isMandatory) return 1;

    // Then sort by status: pending first, then approved, then rejected
    const statusOrder = { pending: 0, approved: 1, rejected: 2 };
    return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
  });


  return (
    <div className="space-y-4">
      <h4 className="font-medium">Approval Flow</h4>
      <div className="space-y-2">
        {sortedApprovals.map((approval) => (
          <Card key={approval.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(approval.status, approval.isMandatory)}
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
                      {approval.approver.username}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge className={getStatusColor(approval.status)}>
                    {approval.status.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {approval.updatedAt &&
                      format(new Date(approval.updatedAt), "PPp")}
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
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApproval("approved")}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => handleApproval("rejected")}
                    disabled={isSubmitting}
                    variant="destructive"
                    className="flex-1"
                  >
                    {isSubmitting ? "Rejecting..." : "Reject"}
                  </Button>
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