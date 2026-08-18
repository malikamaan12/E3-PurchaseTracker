"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, Download, CheckCircle2, XCircle, Clock, FileText, 
  User, Building2, CreditCard, History, FileBadge, MessageSquare,
  AlertTriangle, RotateCcw, Loader2, ShieldCheck, Calendar, Lock, Edit3, Trash2, Landmark, Coins, CircleDashed,
  Maximize2, ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import CreateRequestModal from "@/components/requests/CreateRequestModal";
import { DeleteRequestDialog } from "@/components/requests/DeleteRequestDialog";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { FinanceLedger } from "@/components/requests/FinanceLedger";
import { LoadingState } from "@/components/shared/LoadingState";
import { ExportDropdown } from "@/components/requests/ExportDropdown";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAdmin, isApprover } = useAuth();
  const requestId = parseInt(params.id as string);
  const [activeAttachment, setActiveAttachment] = useState<any>(null);
  const [approvalComments, setApprovalComments] = useState("");
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfirmAction, setShowConfirmAction] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    status: "approved" | "rejected" | "changes_requested";
    title: string;
    desc: string;
  } | null>(null);

  const { data: request, isLoading, error: queryError } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => apiClient.requests.get(requestId),
    retry: 1,
  });

  usePageTitle(request?.requestNumber ? `${request.requestNumber} - ${request.title}` : `Request #${requestId}`);

  const approvalMutation = useMutation({
    mutationFn: ({ status, comments }: { status: string; comments: string }) =>
      apiClient.requests.submitApproval(requestId, { status, comments }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      toast.success(data.message || "Action submitted successfully");
      setApprovalComments("");
      setShowActionPanel(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit action"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.requests.delete(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request deleted successfully");
      router.push("/dashboard/requests");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete request"),
  });

  if (isLoading) return <LoadingState />;
  if (queryError || !request) return <ErrorState error={queryError} />;

  const myDeptApproval = request.approvals?.find(
    (a: any) => {
      const aDept = a.department?.toLowerCase().trim() || "";
      const uDept = user?.department?.toLowerCase().trim() || "";
      return aDept === uDept || aDept.includes(uDept) || uDept.includes(aDept);
    }
  );
  const canAct =
    (request.status === "pending" || request.status === "partially_approved" || request.status === "VARIATION_PENDING") &&
    (isAdmin || (isApprover && myDeptApproval && myDeptApproval.status === "pending"));

  const isFinanceOrAdmin = isAdmin || user?.department?.toLowerCase() === "finance";

  const handleApprovalAction = (status: "approved" | "rejected" | "changes_requested") => {
    if ((status === "rejected" || status === "changes_requested") && !approvalComments.trim()) {
      toast.error("Comments are required when rejecting or requesting changes.");
      return;
    }

    const titles = {
      approved: "Confirm Request Approval",
      rejected: "Reject Purchase Request",
      changes_requested: "Request Modifications"
    };

    const descs = {
      approved: "Are you sure you want to approve this request? This action will move it to the next stage of the procurement workflow.",
      rejected: "Warning: Rejecting this request will terminate the procurement cycle for these items.",
      changes_requested: "The requester will be notified to update the documentation based on your comments below."
    };

    setConfirmData({
      status,
      title: titles[status],
      desc: descs[status]
    });
    setShowConfirmAction(true);
  };

  const executeApprovalAction = () => {
    if (!confirmData) return;
    approvalMutation.mutate({ 
      status: confirmData.status, 
      comments: approvalComments 
    });
    setShowConfirmAction(false);
  };

  const installments = Array.isArray(request.paymentInstallments) ? request.paymentInstallments : [];

  return (
    <div className="flex flex-col bg-background/95 min-h-screen text-foreground selection:bg-primary/20">
      <ConfirmActionDialog 
        isOpen={showConfirmAction}
        onClose={() => setShowConfirmAction(false)}
        onConfirm={executeApprovalAction}
        title={confirmData?.title || ""}
        description={confirmData?.desc || ""}
        type={confirmData?.status === 'approved' ? 'approve' : confirmData?.status === 'rejected' ? 'reject' : 'changes'}
        comments={approvalComments}
        isPending={approvalMutation.isPending}
      />

      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30 px-4 sm:px-6 py-3 sm:py-4 transition-all">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full md:w-auto">
            <button 
              onClick={() => router.back()}
              aria-label="Navigate back"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center flex-wrap gap-2 min-w-0 flex-1">
              <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 shrink-0">
                {request.requestNumber}
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight line-clamp-2 md:truncate text-foreground max-w-full md:max-w-md">{request.title}</h1>
              <StatusBadge status={request.status} />
            </div>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
            <ExportDropdown 
              requestId={requestId} 
              requestNumber={request.requestNumber} 
            />

            {((isAdmin && !['fully_paid', 'archived'].includes(request.status)) || 
              (request.requesterId === user?.id && (
                request.status === 'draft' || 
                request.status === 'changes_requested' || 
                (request.status === 'pending' && (request.approvals?.filter((a: any) => a.status === 'approved').length || 0) === 0)
              ))) ? (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowEditModal(true)}
                  aria-label="Edit Request"
                  className="min-h-[40px] gap-2 rounded-xl px-4 border-border/50 hover:bg-muted/50 shadow-sm transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setShowDeleteDialog(true)}
                  aria-label="Delete Request"
                  className="min-h-[40px] gap-2 rounded-xl px-4 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-xl text-muted-foreground text-xs font-semibold border border-border/50 shadow-sm" title="Locked from edits">
                <Lock className="w-3.5 h-3.5" /> Locked
              </div>
            )}

            {canAct && (
              <Button 
                onClick={() => setShowActionPanel(prev => !prev)}
                aria-label={showActionPanel ? "Close Review" : "Review Request"}
                className="min-h-[40px] gap-2 bg-primary text-primary-foreground rounded-xl px-5 shadow-sm hover:shadow-md transition-all font-semibold"
                size="sm"
              >
                <ShieldCheck className="w-4 h-4" />
                {showActionPanel ? "Close Review" : "Review Request"}
              </Button>
            )}
          </div>
        </div>

        {showActionPanel && canAct && (
          <div className="max-w-[1400px] mx-auto mt-4 animate-fade-scale-in">
            <div className="bg-card/80 backdrop-blur-md border border-primary/20 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold tracking-tight">Reviewing as <span className="text-primary">{user?.department}</span></span>
                </div>

                <textarea
                  value={approvalComments}
                  onChange={e => setApprovalComments(e.target.value)}
                  placeholder="Provide your feedback or requirements (required for rejections or change requests)..."
                  rows={3}
                  className="w-full bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none shadow-inner"
                />

                <div className="flex items-center gap-3 justify-end">
                  <Button variant="outline" size="sm" className="rounded-full hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 transition-all" onClick={() => handleApprovalAction("changes_requested")} disabled={approvalMutation.isPending}>
                    <RotateCcw className="w-3.5 h-3.5 mr-2" /> Request Changes
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all" onClick={() => handleApprovalAction("rejected")} disabled={approvalMutation.isPending}>
                    <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                  </Button>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 shadow-sm hover:shadow-md transition-all" onClick={() => handleApprovalAction("approved")} disabled={approvalMutation.isPending}>
                    {approvalMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Approve Request
                  </Button>
                </div>
            </div>
          </div>
        )}
      </header>

      {(request.status === "changes_requested" || request.status === "draft") && (request.requesterId === user?.id || isAdmin) && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between text-amber-700 dark:text-amber-500 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4" />
              {request.status === "draft" 
                ? "This request is a draft. It has not been submitted for approval yet."
                : "Changes have been requested. Please review the comments, update the details, and re-submit."}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} className="bg-background/50 border-amber-500/30 hover:bg-amber-500/20 rounded-full">
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-lg">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight">Request Details</h2>
              </div>
              <PriorityBadge priority={request.priority} />
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                    Description
                  </h3>
                  <p className="text-sm leading-relaxed text-foreground/90">{request.description}</p>
                </div>
                {request.priorityReason && (
                   <div className="bg-muted/50 p-4 rounded-xl border border-border/30">
                     <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Priority Justification</h3>
                     <p className="text-sm italic text-foreground/80">{request.priorityReason}</p>
                   </div>
                )}
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <InfoItem label="Requester" value={request.requester?.username} icon={<User className="w-3.5 h-3.5" />} />
                  <InfoItem label="Department" value={request.requester?.department} icon={<Building2 className="w-3.5 h-3.5" />} />
                  <InfoItem label="Purpose" value={request.subPurpose?.name} />
                  <InfoItem label="Date" value={format(new Date(request.createdAt), "MMM dd, yyyy")} icon={<Calendar className="w-3.5 h-3.5" />} />
                </div>
                <div className="border-t border-border/50 pt-5">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Vendor Information</h3>
                  <div className="space-y-1.5 bg-muted/20 p-4 rounded-xl border border-border/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-foreground">{request.vendor?.companyName}</p>
                      {request.vendor?.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded uppercase font-bold border border-amber-500/20 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Pending Approval
                          </span>
                          {isAdmin && (
                            <Button 
                              size="sm" 
                              className="h-6 text-[10px] px-2 rounded-full" 
                              onClick={() => {
                                apiClient.vendors.patchStatus(request.vendor?.id, "active")
                                  .then(() => {
                                    toast.success("Vendor approved successfully.");
                                    queryClient.invalidateQueries({ queryKey: ["request", requestId] });
                                  })
                                  .catch((err) => toast.error(err.message || "Failed to approve vendor"));
                              }}
                            >
                              Approve Vendor
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3 h-3" /> {request.vendor?.contactPerson} • {request.vendor?.email}
                    </p>
                    {request.vendor?.contactNumber && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{request.vendor?.contactNumber}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/10 p-1.5 rounded-lg">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight">Financial Summary</h2>
              </div>
              <span className="text-xs font-mono font-bold bg-muted/80 text-muted-foreground px-2.5 py-1 rounded-md border border-border/50">{request.currency || "QAR"}</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Subtotal</p>
                  <p className="text-xl font-mono font-medium">{(request.totalEstimatedCost || 0).toLocaleString()}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Freight / Tax</p>
                  <p className="text-xl font-mono font-medium">{(request.freightAmount || 0).toLocaleString()}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Cycle</p>
                  <p className="text-sm font-semibold capitalize mt-1 text-foreground/80 bg-muted/50 w-max px-2.5 py-1 rounded-md border border-border/30">
                    {request.paymentStructure?.replace(/_/g, ' ').toLowerCase() || "Standard"}
                  </p>
                </div>
                <div className="space-y-1.5 md:border-l border-border/50 md:pl-6 bg-primary/5 -m-4 p-4 rounded-xl md:m-0 md:rounded-none md:bg-transparent">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Total Authorization</p>
                  <p className="text-3xl font-mono font-bold text-primary tracking-tight">
                    {((request.totalEstimatedCost || 0) + (request.freightAmount || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Milestones Display for Requester/Approvers */}
          {installments.length > 0 && (
            <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex items-center gap-2">
                <div className="bg-blue-500/10 p-1.5 rounded-lg">
                  <Coins className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight">Payment Milestones</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installments.map((milestone: any, idx: number) => {
                  const isPaid = milestone.status === 'paid' || milestone.status === 'settled_savings';
                  const isPartial = milestone.status === 'partial';
                  
                  return (
                    <div key={milestone.id || idx} className="bg-background border border-border/50 rounded-xl p-4 shadow-sm hover:border-primary/30 transition-all flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-semibold text-sm">{milestone.installmentName}</div>
                        {isPaid ? (
                          <span className="bg-emerald-500/10 text-emerald-600 p-1 rounded-md" title="Paid">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : isPartial ? (
                          <span className="bg-amber-500/10 text-amber-600 p-1 rounded-md" title="Partially Paid">
                            <CircleDashed className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="bg-muted p-1 rounded-md text-muted-foreground" title="Pending">
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 mt-auto">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Due Date:</span>
                          <span className="font-medium">{new Date(milestone.dueDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-mono font-bold text-sm bg-muted/50 px-2 py-0.5 rounded border border-border/30">
                            {Number(milestone.calculatedAmount || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground">{request.currency || 'QAR'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-purple-500/10 p-1.5 rounded-lg">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight">Line Items</h2>
              </div>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" className="h-8 text-xs rounded-full border-border/50 hover:bg-muted/50" onClick={() => {
                   if (!Array.isArray(request.items)) return toast.error("No items to export");
                   const rows = ['Item,Qty,Price,Total'];
                   request.items.forEach((i: any) => rows.push(`"${i.name}","${i.quantity}","${i.estimatedCost}","${i.quantity*i.estimatedCost}"`));
                   const url = window.URL.createObjectURL(new Blob([rows.join('\\n')], { type: 'text/csv' }));
                   const a = document.createElement('a'); a.href = url; a.download = `items-${request.id}.csv`; a.click(); window.URL.revokeObjectURL(url);
                 }}>
                    <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
                 </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 border-b border-border/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-center font-semibold uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right font-semibold uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-right font-semibold uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                   {Array.isArray(request.items) ? request.items.map((item: any, idx: number) => (
                     <tr key={idx} className="hover:bg-muted/10 transition-colors">
                       <td className="px-6 py-4">
                         <div className="font-medium text-foreground">{item.name || "Unnamed Item"}</div>
                         {item.remarks && <div className="text-xs text-muted-foreground mt-1">{item.remarks}</div>}
                       </td>
                       <td className="px-6 py-4 text-center font-medium bg-muted/5 w-16">{item.quantity || 0}</td>
                       <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                         {Number(item.estimatedCost || 0).toLocaleString()}
                       </td>
                       <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                         {((item.quantity || 0) * (item.estimatedCost || 0)).toLocaleString()}
                       </td>
                     </tr>
                   )) : (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">No line items specified</td></tr>
                   )}
                 </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-[450px]">
              <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-500/10 p-1.5 rounded-lg">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="font-semibold text-sm tracking-tight">Attached Documents</h2>
                </div>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-muted/5">
                {Array.isArray(request.attachments) && request.attachments.length > 0 ? (
                  request.attachments.map((file: any) => (
                    <button 
                      key={file.id} 
                      onClick={() => setActiveAttachment(file)}
                      className={`w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all duration-200 text-left ${
                        activeAttachment?.id === file.id 
                          ? 'bg-indigo-500/10 border-indigo-500/30 shadow-sm ring-1 ring-indigo-500/20' 
                          : 'bg-background hover:bg-muted/50 border-border/50 hover:border-border'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${activeAttachment?.id === file.id ? 'bg-indigo-500/20' : 'bg-muted'}`}>
                        <FileText className={`w-4 h-4 shrink-0 ${activeAttachment?.id === file.id ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${activeAttachment?.id === file.id ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>{file.fileName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{(file.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-60">
                    <FileBadge className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">No documents attached.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-[450px]">
              <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
                <h2 className="font-semibold text-sm tracking-tight">Document Preview</h2>
                {activeAttachment && (
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-all"
                      onClick={() => setIsPreviewModalOpen(true)}
                      title="Expand Preview (Fullscreen)"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Expand
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-all"
                      onClick={() => window.open(`/api/attachments/${activeAttachment.id}`, '_blank')}
                      title="Popout preview in new window"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Popout
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-black/5 dark:bg-white/5 relative">
                 {activeAttachment ? (
                   <iframe src={`/api/attachments/${activeAttachment.id}`} className="absolute inset-0 w-full h-full border-none bg-transparent" title="Preview" />
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <div className="bg-background border border-border/50 shadow-sm rounded-full p-4 mb-4">
                        <FileBadge className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">Select a document to preview</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
          
          {isFinanceOrAdmin && (
             <div className="pt-8">
                <FinanceLedger request={request} />
             </div>
          )}

        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-8">
          <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden sticky top-24">
            <div className="p-5 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/10 p-1.5 rounded-lg">
                  <History className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight">Procurement Timeline</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted" onClick={() => setShowAuditModal(true)} title="View Audit Trail">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-6">
              <div className="relative border-l-2 border-muted ml-3 space-y-8 pb-4">
                <TimelineItem 
                  title="Request Initiated"
                  desc={`By ${request.requester?.username}`}
                  time={format(new Date(request.createdAt), "MMM dd, yyyy")}
                  status="completed"
                />
                
                {(() => {
                  const getDeptWeight = (deptName: string) => {
                    const name = (deptName || "").toLowerCase().trim();
                    if (name.includes("management")) return 2;
                    if (name.includes("finance")) return 3;
                    if (name.includes("ceo")) return 4;
                    return 1; // Additional approvers (e.g. IT, Legal, Marketing, Operations)
                  };

                  const sortedApprovals = Array.isArray(request.approvals)
                    ? [...request.approvals].sort((a: any, b: any) => getDeptWeight(a.department) - getDeptWeight(b.department))
                    : [];

                  return sortedApprovals.map((approval: any) => {
                    const isPending = approval.status === 'pending';
                    const isApproved = approval.status === 'approved';
                    const isRejected = approval.status === 'rejected';
                    
                    return (
                      <TimelineItem 
                        key={approval.id}
                        title={`${approval.department} Approval`}
                        desc={isApproved ? `Approved by ${approval.approver?.username}` : isRejected ? "Rejected" : "Pending Action"}
                        time={approval.processedAt ? format(new Date(approval.processedAt), "MMM dd, yyyy") : undefined}
                        status={isApproved ? 'completed' : isRejected ? 'error' : isPending ? 'current' : 'pending'}
                      />
                    );
                  });
                })()}

                <TimelineItem 
                  title="Final Status"
                  desc={request.status === 'approved' ? "Ready for procurement" : "Awaiting sign-offs"}
                  status={request.status === 'approved' ? 'completed' : 'pending'}
                />
              </div>
            </div>
          </div>
        </div>

      </main>

      <CreateRequestModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        requestId={requestId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["request", requestId] });
          setShowEditModal(false);
          toast.success("Request updated.");
        }}
      />

      <DeleteRequestDialog 
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
        requestNumber={request?.requestNumber}
      />

      {showAuditModal && (
        <AuditTrailModal 
          isOpen={showAuditModal} 
          onClose={() => setShowAuditModal(false)} 
          auditLogs={request.auditLogs || []} 
        />
      )}

      {/* Expanded Document Preview Modal */}
      {isPreviewModalOpen && activeAttachment && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex flex-col p-4 md:p-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-card border border-border/50 px-6 py-4 rounded-2xl mb-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base tracking-tight">{activeAttachment.fileName}</h3>
                <p className="text-xs text-muted-foreground font-mono">{(activeAttachment.fileSize / 1024).toFixed(1)} KB • Fullscreen Preview</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl gap-2 text-xs font-semibold"
                onClick={() => window.open(`/api/attachments/${activeAttachment.id}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" /> Popout to New Tab
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsPreviewModalOpen(false)}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-card border border-border/50 rounded-2xl overflow-hidden relative shadow-2xl">
            <iframe src={`/api/attachments/${activeAttachment.id}`} className="absolute inset-0 w-full h-full border-none bg-transparent" title="Expanded Document Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const configs: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20 shadow-sm",
    medium: "bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-sm",
    low: "bg-muted text-muted-foreground border-border/50",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold border ${configs[priority] || configs.medium}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: "bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-sm",
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm",
    rejected: "bg-destructive/10 text-destructive border-destructive/20 shadow-sm",
    draft: "bg-muted text-muted-foreground border-border/50 shadow-sm",
    changes_requested: "bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${configs[status] || configs.draft} uppercase tracking-wider`}>
      {typeof status === 'string' ? status.replace(/_/g, ' ') : 'N/A'}
    </span>
  );
}

function TimelineItem({ title, desc, time, status }: { title: string, desc: string, time?: string, status: string }) {
  const configs = {
    completed: "bg-emerald-500 border-emerald-200 dark:border-emerald-900 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]",
    error: "bg-destructive border-red-200 dark:border-red-900 shadow-[0_0_0_4px_rgba(239,68,68,0.1)]",
    current: "bg-primary border-primary/20 shadow-[0_0_0_4px_rgba(59,130,246,0.2)] animate-pulse",
    pending: "bg-background border-border shadow-none",
  };
  const config = configs[status as keyof typeof configs] || configs.pending;

  return (
    <div className="relative pl-7">
      <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${config} z-10 transition-all`} />
      <div className="flex justify-between items-start group">
        <div>
          <p className={`text-sm font-bold tracking-tight ${status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
        {time && <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-muted-foreground/70">{time}</span>}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error?: any }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[60vh] text-center bg-background">
      <div className="bg-destructive/10 p-6 rounded-full mb-6 border border-destructive/20 shadow-sm">
        <XCircle className="w-16 h-16 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Access Denied or Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-md">{error?.message || "The record you're trying to access does not exist or you lack sufficient permissions."}</p>
      <Button variant="outline" className="rounded-full px-8 border-border/50 shadow-sm" onClick={() => window.location.href = "/dashboard/requests"}>Return to Request Hub</Button>
    </div>
  );
}

function AuditTrailModal({ isOpen, onClose, auditLogs }: { isOpen: boolean, onClose: () => void, auditLogs: any[] }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/50 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border/50 flex justify-between items-center bg-gradient-to-r from-muted/50 to-transparent rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <History className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-bold tracking-tight">System Audit Trail</h2>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={onClose}>
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-muted/5">
          {(!auditLogs || auditLogs.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
               <History className="w-12 h-12 mb-3" />
               <p className="text-center text-sm font-medium">No activity recorded</p>
            </div>
          ) : (
            auditLogs.map((log, i) => (
              <div key={i} className="bg-background border border-border/50 shadow-sm rounded-xl p-4 text-sm hover:border-primary/30 transition-colors">
                <div className="flex justify-between font-bold tracking-tight mb-2">
                  <span className="capitalize">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground font-mono font-medium bg-muted px-2 py-0.5 rounded">{format(new Date(log.timestamp), "MMM dd, yyyy HH:mm")}</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Initiated by <span className="font-medium text-foreground">{log.details?.processedBy || "System"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
