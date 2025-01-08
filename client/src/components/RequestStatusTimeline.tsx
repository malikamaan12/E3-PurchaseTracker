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
    { status: 'changes_requested', label: 'Changes Requested', date: request.updatedAt },
    { status: 'approved', label: 'Approved', date: request.updatedAt },
    { status: 'rejected', label: 'Rejected', date: request.updatedAt }
  ];

  // Find the current status index
  const currentStatusIndex = statusFlow.findIndex(s => s.status === request.status);

  // Calculate progress percentage based on actual status
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  // Get all required departments for approval
  const getRequiredDepartments = () => {
    const mandatoryDepartments = ['CEO Office', 'Finance', 'Director'];
    const additionalDepartments = request.additionalApprovers || [];
    return [...new Set([...mandatoryDepartments, ...additionalDepartments])];
  };

  // Get approval status for each department
  const getDepartmentApprovalStatus = (department: string) => {
    if (!request.approvals) return { status: 'pending', approval: null };

    const approval = request.approvals.find(a => a.department === department);
    return {
      status: approval?.status || 'pending',
      approval
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
            className={cn(
              "h-2",
              request.status === 'changes_requested' ? "bg-orange-500" :
              request.status === 'approved' ? "bg-green-500" :
              request.status === 'rejected' ? "bg-red-500" :
              "bg-blue-500"
            )} 
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
                          isCurrent && status.status === 'approved' ? "text-green-600" :
                          isCurrent && status.status === 'rejected' ? "text-red-600" :
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

                      {/* Show pending approvals section */}
                      {status.status === 'pending' && request.status === 'pending' && (
                        <div className="mt-4 space-y-3 bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Pending Approvals</h4>
                          {getRequiredDepartments().map(department => {
                            const { status: approvalStatus, approval } = getDepartmentApprovalStatus(department);
                            const isMandatory = ['CEO Office', 'Finance', 'Director'].includes(department);

                            return (
                              <div 
                                key={department} 
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-md transition-colors",
                                  approvalStatus === 'pending' ? 'bg-white' : 
                                  approvalStatus === 'approved' ? 'bg-green-50' :
                                  approvalStatus === 'rejected' ? 'bg-red-50' :
                                  'bg-orange-50'
                                )}
                              >
                                <div className="flex-shrink-0">
                                  {approvalStatus === 'pending' ? (
                                    <Clock className="h-5 w-5 text-blue-500" />
                                  ) : approvalStatus === 'approved' ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  ) : approvalStatus === 'rejected' ? (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  ) : (
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">
                                      {department}
                                    </p>
                                    {isMandatory && (
                                      <Badge variant="outline" className="text-xs">
                                        Mandatory
                                      </Badge>
                                    )}
                                  </div>
                                  <p className={cn(
                                    "text-sm",
                                    approvalStatus === 'approved' ? "text-green-600" :
                                    approvalStatus === 'rejected' ? "text-red-600" :
                                    approvalStatus === 'changes_requested' ? "text-orange-600" :
                                    "text-gray-500"
                                  )}>
                                    {approvalStatus.toUpperCase()}
                                    {approval?.approver?.username && ` by ${approval.approver.username}`}
                                  </p>
                                  {approval?.processedAt && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(approval.processedAt), "PPp")}
                                    </p>
                                  )}
                                  {approval?.comments && (
                                    <p className="text-sm text-gray-600 mt-1 italic">
                                      "{approval.comments}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
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