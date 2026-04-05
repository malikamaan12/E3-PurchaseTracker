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
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAdmin, isApprover } = useAuth();
  const requestId = parseInt(params.id as string);
  const [activeAttachment, setActiveAttachment] = useState<any>(null);
  const [approvalComments, setApprovalComments] = useState("");
  const [showActionPanel, setShowActionPanel] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => apiClient.requests.get(requestId),
  });

  // The new approval state machine endpoint
  const approvalMutation = useMutation({
    mutationFn: ({ status, comments }: { status: string; comments: string }) =>
      apiClient.requests.submitApproval(requestId, { status, comments }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success(data.message || "Action submitted successfully");
      setApprovalComments("");
      setShowActionPanel(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit action"),
  });

  if (isLoading) return <LoadingState />;
  if (!request) return <ErrorState />;

  // Check if the current user's dept has a pending approval record for this request
  const myDeptApproval = request.approvals?.find(
    (a: any) => a.department === user?.department
  );
  const canAct =
    request.status === "pending" &&
    (isAdmin || (isApprover && myDeptApproval && myDeptApproval.status === "pending"));

  const handleApprovalAction = (status: string) => {
    if ((status === "rejected" || status === "changes_requested") && !approvalComments.trim()) {
      toast.error("Comments are required when rejecting or requesting changes.");
      return;
    }
    approvalMutation.mutate({ status, comments: approvalComments });
  };

  return (
    <div className="flex flex-col bg-background min-h-screen transition-colors duration-300">
      {/* Sticky Action Bar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
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
              <h1 className="text-xl font-serif text-foreground truncate max-w-md">{request.title}</h1>
              <StatusBadge status={request.status} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => apiClient.documents.downloadPdf(requestId)}
              className="flex items-center gap-2 bg-secondary/50 border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-all font-semibold text-xs"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>

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
        <AnimatePresence>
          {showActionPanel && canAct && (
            <motion.div
              key="action-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-[1600px] mx-auto mt-4 overflow-hidden"
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
                    className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg hover:bg-amber-500/20 transition-all font-bold text-xs disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Request Changes
                  </button>
                  <button
                    onClick={() => handleApprovalAction("rejected")}
                    disabled={approvalMutation.isPending}
                    className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-lg hover:bg-rose-500/20 transition-all font-bold text-xs disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovalAction("approved")}
                    disabled={approvalMutation.isPending}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/20 transition-all font-bold text-xs disabled:opacity-50"
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
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* "Changes Requested" Banner */}
      {request.status === "changes_requested" && request.requesterId === user?.id && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold">
              An approver has requested changes. Edit this request and re-submit for approval.
            </p>
          </div>
        </div>
      )}

      {/* High-Density Grid */}
      <div className="flex-1 p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Detail Content (Left Columns) */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Main Header Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card overflow-hidden"
          >
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
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Vendor Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card md:col-span-2 overflow-hidden"
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
            </motion.div>

            {/* Financial Summary */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card md:col-span-3 overflow-hidden"
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="space-y-1 border-r border-border pr-4">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">Net Item Subtotal</p>
                    <p className="text-xl font-serif text-foreground tracking-tighter">{(request.totalEstimatedCost - (request.freightAmount || 0)).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1 border-r border-border px-4 hidden md:block">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">Estimated VAT (0%)</p>
                    <p className="text-xl font-serif text-muted-foreground tracking-tighter">0.00</p>
                  </div>
                  <div className="space-y-1 pl-4">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">Freight & Logistics</p>
                    <p className="text-xl font-serif text-muted-foreground tracking-tighter">{(request.freightAmount || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-border flex justify-between items-end">
                  <div className="space-y-0.5">
                    <h3 className="text-brand-primary text-[9px] font-bold uppercase tracking-[0.3em]">Total Estimated Expenditure</h3>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-serif text-brand-primary tracking-tighter leading-none">{request.totalEstimatedCost.toLocaleString()}</p>
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
            </motion.div>
          </div>

          {/* Items Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card overflow-hidden border-brand-primary/5 shadow-2xl shadow-brand-primary/5"
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
                 <button className="text-[10px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest flex items-center gap-1.5 px-3 py-1 rounded-md hover:bg-secondary transition-all">
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
                <tbody className="divide-y divide-white/[0.03]">
                  {request.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="group hover:bg-white/[0.01] transition-colors relative">
                      <td className="px-8 py-6 text-zinc-600 font-mono text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{item.name}</p>
                          {item.remarks && (
                            <div className="flex items-center gap-1.5 opacity-60">
                              <MessageSquare className="w-3 h-3 text-zinc-500" />
                              <p className="text-[11px] text-zinc-400 font-medium italic">{item.remarks}</p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className="bg-zinc-900 border border-white/5 px-2.5 py-1 rounded-md text-[11px] font-bold text-zinc-400">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right text-zinc-400 font-medium tabular-nums font-serif">
                        {Number(item.estimatedCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-8 py-6 text-right text-white font-bold tabular-nums font-serif text-base">
                        {(item.quantity * item.estimatedCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            {/* Document Vault */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-card overflow-hidden flex flex-col"
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Support Documents</h2>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {request.attachments?.map((file: any) => (
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
                {(!request.attachments || request.attachments.length === 0) && (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em]">No Documents Available</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Document Preview Snapshot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card overflow-hidden flex flex-col"
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                 <div className="flex items-center gap-2">
                    <FileBadge className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-bold text-foreground tracking-tight">Interactive Preview</h2>
                 </div>
              </div>
              <div className="h-[300px] w-full bg-zinc-900/50 flex items-center justify-center relative">
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
            </motion.div>
          </div>
        </div>

        {/* Sidebar Info (1 Column) */}
        <aside className="space-y-6">
          
          {/* Unified Procurement Lifecycle Timeline */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card p-0 overflow-hidden"
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
                    {request.approvals?.map((approval: any, idx: number) => {
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
                          time={approval.processedAt ? format(new Date(approval.processedAt), "hh:mm a • MMM dd") : undefined}
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
                    })}
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
               <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                 <History className="w-3 h-3" /> View Full Audit Trail
               </button>
            </div>
          </motion.div>

        </aside>

      </div>
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
  };

  return (
    <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border ${configs[status] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
      {status?.replace(/_/g, ' ')}
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
                {stakeholders.map((s: any, i: number) => (
                  <div 
                    key={i} 
                    title={s.username} 
                    className="w-5 h-5 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[8px] font-bold text-zinc-500 hover:text-white hover:border-brand-primary transition-all cursor-help"
                  >
                    {s.username.substring(0,1).toUpperCase()}
                  </div>
                ))}
             </div>
             <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Available Approvers</span>
          </div>
        )}

        {comments && (
          <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 relative">
             <p className="text-[10px] text-zinc-400 italic leading-relaxed">"{comments}"</p>
             <div className="absolute -left-1 w-2 h-2 bg-zinc-950 border-l border-t border-white/5 rotate-[-45deg] top-3" />
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full h-[80vh] justify-center items-center">
      <div className="w-24 h-24 relative">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute inset-0 border-t-4 border-brand-secondary rounded-full"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-4 bg-brand-primary/20 rounded-full"
        />
      </div>
      <p className="text-zinc-500 font-mono tracking-[0.4em] text-xs uppercase animate-pulse">Synchronizing Data...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col gap-4 p-8 max-w-7xl mx-auto w-full h-[60vh] justify-center items-center text-center">
      <XCircle className="w-16 h-16 text-rose-500 opacity-20" />
      <h2 className="text-xl font-bold text-white">Record Not Found</h2>
      <p className="text-zinc-500 text-sm">The purchase request may have been removed or archived.</p>
    </div>
  );
}
