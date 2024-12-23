import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Approval } from "@db/schema";

interface ApprovalFlowProps {
  approvals: Approval[];
}

export default function ApprovalFlow({ approvals }: ApprovalFlowProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
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

  return (
    <div className="space-y-2">
      <h4 className="font-medium">Approval Flow</h4>
      <div className="space-y-2">
        {approvals.map((approval) => (
          <Card key={approval.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(approval.status)}
                  <div>
                    <p className="font-medium">{approval.department}</p>
                    <p className="text-sm text-gray-500">
                      {approval.approver?.username}
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
                <p className="mt-2 text-sm text-gray-600">
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
