import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  Circle, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ArrowRight,
  UserCircle2,
  Clock
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { PurchaseRequestWithRelations } from "@db/schema";
import { cn } from "@/lib/utils";

interface RequestStatusTimelineProps {
  request: PurchaseRequestWithRelations;
}

export default function RequestStatusTimeline({ request }: RequestStatusTimelineProps) {
  // Define all possible statuses and their order
  const statusFlow = [
    { status: 'draft', label: 'Draft', date: request.createdAt },
    { status: 'pending', label: 'Pending Approval', date: request.updatedAt },
    { status: 'changes_requested', label: 'Changes Requested' },
    { status: 'approved', label: 'Approved' },
    { status: 'rejected', label: 'Rejected' }
  ];

  // Find the current status index
  const currentStatusIndex = statusFlow.findIndex(s => s.status === request.status);

  // Calculate progress percentage
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

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

  const getProgressColor = () => {
    switch (request.status) {
      case 'approved':
        return "bg-green-500";
      case 'rejected':
        return "bg-red-500";
      case 'changes_requested':
        return "bg-orange-500";
      case 'pending':
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string, isCurrent: boolean, isPast: boolean) => {
    if (status === 'approved' && isPast) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (status === 'rejected' && isPast) return <XCircle className="h-6 w-6 text-red-500" />;
    if (status === 'changes_requested' && isPast) return <AlertTriangle className="h-6 w-6 text-orange-500" />;
    if (isPast) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (isCurrent) return <Circle className="h-6 w-6 text-blue-500 animate-pulse" />;
    return <Circle className="h-6 w-6 text-gray-300" />;
  };

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-6">Request Timeline</h3>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progressPercentage} className={cn("h-2", getProgressColor())} />
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[27px] top-4 h-[calc(100%-2rem)] w-px bg-gray-200" />

          {/* Status points */}
          <div className="space-y-8">
            {statusFlow.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;

              return (
                <div key={status.status} className="relative">
                  <div className="flex items-start gap-4 group">
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
                          <Badge variant="secondary" className="text-xs animate-fade-in">
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
                      {status.status === 'pending' && request.status === 'pending' && request.approvals && (
                        <div className="mt-4 space-y-3 bg-gray-50 rounded-lg p-4 animate-slide-in">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Pending Approvals</h4>
                          {request.approvals.map(approval => (
                            <div 
                              key={approval.id} 
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-md transition-colors",
                                approval.status === 'pending' ? 'bg-white' : 'bg-gray-50'
                              )}
                            >
                              <div className="flex-shrink-0">
                                {approval.status === 'pending' ? (
                                  <Clock className="h-5 w-5 text-blue-500" />
                                ) : approval.status === 'approved' ? (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">
                                    {approval.department}
                                  </p>
                                  {approval.isMandatory && (
                                    <Badge variant="outline" className="text-xs">
                                      Mandatory
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                                </p>
                                {approval.comments && (
                                  <p className="text-sm text-gray-600 mt-1 italic">
                                    "{approval.comments}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add arrow connector if not last item */}
                  {index < statusFlow.length - 1 && (
                    <div className="absolute left-[27px] top-8 h-8 flex items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-gray-300 rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}