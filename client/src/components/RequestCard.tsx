import { useState } from "react";
import { format } from "date-fns";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import ApprovalFlow from "./ApprovalFlow";
import type { PurchaseRequest } from "@db/schema";

interface RequestCardProps {
  request: PurchaseRequest;
  showActions?: boolean;
  showApproval?: boolean;
}

export default function RequestCard({
  request,
  showActions,
  showApproval,
}: RequestCardProps) {
  const { user } = useUser();
  const { updateRequest, createApproval } = usePurchaseRequests();
  const [comments, setComments] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-500";
      case "pending":
        return "bg-yellow-500";
      case "approved":
        return "bg-green-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const handleApproval = async (status: "approved" | "rejected") => {
    if (!user) return;

    await createApproval({
      requestId: request.id,
      approverId: user.id,
      department: user.department,
      status,
      comments,
    });

    // Update request status if all required departments have approved
    const allApproved =
      request.approvals.every((a) => a.status === "approved") &&
      ["CEO Office", "Finance", "Director"].includes(user.department);

    if (allApproved) {
      await updateRequest({
        id: request.id,
        data: { status: "approved" },
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">{request.title}</CardTitle>
          <div className="text-sm text-gray-500 mt-1">
            Request #{request.requestNumber}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getPriorityColor(request.priority)}>
            {request.priority.toUpperCase()}
          </Badge>
          <Badge className={getStatusColor(request.status)}>
            {request.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="text-sm text-gray-500">
            Created {format(new Date(request.createdAt), "PPp")}
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Description</h4>
            <p className="text-sm text-gray-600">{request.description}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Items</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.estimatedCost}</TableCell>
                    <TableCell>
                      ${(item.quantity * item.estimatedCost).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Items Total
                  </TableCell>
                  <TableCell className="font-medium">
                    ${request.items.reduce((sum, item) => sum + item.quantity * item.estimatedCost, 0).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Freight Amount
                  </TableCell>
                  <TableCell className="font-medium">
                    ${(request.freightAmount || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">
                    Total Estimated Cost
                  </TableCell>
                  <TableCell className="font-bold">
                    ${request.totalEstimatedCost.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Vendor</h4>
            <p className="text-sm text-gray-600">{request.vendor}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Purpose</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {request.purposeType.replace("_", " ").toUpperCase()}
                </Badge>
                {request.subPurpose && (
                  <Badge variant="outline">
                    {request.subPurpose.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">{request.purpose}</p>
            </div>
          </div>

          <ApprovalFlow approvals={request.approvals} />

          {showApproval && (
            <div className="space-y-4">
              <Textarea
                placeholder="Add comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  variant="destructive"
                  onClick={() => handleApproval("rejected")}
                >
                  Reject
                </Button>
                <Button onClick={() => handleApproval("approved")}>
                  Approve
                </Button>
              </div>
            </div>
          )}

          {showActions && (
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() =>
                  updateRequest({
                    id: request.id,
                    data: { status: "pending" },
                  })
                }
              >
                Submit for Approval
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}