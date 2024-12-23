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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
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
  const { updateRequest, createApproval, deleteRequest } = usePurchaseRequests();
  const [comments, setComments] = useState("");
  const [, setLocation] = useLocation();

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

  const handleEdit = () => {
    setLocation(`/requests/${request.id}/edit`);
  };

  const handleDelete = async () => {
    await deleteRequest(request.id);
  };

  // Convert string values to numbers for calculations
  const freightAmount = Number(request.freightAmount) || 0;
  const items = request.items.map(item => ({
    ...item,
    quantity: Number(item.quantity),
    estimatedCost: Number(item.estimatedCost)
  }));

  const itemsTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedCost,
    0
  );

  const totalCost = itemsTotal + freightAmount;

  // Check if the request can be edited/deleted (only if it's in draft or pending state)
  const canModify = ["draft", "pending"].includes(request.status) && 
                   request.requesterId === user?.id;

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
          {canModify && (
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handleEdit}
                title="Edit Request"
              >
                <Pencil className="h-4 w-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive"
                    title="Delete Request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Purchase Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this purchase request? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
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
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.estimatedCost.toFixed(2)}</TableCell>
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
                    ${itemsTotal.toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Freight Amount
                  </TableCell>
                  <TableCell className="font-medium">
                    ${freightAmount.toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">
                    Total Estimated Cost
                  </TableCell>
                  <TableCell className="font-bold">
                    ${totalCost.toFixed(2)}
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