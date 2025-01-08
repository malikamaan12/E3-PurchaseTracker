import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Circle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Clock
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { PurchaseRequest } from "@db/schema";
import { cn } from "@/lib/utils";

interface RequestStatusTimelineProps {
  request: PurchaseRequest;
}

export default function RequestStatusTimeline({ request }: RequestStatusTimelineProps) {
  // Define all possible statuses and their order
  const statusFlow = [
    { status: 'draft', label: 'Draft', date: request.createdAt },
    { status: 'pending', label: 'Pending', date: request.updatedAt },
    { status: 'approved', label: 'Approved', date: request.updatedAt },
    { status: 'rejected', label: 'Rejected', date: request.updatedAt }
  ];

  // Find the current status index
  const currentStatusIndex = statusFlow.findIndex(s => s.status === request.status);

  // Calculate progress percentage based on actual status
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

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
              request.status === 'approved' ? "bg-green-500" :
              request.status === 'rejected' ? "bg-red-500" :
              "bg-blue-500"
            )} 
          />
        </div>

        <div className="relative">
          <div className="absolute left-[27px] top-4 h-[calc(100%-2rem)] w-px bg-gray-200" />
          <div className="space-y-8">
            {statusFlow.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;

              return (
                <div key={status.status} className="relative">
                  <div className="flex items-start gap-4">
                    <div className="relative z-10">
                      {status.status === 'approved' && (isCurrent || isPast) ? (
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

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
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
                    </div>
                  </div>

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