import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Circle, CheckCircle, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import type { PurchaseRequest } from "@db/schema";

interface RequestStatusTimelineProps {
  request: PurchaseRequest;
}

export default function RequestStatusTimeline({ request }: RequestStatusTimelineProps) {
  // Define all possible statuses and their order
  const statusFlow = [
    { status: 'draft', label: 'Draft', date: request.createdAt },
    { status: 'pending', label: 'Pending Approval', date: request.updatedAt },
    { status: 'approved', label: 'Approved' },
    { status: 'rejected', label: 'Rejected' },
    { status: 'changes_requested', label: 'Changes Requested' }
  ];

  // Find the current status index
  const currentStatusIndex = statusFlow.findIndex(s => s.status === request.status);

  const getStatusIcon = (status: string, isCurrent: boolean, isPast: boolean) => {
    if (status === 'approved' && isPast) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (status === 'rejected' && isPast) return <XCircle className="h-6 w-6 text-red-500" />;
    if (status === 'changes_requested' && isPast) return <AlertTriangle className="h-6 w-6 text-orange-500" />;
    if (isPast) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (isCurrent) return <Circle className="h-6 w-6 text-blue-500 animate-pulse" />;
    return <Circle className="h-6 w-6 text-gray-300" />;
  };

  const getStatusColor = (status: string, isCurrent: boolean, isPast: boolean) => {
    if (!isPast && !isCurrent) return "text-gray-400";
    switch (status) {
      case 'approved':
        return "text-green-500";
      case 'rejected':
        return "text-red-500";
      case 'changes_requested':
        return "text-orange-500";
      case 'pending':
        return "text-blue-500";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-6">Request Timeline</h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[27px] top-4 h-[calc(100%-2rem)] w-px bg-gray-200" />
          
          {/* Status points */}
          <div className="space-y-8">
            {statusFlow.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;

              return (
                <div key={status.status} className="relative flex items-start gap-4 group">
                  {/* Status icon */}
                  <div className="relative z-10 flex-shrink-0">
                    {getStatusIcon(status.status, isCurrent, isPast)}
                  </div>
                  
                  {/* Status content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${getStatusColor(status.status, isCurrent, isPast)}`}>
                        {status.label}
                      </p>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    {status.date && (
                      <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(status.date), "PPp")}
                      </p>
                    )}
                    {/* Show approval details if status is pending */}
                    {status.status === 'pending' && request.status === 'pending' && (
                      <div className="mt-2 space-y-1">
                        {request.approvals.map(approval => (
                          <div key={approval.id} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">
                              {approval.department}
                            </Badge>
                            <span className="text-gray-500">
                              {approval.status === 'pending' ? 'Awaiting approval' : approval.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
