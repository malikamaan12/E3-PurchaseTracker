"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, Download, CheckCircle2, XCircle, Clock, FileText, 
  User, Building2, CreditCard, History, FileBadge, MessageSquare,
  AlertTriangle, RotateCcw, Loader2, ShieldCheck, Calendar, Lock, Edit3, Trash2
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
    retry: 1,
  });

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

  return (
    <div className="flex flex-col bg-background min-h-screen text-foreground">
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

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-muted-foreground bg-secondary px-2 py-1 rounded">
                {request.requestNumber}
              </span>
              <h1 className="text-lg font-semibold truncate max-w-sm">{request.title}</h1>
              <StatusBadge status={request.status} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
                  className="gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded text-muted-foreground text-xs font-semibold" title="Locked from edits">
                <Lock className="w-3.5 h-3.5" /> Locked
              </div>
            )}

            {canAct && (
              <Button 
                onClick={() => setShowActionPanel(prev => !prev)}
                className="gap-2 bg-primary text-primary-foreground"
                size="sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {showActionPanel ? "Close Panel" : "Review"}
              </Button>
            )}
          </div>
        </div>

        {showActionPanel && canAct && (
          <div className="max-w-[1400px] mx-auto mt-3 animate-fade-scale-in">
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Review Request</span>
                  <span className="text-xs text-muted-foreground ml-2">Acting as: {user?.department}</span>
                </div>

                <textarea
                  value={approvalComments}
                  onChange={e => setApprovalComments(e.target.value)}
                  placeholder="Comments (required for rejection or change requests)..."
                  rows={2}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />

                <div className="flex items-center gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => handleApprovalAction("changes_requested")} disabled={approvalMutation.isPending}>
                    <RotateCcw className="w-3.5 h-3.5 mr-2" /> Request Changes
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleApprovalAction("rejected")} disabled={approvalMutation.isPending}>
                    <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApprovalAction("approved")} disabled={approvalMutation.isPending}>
                    {approvalMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                    Approve
                  </Button>
                </div>
            </div>
          </div>
        )}
      </header>

      {(request.status === "changes_requested" || request.status === "draft") && (request.requesterId === user?.id || isAdmin) && (
        <div className="bg-accent border-b border-border px-6 py-3">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between text-accent-foreground text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4" />
              {request.status === "draft" 
                ? "This request is a draft. Please edit and submit."
                : "Changes requested. Update and re-submit."}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit Request
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h2 className="font-semibold text-sm">Request Summary</h2>
              <PriorityBadge priority={request.priority} />
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm leading-relaxed">{request.description}</p>
                </div>
                {request.priorityReason && (
                   <div className="bg-muted p-3 rounded-md">
                     <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Priority Reason</h3>
                     <p className="text-sm italic">{request.priorityReason}</p>
                   </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Requester" value={request.requester?.username} />
                  <InfoItem label="Department" value={request.requester?.department} />
                  <InfoItem label="Purpose" value={request.subPurpose?.name} />
                  <InfoItem label="Date" value={format(new Date(request.createdAt), "MMM dd, yyyy")} />
                </div>
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vendor Details</h3>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{request.vendor?.companyName}</p>
                    <p className="text-xs text-muted-foreground">{request.vendor?.contactPerson} • {request.vendor?.email}</p>
                    <p className="text-xs text-muted-foreground">{request.vendor?.contactNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h2 className="font-semibold text-sm">Financial Summary</h2>
              <span className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded">{request.currency || "QAR"}</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Item Subtotal</p>
                  <p className="text-lg font-mono">{(request.totalEstimatedCost || 0).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Freight</p>
                  <p className="text-lg font-mono">{(request.freightAmount || 0).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Payment Cycle</p>
                  <p className="text-sm font-medium capitalize mt-1.5">{request.paymentStructure?.replace(/_/g, ' ').toLowerCase() || "Standard"}</p>
                </div>
                <div className="space-y-1 border-l border-border pl-4">
                  <p className="text-xs text-muted-foreground">Total Expenditure</p>
                  <p className="text-2xl font-mono font-semibold text-primary">
                    {((request.totalEstimatedCost || 0) + (request.freightAmount || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h2 className="font-semibold text-sm">Requested Items</h2>
              <div className="flex gap-2">
                 <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                   if (!Array.isArray(request.items)) return toast.error("No items to export");
                   const rows = ['Item,Qty,Price,Total'];
                   request.items.forEach((i: any) => rows.push(`"${i.name}","${i.quantity}","${i.estimatedCost}","${i.quantity*i.estimatedCost}"`));
                   const url = window.URL.createObjectURL(new Blob([rows.join('\\n')], { type: 'text/csv' }));
                   const a = document.createElement('a'); a.href = url; a.download = `items-${request.id}.csv`; a.click(); window.URL.revokeObjectURL(url);
                 }}>
                    <Download className="w-3 h-3 mr-2" /> CSV
                 </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-center font-medium">Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Unit Price</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                   {Array.isArray(request.items) ? request.items.map((item: any, idx: number) => (
                     <tr key={idx} className="hover:bg-muted/10">
                       <td className="px-4 py-3">
                         <div className="font-medium">{item.name || "Unnamed Item"}</div>
                         {item.remarks && <div className="text-xs text-muted-foreground mt-0.5">{item.remarks}</div>}
                       </td>
                       <td className="px-4 py-3 text-center">{item.quantity || 0}</td>
                       <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                         {Number(item.estimatedCost || 0).toLocaleString()}
                       </td>
                       <td className="px-4 py-3 text-right font-mono font-medium">
                         {((item.quantity || 0) * (item.estimatedCost || 0)).toLocaleString()}
                       </td>
                     </tr>
                   )) : (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No line items</td></tr>
                   )}
                 </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-sm">Documents</h2>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                {Array.isArray(request.attachments) && request.attachments.length > 0 ? (
                  request.attachments.map((file: any) => (
                    <button 
                      key={file.id} 
                      onClick={() => setActiveAttachment(file)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        activeAttachment?.id === file.id ? 'bg-primary/5 border-primary/30' : 'bg-background hover:bg-muted/50 border-border'
                      }`}
                    >
                      <FileText className={`w-4 h-4 shrink-0 ${activeAttachment?.id === file.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{file.fileName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{(file.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No documents attached.</p>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-sm">Preview</h2>
              </div>
              <div className="flex-1 bg-muted/10 relative">
                 {activeAttachment ? (
                   <iframe src={`/api/attachments/${activeAttachment.id}`} className="absolute inset-0 w-full h-full border-none" title="Preview" />
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <FileBadge className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">Select a document to preview</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
          
          {isFinanceOrAdmin && (
             <div className="pt-4">
                <FinanceLedger request={request} />
             </div>
          )}

        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h2 className="font-semibold text-sm">Procurement Timeline</h2>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAuditModal(true)}>
                <History className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-5">
              <div className="relative border-l border-border ml-3 space-y-6 pb-4">
                <TimelineItem 
                  title="Request Initiated"
                  desc={`By ${request.requester?.username}`}
                  time={format(new Date(request.createdAt), "MMM dd, yyyy")}
                  status="completed"
                />
                
                {Array.isArray(request.approvals) && request.approvals.map((approval: any, idx: number) => {
                  const isPending = approval.status === 'pending';
                  const isApproved = approval.status === 'approved';
                  const isRejected = approval.status === 'rejected';
                  const isCurrent = isPending && (idx === 0 || request.approvals[idx-1]?.status === 'approved');
                  
                  return (
                    <TimelineItem 
                      key={approval.id}
                      title={`${approval.department} Approval`}
                      desc={isApproved ? `Approved by ${approval.approver?.username}` : isRejected ? "Rejected" : "Pending Action"}
                      time={approval.processedAt ? format(new Date(approval.processedAt), "MMM dd, yyyy") : undefined}
                      status={isApproved ? 'completed' : isRejected ? 'error' : isCurrent ? 'current' : 'pending'}
                    />
                  );
                })}

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
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 truncate">{value || "—"}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const configs: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${configs[priority] || configs.medium}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
    draft: "bg-muted text-muted-foreground border-border",
    changes_requested: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${configs[status] || configs.draft}`}>
      {typeof status === 'string' ? status.replace(/_/g, ' ') : 'N/A'}
    </span>
  );
}

function TimelineItem({ title, desc, time, status }: { title: string, desc: string, time?: string, status: string }) {
  const configs = {
    completed: "bg-emerald-500 border-emerald-500 ring-emerald-500/20",
    error: "bg-destructive border-destructive ring-destructive/20",
    current: "bg-primary border-primary ring-primary/20 animate-pulse",
    pending: "bg-background border-border ring-transparent",
  };
  const config = configs[status as keyof typeof configs] || configs.pending;

  return (
    <div className="relative pl-6">
      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 ${config} ring-4`} />
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        {time && <span className="text-xs text-muted-foreground">{time}</span>}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error?: any }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 h-[60vh] text-center">
      <XCircle className="w-12 h-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Error Loading Request</h2>
      <p className="text-sm text-muted-foreground mb-6">{error?.message || "Record not found or access denied."}</p>
      <Button variant="outline" onClick={() => window.location.href = "/dashboard/requests"}>Return to Hub</Button>
    </div>
  );
}

function AuditTrailModal({ isOpen, onClose, auditLogs }: { isOpen: boolean, onClose: () => void, auditLogs: any[] }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-lg flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="font-semibold">Audit Trail</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {(!auditLogs || auditLogs.length === 0) ? (
            <p className="text-center text-sm text-muted-foreground py-8">No activity recorded</p>
          ) : (
            auditLogs.map((log, i) => (
              <div key={i} className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
                <div className="flex justify-between font-medium mb-1">
                  <span>{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(log.timestamp), "MMM dd, yyyy HH:mm")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  By {log.details?.processedBy || "System"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
