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
  Clock,
  PencilLine
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { PurchaseRequestWithRelations, Approval } from "@db/schema";
import { cn } from "@/lib/utils";

interface RequestStatusTimelineProps {
  request: PurchaseRequestWithRelations;
}

export default function RequestStatusTimeline({ request }: RequestStatusTimelineProps) {
  // Define all possible statuses and their order
  const statusFlow = [
    { status: 'draft', label: 'Draft', date: request.createdAt },
    { status: 'pending', label: 'Pending Approval', date: request.updatedAt },
    { status: 'changes_requested', label: 'Changes Requested', date: request.statusChangedAt },
    { status: 'approved', label: 'Approved' },
    { status: 'rejected', label: 'Rejected' }
  ];

  // Find the current status index
  const currentStatusIndex = statusFlow.findIndex(s => s.status === request.status);

  // Calculate progress percentage
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  // Find the most recent change request comment and details
  const getChangeRequestDetails = () => {
    if (!request.approvals) return null;

    // Sort approvals by date in descending order and find the most recent changes_requested
    const changeRequest = [...request.approvals]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .find(a => a.status === 'changes_requested');

    if (!changeRequest) return null;

    return {
      comments: changeRequest.comments,
      department: changeRequest.department,
      updatedAt: changeRequest.updatedAt,
      requester: changeRequest.requester
    };
  };

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-6">Request Timeline</h3>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress 
            value={progressPercentage} 
            className={cn("h-2", request.status === 'changes_requested' ? "bg-orange-500" : "bg-gray-500")} 
          />
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[27px] top-4 h-[calc(100%-2rem)] w-px bg-gray-200" />

          {/* Status points */}
          <div className="space-y-8">
            {statusFlow.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const changeRequestDetails = status.status === 'changes_requested' ? getChangeRequestDetails() : null;

              return (
                <div key={status.status} className="relative">
                  <div className="flex items-start gap-4 group">
                    {/* Status icon */}
                    <div className="relative z-10">
                      {status.status === 'changes_requested' && (isCurrent || isPast) ? (
                        <PencilLine className="h-6 w-6 text-orange-500" />
                      ) : status.status === 'approved' && (isCurrent || isPast) ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : status.status === 'rejected' && (isCurrent || isPast) ? (
                        <XCircle className="h-6 w-6 text-red-500" />
                      ) : isPast ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : isCurrent ? (
                        <Circle className="h-6 w-6 text-blue-500 animate-pulse" />
                      ) : (
                        <Circle className="h-6 w-6 text-gray-300" />
                      )}
                    </div>

                    {/* Status content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
                          isCurrent && status.status === 'changes_requested' ? "text-orange-600" :
                          isCurrent ? "text-blue-600" :
                          isPast ? "text-gray-600" : "text-gray-400"
                        )}>
                          {status.label}
                        </p>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs animate-fade-in">
                            Current
                          </Badge>
                        )}
                      </div>

                      {/* Show change request details */}
                      {status.status === 'changes_requested' && isCurrent && changeRequestDetails && (
                        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm text-orange-700 font-medium">
                                Changes Requested by {changeRequestDetails.department}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">
                                {format(new Date(changeRequestDetails.updatedAt), "PPp")}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-orange-600 mt-2">{changeRequestDetails.comments}</p>
                        </div>
                      )}

                      {/* Show pending approvals */}
                      {status.status === 'pending' && request.status === 'pending' && request.approvals && (
                        <div className="mt-4 space-y-3 bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Pending Approvals</h4>
                          {request.approvals
                            .filter(approval => approval.status === 'pending' || approval.status === 'approved')
                            .map((approval: Approval & { approver?: User }) => (
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
                                  ) : (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
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