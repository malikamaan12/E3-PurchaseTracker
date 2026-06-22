"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  User, 
  Building2, 
  CreditCard,
  History,
  FileBadge,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ShieldCheck,
  Calendar,
  Archive,
  Lock
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import CreateRequestModal from "@/components/requests/CreateRequestModal";
import { DeleteRequestDialog } from "@/components/requests/DeleteRequestDialog";
import { Edit3, Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { FinanceLedger } from "@/components/requests/FinanceLedger";
import { LoadingState } from "@/components/shared/LoadingState";
import { ExportDropdown } from "@/components/requests/ExportDropdown";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

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
  const [confirmData, setConfirmData] = useState<{
    status: "approved" | "rejected" | "changes_requested";
    title: string;
    desc: string;
  } | null>(null);

  const { data: request, isLoading, error: queryError } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => apiClient.requests.get(requestId),
    retry: 1, // Minimize retry spam for 404/401/403
  });

  // The new approval state machine endpoint
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

  // Check if the current user's dept has a pending approval record for this request
  const myDeptApproval = request.approvals?.find(
    (a: any) => a.department?.toLowerCase().trim() === user?.department?.toLowerCase().trim()
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

  return (
    <div className="flex flex-col bg-background min-h-screen transition-colors duration-300">
      {/* Confirmation Dialog (Global Scope) */}
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

      {/* Sticky Action Bar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono font-bold text-brand-primary bg-brand-primary/10 px-2.5 py-1 rounded-md border border-brand-primary/20">
                {request.requestNumber}
              </span>
              <h1 className="text-xl font-serif text-foreground truncate max-w-[200px] md:max-w-md">{request.title}</h1>
              <StatusBadge status={request.status} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <ExportDropdown 
              requestId={requestId} 
              requestNumber={request.requestNumber} 
            />

            {/* EDIT & DELETE (Condition: Admin bypass or Owner early-stage) */}
            {(isAdmin && !['fully_paid', 'archived'].includes(request.status)) || 
             (request.requesterId === user?.id && (
               request.status === 'draft' || 
               request.status === 'changes_requested' || 
               (request.status === 'pending' && (request.approvals?.filter((a: any) => a.status === 'approved').length || 0) === 0)
             )) ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-2 bg-secondary/30 border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all font-semibold text-xs"
                  title="Edit Request"
                >
                  <Edit3 className="w-4 h-4 text-brand-primary" /> Edit
                </button>
                <button 
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 transition-all font-semibold text-xs"
                  title="Delete Request"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-secondary/20 px-3 py-1.5 rounded-lg border border-border/50 opacity-60 cursor-help" title="Approvals have already begun. To make changes, contact an Administrator.">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Locked</span>
              </div>
            )}

            {/* Approver Action Button */}
            {canAct && (
              <button 
                onClick={() => setShowActionPanel(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  showActionPanel
                    ? "bg-white/10 border border-white/20 text-white"
                    : "bg-brand-primary text-white shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {showActionPanel ? "Close" : "Review"}
              </button>
            )}
          </div>
        </div>

        {/* Approver Action Panel — slides in below header */}
        {showActionPanel && canAct && (
          <div
            key="action-panel"
            className="max-w-[1600px] mx-auto mt-4 overflow-hidden animate-fade-scale-in"
          >
            <div className="bg-card/80 backdrop-blur-lg border border-border rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-brand-primary" />
                  <span className="text-sm font-bold text-foreground">Departmental Review</span>
                  <span className="text-[10px] text-muted-foreground ml-2 font-bold uppercase tracking-widest">
                    Acting as: {user?.department}
                  </span>
                </div>

                <textarea
                  value={approvalComments}
                  onChange={e => setApprovalComments(e.target.value)}
                  placeholder="Comments (required for rejection or change requests)..."
                  rows={3}
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
                />

                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => handleApprovalAction("changes_requested")}
                    disabled={approvalMutation.isPending}
                    className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg hover:bg-amber-500/20 transition-all font-bold text-xs disabled:opacity-50 active-scale"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Request Changes
                  </button>
                  <button
                    onClick={() => handleApprovalAction("rejected")}
                    disabled={approvalMutation.isPending}
                    className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-lg hover:bg-rose-500/20 transition-all font-bold text-xs disabled:opacity-50 active-scale"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovalAction("approved")}
                    disabled={approvalMutation.isPending}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/20 transition-all font-bold text-xs disabled:opacity-50 active-scale"
                  >
                    {approvalMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                </div>
            </div>
          </div>
        )}
      </header>

      {/* "Changes Requested" or "Draft" Banner (Visible to Owner & Admins) */}
      {(request.status === "changes_requested" || request.status === "draft") && (request.requesterId === user?.id || isAdmin) && (
        <div className={request.status === "draft" ? "bg-zinc-500/10 border-b border-zinc-500/20 px-6 py-4" : "bg-amber-500/10 border-b border-amber-500/20 px-6 py-4"}>
          <div className={`max-w-[1600px] mx-auto flex items-center justify-between gap-3 ${request.status === "draft" ? "text-zinc-400" : "text-amber-400"}`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">
                {request.status === "draft" 
                  ? "This request is currently a draft. Please edit and submit to initialize the workflow."
                  : "An approver has requested changes. Update this request and re-submit it for approval."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {request.status === "draft" && (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
              <button
                 onClick={() => setShowEditModal(true)}
                 className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg ${
                   request.status === "draft"
                     ? "bg-zinc-200 text-black hover:bg-white"
                     : "bg-amber-500 text-black hover:bg-amber-400"
                 }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {request.status === "draft" ? "Continue Editing" : "Edit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Density Grid */}
      <div className="flex-1 p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Detail Content (Left Columns) */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Main Header Card */}
          <div className="glass-card overflow-hidden animate-slide-up">
            <div className="p-1 px-4 bg-foreground/2 px-4 bg-secondary/30 border-b border-border flex justify-between items-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">General Information</span>
              <div className="flex gap-2">
                 <PriorityBadge priority={request.priority} />
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <h2 className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1">Description</h2>
                  <p className="text-foreground text-sm leading-relaxed">{request.description}</p>
                </div>
                
                {request.priorityReason && (
                   <div className="bg-secondary/50 p-3 rounded-xl border border-border">
                     <h3 className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Priority Justification</h3>
                     <p className="text-xs text-foreground italic">"{request.priorityReason}"</p>
                   </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <InfoItem icon={<User className="w-4 h-4" />} label="Requester" value={request.requester?.username} />
                <InfoItem icon={<Building2 className="w-4 h-4" />} label="Department" value={request.requester?.department} />
                <InfoItem icon={<Clock className="w-4 h-4" />} label="Sub-Purpose" value={request.subPurpose?.name} />
                <InfoItem icon={<Calendar className="w-4 h-4" />} label="Submission Date" value={format(new Date(request.createdAt), "MMM dd, yyyy")} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Vendor Card */}
            <div 
              className="glass-card md:col-span-2 overflow-hidden animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Vendor Details</h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{request.vendor?.companyName}</p>
                    <div className="flex gap-2 mt-0.5">
                       <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-500/20 flex items-center gap-1">
                         <ShieldCheck className="w-2.5 h-2.5" /> Verified
                       </span>
                       <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                         Reg: {request.vendor?.registrationNumber || "Pending"}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                   <div className="space-y-1">
                     <p className="text-[9px] font-bold text-zinc-600 uppercase">Primary Contact</p>
                     <p className="text-xs text-zinc-300 font-medium">{request.vendor?.contactPerson || "N/A"}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[9px] font-bold text-zinc-600 uppercase">Contact Number</p>
                     <p className="text-xs text-zinc-300 font-medium">{request.vendor?.contactNumber || "N/A"}</p>
                   </div>
                   <div className="space-y-1 col-span-2">
                     <p className="text-[9px] font-bold text-zinc-600 uppercase">Email Address</p>
                     <p className="text-xs text-zinc-300 font-medium">{request.vendor?.email || "N/A"}</p>
                   </div>
                   <div className="space-y-1 col-span-2">
                     <p className="text-[9px] font-bold text-zinc-600 uppercase">Office Location</p>
                     <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{request.vendor?.address || "N/A"}</p>
                   </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div 
              className="glass-card md:col-span-3 overflow-hidden animate-slide-up"
              style={{ animationDelay: "0.15s" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Price Summary Breakdown</h2>
                </div>
                <div className="flex gap-2">
                  <span className="text-[9px] bg-brand-secondary/10 text-brand-secondary px-2 py-0.5 rounded-md border border-brand-secondary/20 font-bold uppercase tracking-widest">{request.currency || "QAR"}</span>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-1 sm:border-r border-border sm:pr-4">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">Net Item Subtotal</p>
                    <p className="text-xl font-serif text-foreground tracking-tighter">{(request.totalEstimatedCost || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1 sm:border-r border-border sm:px-4">
                     <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">Payment Cycle</p>
                     <div className="flex flex-col gap-1 mt-1">
                       <p className="text-base font-serif text-foreground capitalize leading-none pt-1">
                          {request.paymentStructure?.replace(/_/g, ' ').toLowerCase() || "Not Specified"}
                       </p>
                       {request.paymentStructure === 'IN_PARTS' && request.paymentInstallments && (
                         <p className="text-[10px] text-muted-foreground font-bold">
                           {request.paymentInstallments.length} Installments Defined
                         </p>
                       )}
                     </div>
                  </div>
                  <div className="space-y-1 sm:pl-4">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">Freight & Logistics</p>
                    <p className="text-xl font-serif text-muted-foreground tracking-tighter">{(request.freightAmount || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-border flex justify-between items-end">
                  <div className="space-y-0.5">
                    <h3 className="text-brand-primary text-[9px] font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                       Total Estimated Expenditure
                       <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded border border-brand-primary/20">INC. FREIGHT</span>
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-serif text-brand-primary tracking-tighter leading-none">
                        {((request.totalEstimatedCost || 0) + (request.freightAmount || 0)).toLocaleString()}
                      </p>
                      <span className="text-muted-foreground text-xs font-serif">{request.currency || "QAR"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none mb-2">Internal Allocation</p>
                    <div className="flex flex-col items-end gap-1">
                       <span className="text-emerald-500 text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">Provisioned</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Grid */}
          <div
            className="glass-card overflow-hidden border-brand-primary/5 shadow-2xl shadow-brand-primary/5 animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                   <FileBadge className="w-4 h-4 text-brand-primary" />
                </div>
                <h2 className="text-base font-bold text-foreground tracking-tight">Requested Items Breakdown</h2>
              </div>
              <div className="flex items-center gap-4">
                 <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-secondary px-3 py-1 rounded-full border border-border">
                   {request.items?.length || 0} Line Items
                 </span>
                <button 
                   onClick={() => {
                     if (!Array.isArray(request.items)) {
                       toast.error("No item data available for export");
                       return;
                     }
                     const csvRows = ['Item Specification,Qty,Unit Price,Extended Total'];
                     request.items.forEach((i: any) => {
                       csvRows.push(`"${String(i.name || '').replace(/"/g, '""')}","${i.quantity || 0}","${i.estimatedCost || 0}","${((i.quantity || 0) * (i.estimatedCost || 0))}"`);
                     });
                     const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = `request-items-${request.id}.csv`;
                     a.click();
                     window.URL.revokeObjectURL(url);
                   }}
                   className="text-[10px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest flex items-center gap-1.5 px-3 py-1 rounded-md hover:bg-secondary transition-all"
                 >
                    <Download className="w-3 h-3" /> Export CSV
                 </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background/80 border-b border-border text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-8 py-5">#</th>
                    <th className="px-6 py-5">Item Specification</th>
                    <th className="px-6 py-5 text-center">Qty</th>
                    <th className="px-6 py-5 text-right font-serif">Unit Price</th>
                    <th className="px-8 py-5 text-right font-serif">Ext. Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                   {Array.isArray(request.items) ? request.items.map((item: any, idx: number) => (
                     <tr key={idx} className="group hover:bg-secondary/30 transition-colors relative">
                       <td className="px-8 py-6 text-muted-foreground font-mono text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                       <td className="px-6 py-6">
                         <div className="flex flex-col gap-1">
                           <p className="text-sm font-bold text-foreground group-hover:text-brand-primary transition-colors">{item.name || "Unnamed Item"}</p>
                           {item.remarks && (
                             <div className="flex items-center gap-1.5 opacity-60">
                               <MessageSquare className="w-3 h-3 text-muted-foreground" />
                               <p className="text-[11px] text-muted-foreground font-medium italic">{item.remarks}</p>
                             </div>
                           )}
                         </div>
                       </td>
                       <td className="px-6 py-6 text-center">
                         <span className="bg-secondary border border-border px-2.5 py-1 rounded-md text-[11px] font-bold text-foreground">
                           {item.quantity || 0}
                         </span>
                       </td>
                       <td className="px-6 py-6 text-right text-muted-foreground font-medium tabular-nums font-serif">
                         {Number(item.estimatedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </td>
                       <td className="px-8 py-6 text-right text-foreground font-bold tabular-nums font-serif text-base">
                         {((item.quantity || 0) * (item.estimatedCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </td>
                     </tr>
                   )) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-muted-foreground italic text-xs uppercase tracking-widest">
                        No line items parsed in document record
                      </td>
                    </tr>
                   )}
                 </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6 pb-12">
            {/* Document Vault */}
            <div 
              style={{ animationDelay: "0.25s" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Support Documents</h2>
                </div>
              </div>
              <div className="p-8 border-t border-border bg-secondary/10">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-4">Supporting Documentation</h3>
              {Array.isArray(request.attachments) && request.attachments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {request.attachments.map((file: any) => (
                    <button 
                    key={file.id} 
                    onClick={() => setActiveAttachment(file)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      activeAttachment?.id === file.id 
                        ? 'bg-brand-primary/10 border-brand-primary/30' 
                        : 'bg-background/40 border-border hover:bg-secondary/50'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-secondary border border-border shrink-0">
                      <FileText className={`w-4 h-4 ${activeAttachment?.id === file.id ? 'text-brand-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-foreground truncate">{file.fileName}</p>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-tighter mt-0.5">{(file.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                  </button>
                ))}
                </div>
                ) : (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em]">No Documents Available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Document Preview Snapshot */}
            <div
              className="glass-card overflow-hidden flex flex-col animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                 <div className="flex items-center gap-2">
                    <FileBadge className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-bold text-foreground tracking-tight">Interactive Preview</h2>
                 </div>
              </div>
              <div className="min-h-[600px] w-full bg-zinc-900/50 flex items-center justify-center relative">
                 {activeAttachment ? (
                   <iframe 
                    src={`/api/attachments/${activeAttachment.id}`} 
                    className="absolute inset-0 w-full h-full border-none"
                    title="PDF"
                   />
                 ) : (
                   <div className="text-center p-8">
                     <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                        <FileText className="w-6 h-6 text-zinc-700" />
                     </div>
                     <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-loose">Select a document<br />for instant inspection</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
          
          {/* Finance Ledger Section (RBAC Protected) */}
          {isFinanceOrAdmin && (
             <div 
              className="animate-slide-up"
              style={{ animationDelay: "0.35s" }}
             >
                <FinanceLedger request={request} />
             </div>
          )}

        </div>

        {/* Sidebar Info (1 Column) */}
        <aside className="space-y-6">
          
          {/* Unified Procurement Lifecycle Timeline */}
          <div 
            className="glass-card p-0 overflow-hidden animate-slide-up"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="px-6 py-5 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Procurement Lifecycle</h2>
              </div>
              <History className="w-4 h-4 text-muted-foreground" />
            </div>
            
            <div className="p-6 relative">
               {/* Continuity Line */}
               <div className="absolute left-[31px] top-8 bottom-8 w-px bg-gradient-to-b from-brand-primary via-zinc-800 to-transparent" />
               
               <div className="space-y-8">
                  {/* Phase 1: Initiation */}
                  <TimelineGroup label="Request Initiation">
                     <LifecycleItem 
                        title="Draft Created"
                        subtitle={`By ${request.requester?.username}`}
                        time={format(new Date(request.createdAt), "hh:mm a • MMM dd")}
                        status="completed"
                        icon={<FileText className="w-3 h-3" />}
                     />
                  </TimelineGroup>

                  {/* Phase 2: Departmental Approvals (Unified) */}
                  <TimelineGroup label="Departmental Sign-offs">
                  {Array.isArray(request.approvals) && request.approvals.length > 0 ? (
                    request.approvals.map((approval: any, idx: number) => {
                      const isPending = approval.status === 'pending';
                      const isApproved = approval.status === 'approved';
                      const isRejected = approval.status === 'rejected';
                      const isCurrent = isPending && (idx === 0 || request.approvals[idx-1]?.status === 'approved');
                      
                      return (
                        <LifecycleItem 
                          key={approval.id}
                          title={approval.department}
                          subtitle={
                            isApproved ? `Signed off by ${approval.approver?.username}` :
                            isRejected ? `Rejected by ${approval.approver?.username}` :
                            approval.status === 'changes_requested' ? `Changes requested by ${approval.approver?.username}` :
                            `Waiting for ${approval.department} approvers`
                          }
                          time={approval.processedAt ? format(new Date(approval.processedAt), "MMM dd, yyyy • hh:mm a") : undefined}
                          status={
                            isApproved ? 'completed' : 
                            isRejected ? 'error' : 
                            approval.status === 'changes_requested' ? 'warning' :
                            isCurrent ? 'current' : 'pending'
                          }
                          stakeholders={isPending ? approval.stakeholders : []}
                          comments={approval.comments}
                          isMandatory={approval.isMandatory}
                          icon={<ShieldCheck className="w-3 h-3" />}
                        />
                      );
                    })
                  ) : (
                    <div className="p-4 rounded-xl bg-secondary/20 border border-dashed border-border text-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">No approval records initialized</p>
                    </div>
                  )}
                  </TimelineGroup>

                  {/* Phase 3: Finalization */}
                  <TimelineGroup label="Process Completion" isLast>
                    <LifecycleItem 
                       title="Final Fulfillment"
                       subtitle={request.status === 'approved' ? "Ready for procurement execution" : "Awaiting departmental approvals"}
                       status={request.status === 'approved' ? 'completed' : 'pending'}
                       icon={<CheckCircle2 className="w-3 h-3" />}
                       isLast
                    />
                  </TimelineGroup>
               </div>
            </div>
            
            <div className="p-4 bg-zinc-900/50 border-t border-white/5">
               <button 
                 onClick={() => setShowAuditModal(true)}
                 className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2"
               >
                 <History className="w-3 h-3" /> View Full Audit Trail
               </button>
            </div>
          </div>

          {/* Payment Cycle & Installments Sidebar Component */}
          <div 
            className="glass-card overflow-hidden animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <h2 className="text-sm font-bold text-foreground tracking-tight">Payment Cycle</h2>
              </div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest bg-secondary px-2 py-0.5 rounded border border-border">
                {request.paymentStructure?.replace(/_/g, ' ').toLowerCase() || "Not Specified"}
              </span>
            </div>
            
            <div className="p-5">
              {request.paymentStructure === 'IN_PARTS' && Array.isArray(request.paymentInstallments) && request.paymentInstallments.length > 0 ? (
                <div className="space-y-4">
                  {request.paymentInstallments.map((inst: any, idx: number) => (
                    <div key={idx} className="p-3 bg-secondary/30 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Inst {idx + 1}</span>
                         <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest">
                           {inst.valueType === 'PERCENTAGE' ? `${inst.amountValue}%` : 'FIXED'}
                         </span>
                      </div>
                      <p className="text-xs font-bold text-foreground mb-1">{inst.installmentName}</p>
                      <div className="flex justify-between items-end mt-3 pt-3 border-t border-border">
                         <div className="flex flex-col">
                           <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">Due</span>
                           <span className="text-[10px] font-mono font-medium text-foreground">{format(new Date(inst.dueDate), "MMM dd")}</span>
                         </div>
                         <div className="flex flex-col items-end">
                           <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">Amount</span>
                           <span className="text-sm font-serif font-bold text-foreground tabular-nums">{Number(inst.calculatedAmount).toLocaleString()}</span>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center flex flex-col items-center justify-center">
                   <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mb-2">
                     <CreditCard className="w-4 h-4 text-muted-foreground" />
                   </div>
                   <p className="text-xs font-bold text-foreground capitalize mb-1">{request.paymentStructure?.replace(/_/g, ' ').toLowerCase() || "Standard Processing"}</p>
                   <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">No custom installments</p>
                </div>
              )}
            </div>
          </div>

        </aside>

      </div>

      <CreateRequestModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        requestId={requestId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["request", requestId] });
          queryClient.invalidateQueries({ queryKey: ["requests"] });
          queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
          setShowEditModal(false);
          toast.success("Request synchronized with global ledger.");
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
    </div>
  );
}

function InfoItem({ icon, label, value, color = "text-foreground" }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="text-brand-primary/60">{icon}</div>
        <span className="text-[9px] uppercase font-bold tracking-[0.2em]">{label}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${color}`}>{value || "—"}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const configs: Record<string, string> = {
    high: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    low: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border ${configs[priority] || configs.medium}`}>
      {priority || "medium"} Priority
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    rejected: "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]",
    draft: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    changes_requested: "bg-amber-600/10 text-amber-600 border-amber-600/20",
    VARIATION_PENDING: "bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)] animate-pulse",
  };

  return (
    <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border ${configs[status] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
      {typeof status === 'string' ? status.replace(/_/g, ' ') : 'N/A'}
    </span>
  );
}


function TimelineGroup({ label, children, isLast = false }: any) {
  return (
    <div className="space-y-4">
       <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
         {label}
       </h3>
       <div className="space-y-0 relative">
          {children}
       </div>
    </div>
  );
}

function LifecycleItem({ title, subtitle, time, status, icon, stakeholders = [], comments, isMandatory, isLast = false }: any) {
  const configs = {
    completed: { dot: "bg-emerald-500", ring: "ring-emerald-500/20", text: "text-white" },
    error: { dot: "bg-rose-500", ring: "ring-rose-500/20", text: "text-rose-400" },
    warning: { dot: "bg-amber-500", ring: "ring-amber-500/20", text: "text-amber-400" },
    current: { dot: "bg-brand-primary animate-pulse", ring: "ring-brand-primary/40", text: "text-brand-primary" },
    pending: { dot: "bg-zinc-800", ring: "ring-transparent", text: "text-zinc-600" },
  };

  const config = configs[status as keyof typeof configs] || configs.pending;

  return (
    <div className="flex gap-4 min-h-[60px] group relative last:min-h-0">
      <div className="flex flex-col items-center">
        <div className={`z-10 w-6 h-6 rounded-lg ${config.dot} flex items-center justify-center shadow-lg ${config.ring} ring-4 border-2 border-zinc-950 transition-all group-hover:scale-110`}>
          <div className="text-white scale-90">{icon}</div>
        </div>
      </div>

      <div className="flex-1 pb-8 group-last:pb-2">
        <div className="flex justify-between items-start gap-2 -mt-0.5">
          <div className="flex items-center gap-2">
             <p className={`text-[13px] font-bold tracking-tight ${config.text}`}>{title}</p>
             {isMandatory && (
               <span className="text-[7px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-brand-primary/20">MANDATORY</span>
             )}
          </div>
          {time && <span className="text-[9px] text-zinc-600 font-mono font-bold">{time}</span>}
        </div>
        
        <p className="text-[11px] text-zinc-500 mt-1 font-medium leading-relaxed">{subtitle}</p>

        {stakeholders.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
             <div className="flex -space-x-1.5">
                 {Array.isArray(stakeholders) && stakeholders.map((s: any, i: number) => (
                   <div 
                     key={i} 
                     title={s.username} 
                     className="w-5 h-5 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[8px] font-bold text-zinc-500 hover:text-white hover:border-brand-primary transition-all cursor-help"
                   >
                     {(s.username || "U").substring(0,1).toUpperCase()}
                   </div>
                 ))}
              </div>
             <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Available Approvers</span>
          </div>
        )}

        {comments && (
          <div className="mt-3 p-3 rounded-xl bg-secondary/50 border border-border relative overflow-hidden">
             <div className="absolute top-0 right-0 p-1 opacity-5">
                <MessageSquare className="w-8 h-8 rotate-12" />
             </div>
             <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                <MessageSquare className="w-2.5 h-2.5 text-brand-primary" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Sign-off Comment</span>
             </div>
             <p className="text-[11px] text-foreground font-medium italic leading-relaxed pl-1 border-l-2 border-brand-primary/20">"{comments}"</p>
          </div>
        )}
      </div>
    </div>
  );
}


function ErrorState({ error }: { error?: any }) {
  const is404 = error?.status === 404 || !error;
  const is403 = error?.status === 403;
  const is401 = error?.status === 401;

  const title = is403 ? "Access Denied" : is401 ? "Session Expired" : is404 ? "Record Not Found" : "System Synchronous Error";
  const message = is403 ? "You do not have the institutional clearance required to view this procurement record." 
                : is401 ? "Your administrative session has timed out. Please refresh to re-authenticate."
                : is404 ? "The purchase request may have been removed or archived."
                : (error?.data?.details || error?.message || "An unexpected error occurred within the procurement engine.");

  return (
    <div className="flex flex-col gap-4 p-8 w-full h-[70vh] justify-center items-center text-center">
      <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
        <XCircle className="w-10 h-10 text-rose-500" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-foreground tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">{message}</p>
      
      {!is401 && (
        <div className="flex gap-4 mt-8">
          <Link href="/dashboard/requests">
            <Button variant="ghost" className="h-11 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5">
              Return to Hub
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="h-11 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10"
          >
            Refresh Interface
          </Button>
        </div>
      )}
    </div>
  );
}

function AuditTrailModal({ isOpen, onClose, auditLogs }: { isOpen: boolean, onClose: () => void, auditLogs: any[] }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-background/90 backdrop-blur-md cursor-pointer animate-fade-in"
      />

      <div
        className="relative w-full max-w-3xl bg-card border border-border rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-[201] animate-fade-scale-in"
      >
        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
              <History className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Complete Audit Trail</h2>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Immutable Activity Log</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(!auditLogs || auditLogs.length === 0) ? (
            <div className="text-center py-12">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">No activity recorded yet</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
              <div className="space-y-6">
                {[...(auditLogs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log, idx) => (
                  <div key={idx} className="relative flex gap-4 pl-10">
                    <div className="absolute left-[-1.15rem] top-1">
                      <div className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="flex-1 bg-secondary/20 border border-border rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-white/10 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{log.action.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-bold text-foreground">{log.details?.processedBy || "System User"}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(log.timestamp), "MMM dd, yyyy • hh:mm:ss a")}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 grid grid-cols-2 gap-2">
                        {Object.entries(log.details || {}).filter(([k]) => k !== 'processedBy').map(([k, v]) => (
                          <div key={k} className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-wider font-bold opacity-60">{k}</span>
                            <span className="text-xs font-medium text-foreground">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
