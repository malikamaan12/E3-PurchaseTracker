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
import { Pencil, Trash2, AlertTriangle, Clock, Flag, FileDown, FileIcon, Eye, FileText } from "lucide-react";
import { useLocation } from "wouter";
import ApprovalFlow from "@/components/ApprovalFlow";
import RequestStatusTimeline from "./RequestStatusTimeline";
import { mandatoryDepartments, type PurchaseRequestWithRelations, type MandatoryDepartment } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import FilePreviewCarousel from "@/components/FilePreviewCarousel";
import { generateRequestPDF } from "@/lib/pdfGenerator";
import { defaultBranding, type TemplateConfig } from '@/lib/pdfTemplates';

interface RequestCardProps {
  request: PurchaseRequestWithRelations;
  showActions?: boolean;
  showApproval?: boolean;
  compact?: boolean;
}

export default function RequestCard({
  request,
  showActions,
  showApproval,
  compact = false,
}: RequestCardProps) {
  const { user } = useUser();
  const { updateRequest, createApproval, deleteRequest } = usePurchaseRequests();
  const [comments, setComments] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
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

  const freightAmount = Number(request.freightAmount) || 0;
  const items = request.items?.map(item => ({
    name: String(item.name || ""),
    quantity: Number(item.quantity || 1),
    estimatedCost: Number(item.estimatedCost || 0)
  })) || [];

  const itemsTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedCost,
    0
  );

  const totalCost = itemsTotal + freightAmount;

  const handleApproval = async (status: "approved" | "rejected" | "changes_requested") => {
    if (!user?.department) return;

    try {
      await createApproval({
        requestId: request.id,
        approverId: user.id,
        department: user.department as MandatoryDepartment,
        status,
        comments,
        isMandatory: mandatoryDepartments.includes(user.department as MandatoryDepartment)
      });

      if (user.department === "Finance" && status === "approved") {
        await updateRequest({
          id: request.id,
          data: { isLocked: true, status: "approved" }
        });
      } else if (status === "changes_requested") {
        await updateRequest({
          id: request.id,
          data: { status: "changes_requested", isLocked: false }
        });
      } else if (status === "rejected") {
        await updateRequest({
          id: request.id,
          data: { status: "rejected" }
        });
      }
    } catch (error) {
      console.error("Error handling approval:", error);
      throw error;
    }
  };

  const handleEdit = () => {
    const canEdit =
      !request.isLocked &&
      (request.status === "draft" || request.status === "changes_requested") &&
      request.requesterId === user?.id;

    if (canEdit) {
      setLocation(`/requests/${request.id}/edit`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (attachmentId: number) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
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
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const isPreviewable = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  const handleDownloadPDF = () => {
    try {
      // Example custom branding (this could be loaded from settings/database)
      const customBranding = {
        ...defaultBranding,
        name: 'Your Company Name', // This should come from settings
        headerStyle: 'modern' as const,
        footerText: 'Confidential - For Internal Use Only',
      };

      const templateConfig: TemplateConfig = {
        branding: customBranding,
        layout: 'bento',
        showLogo: false, // Set to true when logo is available
        headerHeight: 30,
        footerHeight: 20,
      };

      const doc = generateRequestPDF(request, templateConfig);
      doc.save(`${request.requestNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{request.title}</h3>
                <Badge className={getStatusColor(request.status)}>
                  {request.status.toUpperCase().replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {request.requestNumber} - {format(new Date(request.createdAt), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {getPriorityIcon(request.priority)}
                <span className={`text-sm ${getPriorityColor(request.priority)}`}>
                  {request.priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-medium">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl">{request.title}</CardTitle>
          <p className="text-sm text-gray-500">
            Request #{request.requestNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            className={`border-${getPriorityColor(request.priority)}/20 ${getPriorityColor(request.priority)} bg-${getPriorityColor(request.priority).replace('text-', '')}/5`}
          >
            <div className="flex items-center gap-1">
              {getPriorityIcon(request.priority)}
              <span>{request.priority.toUpperCase()}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-sm text-gray-500">
          Created {format(new Date(request.createdAt), "PPp")}
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Description</h4>
          <p className="text-sm text-gray-600">{request.description}</p>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Items</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.estimatedCost)}</TableCell>
                  <TableCell>
                    {formatCurrency(item.quantity * item.estimatedCost)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Items Total
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(itemsTotal)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Freight Amount
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(freightAmount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">
                  Total Estimated Cost
                </TableCell>
                <TableCell className="font-bold">
                  {formatCurrency(totalCost)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Purpose</h4>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {request.purposeType.replace("_", " ")}
              </Badge>
              {request.subPurpose && (
                <Badge variant="outline" className="capitalize">
                  {request.subPurpose.name}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600">{request.purpose}</p>
        </div>

        <RequestStatusTimeline request={request} />

        <ApprovalFlow
          approvals={request.approvals}
          requestId={request.id}
          onApprovalUpdate={() => {}} // Refresh data when approval is updated
        />

        {showApproval && (
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <Textarea
              placeholder="Add comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
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
                className="bg-green-600 hover:bg-green-700"
              >
                Approve
              </Button>
            </div>
          </div>
        )}

        {request.priorityReason && (
          <div className="space-y-2 pt-4 border-t border-gray-100">
            <h4 className="font-medium text-gray-900">Priority Analysis</h4>
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

        {request.attachments && request.attachments.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Attachments</h4>
            <div className="grid gap-2">
              {request.attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#7156a2]/10 hover:border-[#7156a2]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-[#7156a2]" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPreviewable(file.fileType) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                        className="text-[#7156a2] hover:text-[#7156a2]/80 hover:bg-[#7156a2]/10"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file.id)}
                      className="text-[#7156a2] hover:text-[#7156a2]/80 hover:bg-[#7156a2]/10"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* File Preview Carousel */}
            {showPreview && request.attachments && (
              <FilePreviewCarousel
                files={request.attachments.filter(file => isPreviewable(file.fileType))}
                onClose={() => setShowPreview(false)}
              />
            )}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-gray-100">
          {showActions && request.status === "draft" && (
            <div className="flex items-center gap-2">
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
                    className="text-red-600 hover:text-red-700"
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
                    <AlertDialogAction
                      onClick={() => deleteRequest(request.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            className="text-[#7156a2] hover:text-[#7156a2]/80 hover:bg-[#7156a2]/10"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download as PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}