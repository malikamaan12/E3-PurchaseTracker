import { useState, useEffect } from "react";
import { format } from "date-fns";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { DownloadOptions } from "@/components/DownloadOptions";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FileIcon,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  Building2
} from "lucide-react";
import { useLocation } from "wouter";
import ApprovalFlow from "@/components/ApprovalFlow";
import RequestStatusTimeline from "./RequestStatusTimeline";
import { useToast } from "@/hooks/use-toast";
import FilePreviewCarousel from "@/components/FilePreviewCarousel";

import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { FilePreview } from "@/components/FilePreview";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { type UploadedFile } from "@/types";
import { ErrorPredictionDisplay } from "@/components/ErrorPredictionDisplay";
import { analyzePurchaseRequest } from "@/lib/request-analyzer";

interface PurchaseRequestWithRelations {
  id: number;
  requesterId: number;
  requester: {
    id: number;
    username: string;
    department: string;
  };
  approvals: Array<{
    id: number;
    status: string;
    comments?: string;
    department: string;
    approverId: number;
  }>;
  attachments?: Array<{
    id: number;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  }>;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }>;
  requestNumber: string;
  title: string;
  description: string;
  createdAt: string;
  status: string;
  priority: string;
  currency: string;
  freightAmount: number;
  purposeType: string;
  subPurpose?: { name: string };
  // purpose field is now represented by description
  isLocked: boolean;
  priorityReason?: string;
  priorityScore?: number;
  priorityRecommendations?: string[];
  additionalApprovers?: string[]; // Ensure additionalApprovers is defined in the interface
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

export default function RequestCard({
  request,
  showActions = false,
  showApproval = false,
  compact = false,
  showItemDescriptions = false,
}: RequestCardProps) {
  const { user } = useUser();
  const { saveDraft, createApproval, submitRequest, deleteRequest } = usePurchaseRequests();
  const [comments, setComments] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [showRequestChangesDialog, setShowRequestChangesDialog] = useState(false);
  const [changeRequestComments, setChangeRequestComments] = useState("");
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<UploadedFile | null>(null);
  const [analysis, setAnalysis] = useState<{
    warnings: string[];
    suggestions: string[];
  }>({ warnings: [], suggestions: [] });

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getPriorityColor = (priority: string = 'medium') => {
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

  const getPriorityIcon = (priority: string = 'medium') => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return <AlertTriangle className={`h-4 w-4 ${getPriorityColor(priority)}`} />;
      case "high":
        return <Flag className={`h-4 w-4 ${getPriorityColor(priority)}`} />;
      default:
        return <Clock className={`h-4 w-4 ${getPriorityColor(priority)}`} />;
    }
  };

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

  const handleDownload = async (attachmentId: number) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'download';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `File "${filename}" downloaded successfully`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download file",
        variant: "destructive"
      });
    }
  };

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
        title: "Request Submitted",
        description: "Your request has been submitted for approval",
        variant: "default"
      });
    } catch (error) {
      console.error("Error submitting draft:", error);
      toast({
        title: "Submission Failed",
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
      toast({
        description: "Editing request...",
        variant: "default"
      });
    } else {
      toast({
        title: "Cannot Edit Request",
        description: request.isLocked ?
          "This request is locked and cannot be edited" :
          "You don't have permission to edit this request",
        variant: "destructive",
      });
    }
  };

  // Removed direct PDF download function to prevent React hooks issues
  // We'll use the DownloadOptions component instead which is properly implemented
  // and avoids the React hooks violations

  const handleApproval = async (status: "approved" | "rejected" | "changes_requested") => {
    if (!user?.department) {
      toast({
        title: "Error",
        description: "User department information is missing",
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

      toast({
        description: `Processing ${status.replace('_', ' ')} action...`,
        variant: "default"
      });

      await createApproval({
        requestId: request.id,
        status,
        comments: commentsToUse,
        department: user.department
      });

      setComments("");
      setChangeRequestComments("");
      setShowRequestChangesDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });

      const statusMessages = {
        approved: "Request approved successfully",
        rejected: "Request rejected successfully",
        changes_requested: "Changes requested successfully"
      };

      toast({
        title: "Success",
        description: statusMessages[status],
        variant: "default"
      });
    } catch (error) {
      console.error('Error in handleApproval:', error);
      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : `Failed to ${status.replace('_', ' ')} request`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (requestId: number) => {
    try {
      toast({
        description: "Deleting request...",
        variant: "default"
      });

      await deleteRequest(requestId);

      toast({
        title: "Success",
        description: "Request deleted successfully",
        variant: "default"
      });

      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
    } catch (error) {
      console.error("Error deleting request:", error);
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete request",
        variant: "destructive",
      });
    }
  };

  const isPreviewable = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const renderAttachments = () => {
    if (!request.attachments || request.attachments.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-300">
          <FileIcon className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-300" />
          <p>No documents attached to this request</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {request.attachments.map((file) => (
            <div
              key={file.id}
              className="relative group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-colors dark:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                <FileIcon className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPreviewFile({
                      fileName: file.fileName,
                      fileSize: file.fileSize,
                      fileType: file.fileType,
                      fileUrl: `/api/attachments/${file.id}`
                    })}
                    className="text-gray-600 dark:text-white hover:text-primary dark:hover:text-primary"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file.id)}
                    className="text-gray-600 dark:text-white hover:text-primary dark:hover:text-primary"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    const analyzeRequest = async () => {
      if (request) {
        const result = await analyzePurchaseRequest(request);
        setAnalysis({
          warnings: result.warnings || [],
          suggestions: result.suggestions || []
        });
      }
    };
    analyzeRequest();
  }, [request]);

  if (compact) {
    const canSubmitDraft = request.status === "draft" &&
      request.requesterId === user?.id &&
      request.title &&
      request.description &&
      request.items?.length > 0;

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
                    {request.title}
                  </h3>
                  <Badge className={getStatusColor(request.status)}>
                    {request.status.toUpperCase().replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {request.requestNumber} - {format(new Date(request.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-wrap justify-end">
                <div className="flex items-center gap-1">
                  {getPriorityIcon(request.priority || 'medium')}
                  <span className={`text-sm ${getPriorityColor(request.priority || 'medium')}`}>
                    {(request.priority || 'medium').toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-medium">{formatCurrency(totalCost)}</p>
                {canSubmitDraft && (
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
      <Card className="hover:shadow-md transition-shadow overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl dark:text-white">{request.title}</CardTitle>
            <p className="text-sm text-gray-500 dark:text-white">
              Request #{request.requestNumber}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge className={getStatusColor(request.status)}>
              {request.status.toUpperCase().replace("_", " ")}
            </Badge>
            {request.isLocked && (
              <Badge variant="outline" className="border-orange-500/20 text-orange-600 bg-orange-50">
                LOCKED
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`border-${getPriorityColor(request.priority || 'medium')}/20 ${getPriorityColor(request.priority || 'medium')} bg-${getPriorityColor(request.priority || 'medium').replace('text-', '')}/5`}
            >
              <div className="flex items-center gap-1">
                {getPriorityIcon(request.priority || 'medium')}
                <span>{(request.priority || 'medium').toUpperCase()}</span>
              </div>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="items">
                Items
                {request.items && request.items.length > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                    {request.items.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="documents">
                Documents
                {request.attachments && request.attachments.length > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                    {request.attachments.length}
                  </span>
                )}
              </TabsTrigger>
              {request.priorityReason && (
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">Description</h4>
                  <p className="text-sm text-gray-600 dark:text-white whitespace-pre-wrap">{request.description}</p>
                </div>

                <div className="space-y-6">
                  {/* Requester Information */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Requester Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Name</p>
                        <p className="text-sm font-medium dark:text-white">{request.requester?.username || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Department</p>
                        <p className="text-sm font-medium dark:text-white">{request.requester?.department || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Purpose Information */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Purpose Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Purpose Type</p>
                        <p className="text-sm font-medium dark:text-white capitalize">{(request.purposeType || 'general').replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Sub-Purpose</p>
                        <p className="text-sm font-medium dark:text-white">{request.subPurpose?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-white">Description</p>
                      <p className="text-sm text-gray-600 dark:text-white whitespace-pre-wrap mt-1 bg-white dark:bg-gray-700 p-2 rounded border border-gray-100 dark:border-gray-600">{request.description || 'No description provided'}</p>
                    </div>
                  </div>
                  
                  {/* Vendor Information */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Vendor Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Name</p>
                        <p className="text-sm font-medium dark:text-white">{request.vendor?.name || request.vendor?.vendorName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Category</p>
                        <p className="text-sm font-medium dark:text-white">{request.vendor?.category || request.vendor?.vendorCategory || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Contact Person</p>
                        <p className="text-sm font-medium dark:text-white">{request.vendor?.contactPerson || request.vendor?.contact || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-white">Email</p>
                        <p className="text-sm font-medium dark:text-white">{request.vendor?.email || request.vendor?.contactEmail || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <RequestStatusTimeline request={request} />
                </div>

                {/* Approval Flow is handled in the parent component */}

                {analysis.warnings.length > 0 || analysis.suggestions.length > 0 ? (
                  <div className="mt-6">
                    <ErrorPredictionDisplay
                      context="Purchase Request"
                      warnings={analysis.warnings}
                      suggestions={analysis.suggestions}
                    />
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="items" className="focus:outline-none">
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4">Item</TableHead>
                        {showItemDescriptions && <TableHead className="w-2/5">Description</TableHead>}
                        <TableHead className="w-1/6">Quantity</TableHead>
                        <TableHead className="w-1/6">Unit Cost</TableHead>
                        <TableHead className="w-1/6">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          {showItemDescriptions && (
                            <TableCell>
                              {item.description ? (
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-md">
                                  <p className="text-sm text-gray-600 dark:text-white whitespace-pre-wrap">
                                    {item.description}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-300 italic">No description provided</p>
                              )}
                            </TableCell>
                          )}
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.estimatedCost)}</TableCell>
                          <TableCell>
                            {formatCurrency(item.quantity * item.estimatedCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={showItemDescriptions ? 4 : 3} className="text-right font-medium dark:text-white">
                          Items Total
                        </TableCell>
                        <TableCell className="font-medium dark:text-white">
                          {formatCurrency(itemsTotal)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={showItemDescriptions ? 4 : 3} className="text-right font-medium dark:text-white">
                          Freight Amount
                        </TableCell>
                        <TableCell className="font-medium dark:text-white">
                          {formatCurrency(freightAmount)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={showItemDescriptions ? 4 : 3} className="text-right font-bold dark:text-white">
                          Total Estimated Cost
                        </TableCell>
                        <TableCell className="font-bold dark:text-white">
                          {formatCurrency(totalCost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="focus:outline-none">
              {renderAttachments()}
            </TabsContent>

            {request.priorityReason && (
              <TabsContent value="analysis">
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">Priority Analysis</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(request.priority || 'medium')}
                      <p className="text-sm dark:text-white">
                        Priority Score: <span className="font-medium dark:text-white">{request.priorityScore}/100</span>
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white">{request.priorityReason}</p>
                    {request.priorityRecommendations && request.priorityRecommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1 dark:text-white">Recommendations:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-white">
                          {request.priorityRecommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>

          {showApproval && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-medium dark:text-white">Approval Actions</h3>
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="comments" className="text-sm font-medium dark:text-white">
                    Comments
                  </label>
                  <Textarea
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add any comments about your decision..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Dialog open={showRequestChangesDialog} onOpenChange={setShowRequestChangesDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="bg-orange-50 text-orange-600 hover:bg-orange-100">
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
                      <div className="py-4">
                        <Textarea
                          value={changeRequestComments}
                          onChange={(e) => setChangeRequestComments(e.target.value)}
                          placeholder="Describe the changes needed..."
                          className="min-h-[150px]"
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          variant="ghost"
                          onClick={() => setShowRequestChangesDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleApproval("changes_requested")}
                          className="bg-orange-600 hover:bg-orange-700"
                          disabled={!changeRequestComments.trim()}
                        >
                          Submit Change Request
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    className="bg-red-50 text-red-600 hover:bg-red-100"
                    onClick={() => handleApproval("rejected")}
                  >
                    Reject
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApproval("approved")}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showActions && (
            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="bg-red-50 text-red-600 hover:bg-red-100">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the
                      purchase request "{request.title}" and all its data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(request.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Using DownloadOptions component instead of direct PDF button to avoid React hooks violations */}
              <DownloadOptions request={request} />

              <Button
                onClick={handleEdit}
                className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white"
                disabled={!(!request.isLocked && (request.status === "draft" || request.status === "changes_requested") && request.requesterId === user?.id)}
              >
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Preview Dialog */}
      {selectedPreviewFile && (
        <FilePreviewDialog
          file={selectedPreviewFile}
          isOpen={!!selectedPreviewFile}
          onClose={() => setSelectedPreviewFile(null)}
        />
      )}
    </motion.div>
  );
}