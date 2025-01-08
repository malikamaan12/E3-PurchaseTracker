import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Circle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileEdit
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  status: string;
  timestamp: string;
  actor?: string;
  comments?: string;
}

interface RequestTimelineProps {
  request: {
    id: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    events?: TimelineEvent[];
    requesterId: number;
    requester?: {
      username: string;
    };
    approvals?: Array<{
      status: string;
      department: string;
      processedAt: string | null;
    }>;
  };
}

export default function RequestTimeline({ request }: RequestTimelineProps) {
  // Check if all required departments have approved
  const requiredDepartments = ['CEO Office', 'Finance', 'Director'];
  const allDepartmentsApproved = requiredDepartments.every(dept => 
    request.approvals?.some(approval => 
      approval.department === dept && approval.status === 'approved'
    )
  );

  // Update the request status based on approvals
  const effectiveStatus = allDepartmentsApproved ? 'approved' : request.status;

  // Define all possible statuses and their order
  const statusFlow = [
    { 
      status: 'draft', 
      label: 'Draft Created', 
      date: request.createdAt,
      icon: FileEdit,
      color: 'text-gray-500'
    },
    { 
      status: 'pending', 
      label: 'Submitted for Approval', 
      date: request.status === 'draft' ? null : request.updatedAt,
      icon: Clock,
      color: 'text-blue-500'
    },
    { 
      status: 'changes_requested', 
      label: 'Changes Requested', 
      date: effectiveStatus === 'changes_requested' ? request.updatedAt : null,
      icon: AlertTriangle,
      color: 'text-orange-500'
    },
    { 
      status: 'approved', 
      label: 'Approved', 
      date: effectiveStatus === 'approved' ? request.updatedAt : null,
      icon: CheckCircle2,
      color: 'text-green-500'
    },
    { 
      status: 'rejected', 
      label: 'Rejected', 
      date: effectiveStatus === 'rejected' ? request.updatedAt : null,
      icon: XCircle,
      color: 'text-red-500'
    }
  ];

  // Find the current status index based on effective status
  const currentStatusIndex = statusFlow.findIndex(s => s.status === effectiveStatus);

  // Calculate progress percentage
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  return (
    <Card className="animate-in fade-in-50 duration-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Request Timeline</h3>
          <Badge variant="outline" className={cn(
            "text-sm",
            effectiveStatus === 'approved' ? "border-green-200 bg-green-50 text-green-700" :
            effectiveStatus === 'rejected' ? "border-red-200 bg-red-50 text-red-700" :
            effectiveStatus === 'changes_requested' ? "border-orange-200 bg-orange-50 text-orange-700" :
            effectiveStatus === 'pending' ? "border-blue-200 bg-blue-50 text-blue-700" :
            "border-gray-200 bg-gray-50 text-gray-700"
          )}>
            {effectiveStatus.toUpperCase().replace('_', ' ')}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress 
            value={progressPercentage} 
            className={cn(
              "h-2",
              effectiveStatus === 'approved' ? "bg-green-500" :
              effectiveStatus === 'rejected' ? "bg-red-500" :
              effectiveStatus === 'changes_requested' ? "bg-orange-500" :
              "bg-blue-500"
            )} 
          />
        </div>

        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[27px] top-4 h-[calc(100%-2rem)] w-px bg-gray-200" />

          {/* Timeline events */}
          <div className="space-y-8">
            {statusFlow.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const Icon = status.icon;

              return (
                <div key={status.status} className="relative">
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className="relative z-10">
                      {isCurrent ? (
                        <div className="animate-pulse">
                          <Icon className={cn("h-6 w-6", status.color)} />
                        </div>
                      ) : isPast ? (
                        <Icon className={cn("h-6 w-6", status.color)} />
                      ) : (
                        <Circle className="h-6 w-6 text-gray-300" />
                      )}
                    </div>

                    {/* Status content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
                          isCurrent ? status.color :
                          isPast ? "text-gray-700" :
                          "text-gray-400"
                        )}>
                          {status.label}
                        </p>
                        {isCurrent && (
                          <Badge className="text-xs animate-in fade-in-50 duration-300">
                            Current
                          </Badge>
                        )}
                      </div>
                      {status.date && (
                        <p className="text-sm text-gray-500 mt-1">
                          {format(new Date(status.date), "PPp")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Connector arrow */}
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