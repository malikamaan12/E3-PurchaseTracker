import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  Flag,
  FileDown,
  Eye,
  ChevronDown,
  ChevronUp,
  Building2
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface PurchaseRequestItem {
  name: string;
  quantity: number;
  estimatedCost: number;
  description?: string;
}

interface PurchaseRequestWithRelations {
  id: number;
  requesterId: number;
  requester?: {
    id: number;
    username: string;
    department: string;
  };
  approvals?: Array<{
    id: number;
    status: string;
    comments?: string;
    department: string;
    approverId: number;
    processedAt?: string;
    approver?: {
      username: string;
    };
  }>;
  attachments?: Array<{
    id: number;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  }>;
  items: PurchaseRequestItem[];
  requestNumber?: string;
  title?: string;
  description?: string;
  createdAt: string;
  status: string;
  priority?: string;
  currency?: string;
  freightAmount?: number;
  purposeType?: string;
  subPurpose?: { name: string };
  purpose?: string;
  isLocked?: boolean;
  priorityReason?: string;
  priorityScore?: number;
  priorityRecommendations?: string[];
  vendor?: {
    name?: string;
    vendorName?: string;
    category?: string;
    vendorCategory?: string;
    contactPerson?: string;
    contact?: string;
    email?: string;
    contactEmail?: string;
    phone?: string;
    contactPhone?: string;
  };
}

interface RequestCardProps {
  request: PurchaseRequestWithRelations;
  showActions?: boolean;
  showApproval?: boolean;
  compact?: boolean;
  showItemDescriptions?: boolean;
}

const getPriorityColor = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "text-red-600";
    case "high":
      return "text-orange-600";
    case "medium":
      return "text-yellow-600";
    case "low":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
};

const getPriorityIcon = (priority?: string) => {
  const colorClass = getPriorityColor(priority);
  switch (priority?.toLowerCase()) {
    case "urgent":
      return <AlertTriangle className={`h-4 w-4 ${colorClass}`} />;
    case "high":
      return <Flag className={`h-4 w-4 ${colorClass}`} />;
    default:
      return <Clock className={`h-4 w-4 ${colorClass}`} />;
  }
};

const getStatusColor = (status: string = 'draft') => {
  switch (status.toLowerCase()) {
    case "draft":
      return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    case "pending":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "approved":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    case "changes_requested":
      return "bg-orange-500/10 text-orange-700 border-orange-500/20";
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  }
};

export default function RequestCard({
  request,
  showActions = false,
  showApproval = false,
  compact = false,
  showItemDescriptions = false,
}: RequestCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { submitRequest, deleteRequest, processApproval } = usePurchaseRequests();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [, setLocation] = useLocation();
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [showRequestChangesDialog, setShowRequestChangesDialog] = useState(false);
  const [changeRequestComments, setChangeRequestComments] = useState("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: request.currency || 'QAR'
    }).format(amount);
  };

  const freightAmount = request.freightAmount || 0;
  const items = request.items || [];

  const itemsTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedCost,
    0
  );

  const totalCost = itemsTotal + freightAmount;

  const handleDraftSubmit = async () => {
    try {
      if (!request.id) {
        throw new Error("Request ID is required");
      }

      await submitRequest({
        ...request,
        status: "pending",
      });

      toast({
        title: "Success",
        description: "Request submitted for approval",
      });
    } catch (error) {
      console.error("Error submitting draft:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request",
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    const canEdit =
      !request.isLocked &&
      (request.status === "draft" || request.status === "changes_requested") &&
      request.requesterId === user?.id;

    if (canEdit) {
      setLocation(`/requests/${request.id}/edit`);
    } else {
      toast({
        title: "Cannot edit request",
        description: "You don't have permission to edit this request or it is locked",
        variant: "destructive",
      });
    }
  };

  const handleApproval = async (status: "approved" | "rejected" | "changes_requested") => {
    if (!user?.department) {
      toast({
        title: "Error",
        description: "User department is required for approval",
        variant: "destructive",
      });
      return;
    }

    if (!request.id) {
      toast({
        title: "Error",
        description: "Invalid request ID",
        variant: "destructive",
      });
      return;
    }

    try {
      const commentsToUse = status === "changes_requested" ? changeRequestComments : comments;

      await processApproval({
        requestId: request.id,
        status,
        comments: commentsToUse,
        departmentId: user.department
      });

      setComments("");
      setChangeRequestComments("");
      setShowRequestChangesDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });

      toast({
        title: "Success",
        description: status === "changes_requested"
          ? "Changes requested successfully"
          : `Request ${status} successfully`,
      });
    } catch (error) {
      console.error('Error in handleApproval:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process approval",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      if (!request.id) {
        throw new Error("Request ID is required");
      }

      await deleteRequest(request.id);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });

      toast({
        title: "Success",
        description: "Request deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting request:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete request",
        variant: "destructive",
      });
    }
  };

  const vendorSection = request.vendor && (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          Vendor Information
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowVendorDetails(!showVendorDetails)}
          className="text-gray-500"
        >
          {showVendorDetails ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      <AnimatePresence>
        {showVendorDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">Name:</span>{" "}
                    {request.vendor.name || request.vendor.vendorName || 'N/A'}
                  </p>
                  <p className="text-sm mt-2">
                    <span className="font-medium">Category:</span>{" "}
                    {request.vendor.category || request.vendor.vendorCategory || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-medium">Contact Person:</span>{" "}
                    {request.vendor.contactPerson || request.vendor.contact || 'N/A'}
                  </p>
                  <p className="text-sm mt-2">
                    <span className="font-medium">Email:</span>{" "}
                    {request.vendor.email || request.vendor.contactEmail || 'N/A'}
                  </p>
                  <p className="text-sm mt-2">
                    <span className="font-medium">Phone:</span>{" "}
                    {request.vendor.phone || request.vendor.contactPhone || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate max-w-[200px] sm:max-w-none">
                    {request.title || 'Untitled Request'}
                  </h3>
                  <Badge className={getStatusColor(request.status)}>
                    {(request.status || 'draft').toUpperCase().replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {request.requestNumber || 'No Number'} - {format(new Date(request.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-wrap justify-end">
                <div className="flex items-center gap-1">
                  {getPriorityIcon(request.priority)}
                  <span className={`text-sm ${getPriorityColor(request.priority)}`}>
                    {(request.priority || 'medium').toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-medium">{formatCurrency(totalCost)}</p>
                {request.status === "draft" && request.requesterId === user?.id && (
                  <Button
                    size="sm"
                    onClick={handleDraftSubmit}
                    className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white"
                  >
                    Submit
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-medium truncate max-w-[200px] sm:max-w-none">
                {request.title || 'Untitled Request'}
              </h3>
              <Badge className={getStatusColor(request.status)}>
                {(request.status || 'draft').toUpperCase().replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              <div className="flex items-center gap-1">
                {getPriorityIcon(request.priority)}
                <span className={`text-sm ${getPriorityColor(request.priority)}`}>
                  {(request.priority || 'medium').toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-medium">{formatCurrency(totalCost)}</p>
              {request.status === "draft" && request.requesterId === user?.id && (
                <Button
                  size="sm"
                  onClick={handleDraftSubmit}
                  className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white"
                >
                  Submit
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {request.description || 'No description provided'}
            </p>
          </div>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  {showItemDescriptions && <TableHead>Description</TableHead>}
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    {showItemDescriptions && (
                      <TableCell>{item.description || 'No description'}</TableCell>
                    )}
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatCurrency(item.estimatedCost)}</TableCell>
                    <TableCell>{formatCurrency(item.quantity * item.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={showItemDescriptions ? 4 : 3} className="text-right font-medium">
                    Total
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(totalCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {vendorSection}

          {showActions && (
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                disabled={request.status !== "draft" && request.status !== "changes_requested"}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this request? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {showApproval && (
            <div className="mt-4 space-y-4">
              <h4 className="font-medium">Process Approval</h4>
              <div className="space-y-4">
                <Textarea
                  placeholder="Add comments..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Dialog open={showRequestChangesDialog} onOpenChange={setShowRequestChangesDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="text-orange-600">
                        Request Changes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Request Changes</DialogTitle>
                        <DialogDescription>
                          Specify what changes are needed for this request.
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={changeRequestComments}
                        onChange={(e) => setChangeRequestComments(e.target.value)}
                        placeholder="Describe the needed changes..."
                      />
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowRequestChangesDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleApproval("changes_requested")}
                          className="bg-orange-600"
                          disabled={!changeRequestComments.trim()}
                        >
                          Submit Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleApproval("rejected")}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApproval("approved")}
                    className="bg-green-600"
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}