import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { Approval, User, mandatoryDepartments } from "@db/schema";

interface ApprovalFlowProps {
  approvals: (Approval & { approver: User })[];
}

export default function ApprovalFlow({ approvals }: ApprovalFlowProps) {
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

  // Sort approvals to show mandatory approvers first
  const sortedApprovals = [...approvals].sort((a, b) => {
    if (a.isMandatory && !b.isMandatory) return -1;
    if (!a.isMandatory && b.isMandatory) return 1;
    return 0;
  });

  return (
    <div className="space-y-2">
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
        {approvals.length === 0 && (
          <p className="text-sm text-gray-500">No approvals yet</p>
        )}
      </div>
    </div>
  );
}