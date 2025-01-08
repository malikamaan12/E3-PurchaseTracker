import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ApprovalAction {
  requestId: number;
  status: "approved" | "rejected" | "changes_requested";
  comments?: string;
  departmentId: string;
}

interface ApprovalFlowProps {
  request: {
    id: number;
    status: string;
    requesterId: number;
    title: string;
    approvals?: Array<{
      id: number;
      status: string;
      department: string;
      comments?: string;
      processedAt: string;
      approver: {
        username: string;
      };
    }>;
  };
  onApprovalUpdate?: () => void;
}

export default function ApprovalFlow({
  request,
  onApprovalUpdate
}: ApprovalFlowProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const approvalMutation = useMutation({
    mutationFn: async (data: ApprovalAction) => {
      console.log("Starting approval mutation with data:", data);

      // Validate required fields
      if (!data.requestId || !data.status || !data.departmentId) {
        const error = new Error("Missing required fields");
        console.error("Validation error:", { data, error });
        throw error;
      }

      // Validate department is valid
      if (!requiredDepartments.includes(data.departmentId)) {
        const error = new Error(`Invalid department: ${data.departmentId}`);
        console.error("Department validation error:", error);
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
      setComments("");
      toast({
        title: "Success",
        description: "Approval submitted successfully"
      });
      onApprovalUpdate?.();
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

  const handleApproval = async (status: "approved" | "rejected" | "changes_requested") => {
    if (!user?.department || !user?.id) {
      console.error("Missing user data:", { department: user?.department, id: user?.id });
      toast({
        title: "Error",
        description: "User department information is missing",
        variant: "destructive"
      });
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (!canApprove) {
      console.error("User cannot approve:", { 
        department: user.department,
        isOwnRequest,
        requestStatus: request.status,
        existingApprovals: request.approvals 
      });
      toast({
        title: "Error",
        description: "You don't have permission to approve this request",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Starting approval process:", {
        requestId: request.id,
        status,
        department: user.department
      });

      setIsSubmitting(true);
      await approvalMutation.mutateAsync({
        requestId: request.id,
        status,
        comments: comments.trim() || undefined,
        departmentId: user.department
      });
    } catch (error) {
      console.error("Approval process error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get approval status for each department
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

  console.log("Rendering ApprovalFlow with:", {
    requestId: request.id,
    currentStatus: request.status,
    departmentStatuses,
    canApprove
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Department Approvals</h4>
      </div>

      <div className="grid gap-4">
        {departmentStatuses.map(({ department, status, approver, processedAt, comments }) => (
          <Card key={department} className={cn(
            "transition-colors",
            status === 'approved' ? "border-green-200 bg-green-50" :
            status === 'rejected' ? "border-red-200 bg-red-50" :
            status === 'changes_requested' ? "border-orange-200 bg-orange-50" :
            "border-gray-200"
          )}>
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
                    <Clock className="h-5 w-5 text-blue-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{department}</p>
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    </div>
                    {approver && (
                      <p className="text-sm text-gray-500">Processed by: {approver}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge 
                    className={cn(
                      status === 'approved' ? "bg-green-100 text-green-700 border-green-200" :
                      status === 'rejected' ? "bg-red-100 text-red-700 border-red-200" :
                      status === 'changes_requested' ? "bg-orange-100 text-orange-700 border-orange-200" :
                      "bg-blue-100 text-blue-700 border-blue-200"
                    )}
                  >
                    {status === 'changes_requested' ? 'CHANGES REQUESTED' : status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              {comments && (
                <div className="mt-3 text-sm text-gray-600 bg-white/50 p-3 rounded-md">
                  <p className="font-medium text-xs text-gray-500 mb-1">Comments:</p>
                  {comments}
                </div>
              )}
              {processedAt && (
                <p className="mt-2 text-xs text-gray-500">
                  {format(new Date(processedAt), "PPp")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {canApprove && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <h5 className="font-medium mb-3">Process Request</h5>
              <div className="space-y-4">
                <Textarea
                  placeholder="Add comments (optional)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-white"
                  disabled={isSubmitting}
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleApproval("approved")}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Processing..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => handleApproval("rejected")}
                    disabled={isSubmitting}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Processing..." : "Reject"}
                  </Button>
                  <Button
                    onClick={() => handleApproval("changes_requested")}
                    disabled={isSubmitting}
                    variant="outline"
                    className="border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-200"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
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