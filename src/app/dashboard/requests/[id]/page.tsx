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
  FileBadge
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const requestId = parseInt(params.id as string);
  const [activeAttachment, setActiveAttachment] = useState<any>(null);

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => apiClient.requests.get(requestId),
  });

  const approveMutation = useMutation({
    mutationFn: (status: string) => apiClient.requests.approve(requestId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      toast.success("Status updated successfully");
    },
    onError: () => toast.error("Failed to update status"),
  });

  if (isLoading) return <LoadingState />;
  if (!request) return <ErrorState />;

  return (
    <div className="flex flex-col bg-zinc-950 min-h-screen">
      {/* Sticky Action Bar */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono font-bold text-brand-primary bg-brand-primary/10 px-2.5 py-1 rounded-md border border-brand-primary/20">
                {request.requestNumber}
              </span>
              <h1 className="text-xl font-serif text-white truncate max-w-md">{request.title}</h1>
              <StatusBadge status={request.status} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => apiClient.documents.downloadPdf(requestId)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all font-semibold text-xs"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            {request.status === "pending" && (
              <>
                <button 
                  onClick={() => approveMutation.mutate("approved")}
                  className="bg-brand-secondary text-black px-4 py-1.5 rounded-lg hover:scale-105 transition-all font-bold text-xs shadow-xl shadow-brand-secondary/20"
                >
                  Approve
                </button>
                <button 
                  onClick={() => approveMutation.mutate("rejected")}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-1.5 rounded-lg hover:bg-rose-500/20 transition-all font-bold text-xs"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* High-Density Grid */}
      <div className="flex-1 p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Detail Content (Left Columns) */}
        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Header Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 md:col-span-2"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-zinc-500 mt-1 max-w-2xl leading-relaxed text-sm">{request.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              <InfoItem icon={<User className="w-4 h-4" />} label="Requester" value={request.requester?.username} />
              <InfoItem icon={<Building2 className="w-4 h-4" />} label="Department" value={request.requester?.department} />
              <InfoItem icon={<Clock className="w-4 h-4" />} label="Created" value={format(new Date(request.createdAt), "MMM dd, yyyy")} />
              <InfoItem icon={<CreditCard className="w-4 h-4" />} label="Total" value={`${request.totalEstimatedCost.toLocaleString()} QAR`} color="text-brand-secondary" />
            </div>
          </motion.div>

          {/* Items Grid & Document Preview container */}
          <div className="grid grid-cols-1 gap-6">
            {/* Items Grid */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <FileBadge className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-sm font-bold text-white tracking-tight">Requested Items</h2>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono italic">{request.items?.length || 0} Entries</span>
              </div>
              <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/50 text-[9px] uppercase font-bold text-zinc-500 tracking-wider sticky top-0 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2">Quantity</th>
                      <th className="px-4 py-2">Unit Cost</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {request.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-zinc-200 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{item.estimatedCost.toLocaleString()} QAR</td>
                        <td className="px-4 py-2.5 text-right text-white ">{(item.quantity * item.estimatedCost).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Document Vault */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="glass-card overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-sm font-bold text-white tracking-tight">Support Documentation</h2>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono italic">{request.attachments?.length || 0} Files</span>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {request.attachments?.map((file: any) => (
                  <button 
                    key={file.id} 
                    onClick={() => setActiveAttachment(file)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      activeAttachment?.id === file.id 
                        ? 'bg-brand-primary/10 border-brand-primary/30' 
                        : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                      <FileText className={`w-4 h-4 ${activeAttachment?.id === file.id ? 'text-brand-primary' : 'text-zinc-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-white truncate">{file.fileName}</p>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-tighter mt-0.5">{(file.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                  </button>
                ))}
                {(!request.attachments || request.attachments.length === 0) && (
                  <div className="col-span-full py-4 text-center">
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">No Documents Uploaded</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Document Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card overflow-hidden flex flex-col flex-1"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                 <div className="flex items-center gap-2">
                    <FileBadge className="w-4 h-4 text-zinc-400" />
                    <h2 className="text-sm font-bold text-white tracking-tight">Active Preview</h2>
                 </div>
                 {activeAttachment && (
                    <div className="flex gap-2">
                      <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded border border-brand-primary/20">{activeAttachment.fileName}</span>
                    </div>
                 )}
              </div>
              <div className="min-h-[500px] w-full bg-zinc-900/50 flex items-center justify-center border-t border-black/50 overflow-hidden relative">
                 {activeAttachment ? (
                   <iframe 
                    src={`/api/attachments/${activeAttachment.id}`} 
                    className="absolute inset-0 w-full h-full border-none"
                    title="PDF Preview"
                   />
                 ) : (
                   <div className="text-center">
                     <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                     <p className="text-sm text-zinc-500 font-medium">Interactive PDF Viewer</p>
                     <p className="text-xs text-zinc-600 mt-1">Select a document from the vault to preview inline</p>
                   </div>
                 )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Sidebar Info (1 Column) */}
        <aside className="space-y-8">
          
          {/* Workflow Stepper */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 className="w-5 h-5 text-brand-secondary" />
              <h2 className="text-lg font-bold text-white">Approval Workflow</h2>
            </div>
            <div className="space-y-6">
              <WorkflowStep label="Draft Initiated" status="completed" date={request.createdAt} />
              
              {/* Dynamic Departmental Approvals */}
              {request.approvals?.map((approval: any) => (
                <WorkflowStep 
                  key={approval.id}
                  label={`${approval.department} Review`}
                  status={approval.status === 'approved' ? 'completed' : approval.status === 'rejected' ? 'rejected' : 'pending'}
                  date={approval.createdAt}
                  approver={approval.approver?.username}
                />
              ))}

              {request.status === 'approved' && (
                <WorkflowStep label="Final Execution" status="completed" />
              )}
            </div>
          </motion.div>

          {/* Audit Timeline */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6"
          >
             <div className="flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-bold text-white">Audit logs</h2>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {request.approvals?.map((log: any, idx: number) => (
                <div key={idx} className="flex gap-3 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-1" />
                  <div className="space-y-1">
                    <p className="text-zinc-200 font-medium">
                      <span className="text-brand-primary">{log.approver?.username}</span> 
                      {" "}{log.status} the request
                    </p>
                    <p className="text-zinc-500 italic">"{log.comments || 'No comment provided'}"</p>
                    <p className="text-[10px] text-zinc-600 uppercase font-bold">{format(new Date(log.createdAt), "HH:mm • MMM dd")}</p>
                  </div>
                </div>
              ))}
              {(!request.approvals || request.approvals.length === 0) && (
                <p className="text-xs text-zinc-600 italic">No history yet</p>
              )}
            </div>
          </motion.div>

        </aside>

      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, color = "text-zinc-100" }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${color}`}>{value || "Not Set"}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };

  return (
    <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border ${configs[status] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
      {status}
    </span>
  );
}

function WorkflowStep({ label, status, date, approver }: any) {
  const icons = {
    completed: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    rejected: <XCircle className="w-5 h-5 text-rose-500" />,
    current: <Clock className="w-5 h-5 text-brand-primary animate-pulse" />,
    pending: <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />,
  };

  return (
    <div className="flex gap-4 relative group">
      <div className="z-10 bg-zinc-950 p-1 border-4 border-zinc-950">
        {icons[status as keyof typeof icons]}
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-bold ${status === 'completed' ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
        <div className="flex items-center gap-2 mt-1">
          {date && <span className="text-[10px] text-zinc-600 font-mono">{format(new Date(date), "MMM dd")}</span>}
          {approver && (
            <>
              <span className="text-[10px] text-zinc-700">•</span>
              <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">{approver}</span>
            </>
          )}
        </div>
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
