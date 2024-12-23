import { useState } from "react";
import { format } from "date-fns";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, AlertTriangle, Clock, Flag } from "lucide-react";
import { useLocation } from "wouter";
import ApprovalFlow from "./ApprovalFlow";
import RequestStatusTimeline from "./RequestStatusTimeline";
import { mandatoryDepartments } from "@db/schema";
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
      case "changes_requested":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  // Function to automatically create mandatory approvals
  const createMandatoryApprovals = async () => {
    try {
      for (const department of mandatoryDepartments) {
        await createApproval({
          requestId: request.id,
          department,
          approverId: user!.id,
          isMandatory: true,
          status: "pending"
        });
      }
    } catch (error) {
      console.error("Error creating mandatory approvals:", error);
      throw error;
    }
  };

  const handleApproval = async (status: "approved" | "rejected" | "changes_requested") => {
    if (!user) return;

    try {
      // Create the approval record
      await createApproval({
        requestId: request.id,
        approverId: user.id,
        department: user.department,
        status,
        comments,
        isMandatory: mandatoryDepartments.includes(user.department)
      });

      // Special handling for Finance department approval
      if (user.department === "Finance" && status === "approved") {
        // When Finance approves, lock the request
        await updateRequest({
          id: request.id,
          data: {
            isLocked: true,
            status: "approved"
          },
        });
      } else if (status === "changes_requested") {
        // If changes are requested, update the request status
        await updateRequest({
          id: request.id,
          data: {
            status: "changes_requested",
            isLocked: false // Unlock for changes
          },
        });
      } else if (status === "rejected") {
        await updateRequest({
          id: request.id,
          data: { status: "rejected" },
        });
      }
    } catch (error) {
      console.error("Error handling approval:", error);
      throw error;
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      await updateRequest({
        id: request.id,
        data: { status: "pending" },
      });
      await createMandatoryApprovals();
    } catch (error) {
      console.error("Error submitting for approval:", error);
      throw error;
    }
  };

  const handleEdit = () => {
    // Allow edits only if:
    // 1. Request is not locked (not approved by Finance)
    // 2. Request is in draft state
    // 3. Request is in changes_requested state
    // 4. User is the requester
    const canEdit =
      !request.isLocked &&
      (request.status === "draft" || request.status === "changes_requested") &&
      request.requesterId === user?.id;

    if (canEdit) {
      setLocation(`/requests/${request.id}/edit`);
    }
  };

  const handleDelete = async () => {
    // Allow deletion only if:
    // 1. Request is not locked
    // 2. Request is in draft state
    // 3. User is the requester
    const canDelete =
      !request.isLocked &&
      request.status === "draft" &&
      request.requesterId === user?.id;

    if (canDelete) {
      await deleteRequest(request.id);
    }
  };

  // Check if the request can be modified
  const canModify =
    !request.isLocked &&
    (request.status === "draft" || request.status === "changes_requested") &&
    request.requesterId === user?.id;

  // Check if the current user can approve
  const canApprove =
    !request.isLocked &&
    request.status === "pending" &&
    user?.department &&
    !request.approvals.some(a =>
      a.department === user.department &&
      ["approved", "rejected"].includes(a.status)
    );

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-500";
      case "high":
        return "text-orange-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertTriangle className={`h-5 w-5 ${getPriorityColor(priority)}`} />;
      case "high":
        return <Flag className={`h-5 w-5 ${getPriorityColor(priority)}`} />;
      default:
        return <Clock className={`h-5 w-5 ${getPriorityColor(priority)}`} />;
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
          <Badge className={getStatusColor(request.status)}>
            {request.status.toUpperCase().replace("_", " ")}
          </Badge>
          {request.isLocked && (
            <Badge variant="outline" className="border-orange-500 text-orange-500">
              LOCKED
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`border-${getPriorityColor(request.priority)} ${getPriorityColor(request.priority)}`}
          >
            <div className="flex items-center gap-1">
              {getPriorityIcon(request.priority)}
              <span>{request.priority.toUpperCase()}</span>
            </div>
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

              {request.status === "draft" && (
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
              )}
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

          <RequestStatusTimeline request={request} />

          <ApprovalFlow
            approvals={request.approvals}
            requestId={request.id}
            onApprovalUpdate={() => {}} // Refresh data when approval is updated
          />

          {showApproval && canApprove && (
            <div className="space-y-4 mt-4">
              <Textarea
                placeholder="Add comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleApproval("changes_requested")}
                >
                  Request Changes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleApproval("rejected")}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleApproval("approved")}
                >
                  Approve
                </Button>
              </div>
            </div>
          )}

          {request.priorityReason && (
            <div className="space-y-2">
              <h4 className="font-medium">Priority Analysis</h4>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  {getPriorityIcon(request.priority)}
                  <p className="text-sm">
                    Priority Score: <span className="font-medium">{request.priorityScore}/100</span>
                  </p>
                </div>
                <p className="text-sm text-gray-600">{request.priorityReason}</p>
                {request.priorityRecommendations && request.priorityRecommendations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">Recommendations:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {request.priorityRecommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {showActions && request.status === "draft" && (
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={handleSubmitForApproval}
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