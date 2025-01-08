import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  type PurchaseRequest
} from "@db/schema";

interface ApprovalFlowProps {
  request: PurchaseRequest;
  onApprovalUpdate?: () => void;
}

export default function ApprovalFlow({
  request,
  onApprovalUpdate
}: ApprovalFlowProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Department Approvals</h4>
      </div>
      <p className="text-sm text-gray-500">Approval flow implementation removed</p>
    </div>
  );
}