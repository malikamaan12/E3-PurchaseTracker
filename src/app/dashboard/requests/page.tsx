"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useState } from "react";
import { 
  FileText, 
  Download, 
  CheckCircle, 
  XCircle, 
  Filter, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Archive,
  BarChart3,
  TrendingUp,
  DollarSign,
  Eye,
  Link as LinkIcon,
  FileSpreadsheet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef } from "react";
import { initMagnetic, initGlow, pageLoad } from "@/lib/animations";

export default function RequestsDashboard() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isApprover } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiClient.departments.list(),
    enabled: !!(isAdmin || isApprover),
  });

  useEffect(() => {
    pageLoad(".glass-card, header, .glass");
  }, []);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", filterStatus, filterDept],
    queryFn: () => {
      const params: any = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterDept !== "all") params.department = filterDept;
      return apiClient.requests.list(params);
    },
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["requests-analytics"],
    queryFn: () => apiClient.requests.analytics(),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => apiClient.requests.approve(requestId, { status: "approved" }),
    onMutate: async (requestId) => {
      const queryKey = ["requests", filterStatus, filterDept];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[]) => 
        old?.map(r => r.id === requestId ? { ...r, status: "approved" } : r)
      );
      toast.success("Request approved optimistically");
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["requests", filterStatus, filterDept], context?.previous);
      toast.error("Failed to approve request. Rollback complete.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
    }
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: number[]) => apiClient.requests.bulkApprove({ requestIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
      toast.success(`Successfully approved ${selectedIds.length} requests`);
      setSelectedIds([]);
    },
    onError: (err: any) => toast.error(err.message || "Bulk approval failed"),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && requests) {
      setSelectedIds(requests.map((r: any) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif tracking-tight text-foreground">Purchase Requests</h1>
          <p className="text-muted-foreground">Manage procurement lifecycle and approval workflows.</p>
        </div>
        <ActionBar />
      </header>

      <SpendAnalytics data={analytics} isLoading={analyticsLoading} />

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <FilterBar current={filterStatus} set={setFilterStatus} />
        
        {(isAdmin || isApprover) && (
          <div className="relative group">
            <div className="flex items-center gap-3 glass rounded-[var(--radius-md)] px-4 py-2 hover:border-white/20 transition-all cursor-pointer">
              <Filter className="w-3.5 h-3.5 text-brand-secondary" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-r border-white/10 pr-3">Dept</span>
              <select 
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-6 appearance-none relative z-10"
              >
                <option value="all" className="bg-background text-foreground">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.name} className="bg-background text-foreground">{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-4 text-muted-foreground pointer-events-none group-hover:text-foreground transition-colors" />
            </div>
          </div>
        )}
      </div>

      <main className="glass-card overflow-x-auto custom-scrollbar relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5 dark:bg-white/[0.02] border-b border-white/10 dark:border-white/5 uppercase text-[10px] tracking-widest text-muted-foreground font-bold font-sans">
            <tr>
              <th className="px-6 py-5 w-12 text-center">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded-md border-white/20 bg-white/5 text-brand-primary focus:ring-brand-primary cursor-pointer transition-all"
                  checked={selectedIds.length === requests?.length && requests?.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-6 py-5 font-bold">Request #</th>
              <th className="px-6 py-5 font-bold">Title & Requester</th>
              <th className="px-6 py-5 font-bold">Status</th>
              <th className="px-6 py-5 font-bold">Amount</th>
              <th className="px-6 py-5 text-right font-bold pr-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <AnimatePresence mode="wait">
              {requests?.map((req: any) => (
                <RequestRow 
                  key={req.id} 
                  request={req} 
                  isSelected={selectedIds.includes(req.id)}
                  onSelect={(checked: boolean) => handleSelectRow(req.id, checked)}
                  onApprove={() => approveMutation.mutate(req.id)}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </main>

      <BulkActionToolbar 
        selectedCount={selectedIds.length} 
        onApprove={() => bulkApproveMutation.mutate(selectedIds)}
        onClear={() => setSelectedIds([])}
        isProcessing={bulkApproveMutation.isPending}
      />
    </div>
  );
}

function SpendAnalytics({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <div className="h-32 glass animate-pulse rounded-2xl" />;

  const approved = data?.approved?.total || 0;
  const pending = data?.pending?.total || 0;
  const count = (data?.pending?.count || 0) + (data?.approved?.count || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <AnalyticsCard 
        label="Total Approved" 
        value={approved} 
        suffix="QAR" 
        icon={<TrendingUp className="text-emerald-400 w-6 h-6" />} 
        glowClass="bg-emerald-500"
      />
      <AnalyticsCard 
        label="Pending Volume" 
        value={pending} 
        suffix="QAR" 
        icon={<BarChart3 className="text-brand-secondary w-6 h-6" />} 
        glowClass="bg-brand-secondary"
      />
      <AnalyticsCard 
        label="Active Requests" 
        value={count} 
        icon={<DollarSign className="text-brand-primary w-6 h-6" />} 
        glowClass="bg-brand-primary"
      />
    </div>
  );
}

function AnalyticsCard({ label, value, suffix = "", icon, glowClass = "" }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current && glowRef.current) {
      const cleanMagnetic = initMagnetic(cardRef.current);
      const cleanGlow = initGlow(cardRef.current, glowRef.current);
      return () => {
        cleanMagnetic?.();
        cleanGlow?.();
      };
    }
  }, []);

  return (
    <div 
      ref={cardRef}
      className="glass-card p-8 relative overflow-hidden group cursor-default"
    >
      {/* Sublte Cursor-following Glow */}
      <div 
        ref={glowRef}
        className={`absolute w-48 h-48 rounded-full blur-3xl opacity-0 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0 ${glowClass.replace('bg-', 'bg-')}/10`}
      />
      
      <div className="relative z-10 flex justify-between items-center">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-2 opacity-60">{label}</p>
          <h3 className="text-3xl font-bold text-foreground tracking-tighter flex items-baseline gap-2">
            {value.toLocaleString()} 
            {suffix && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{suffix}</span>}
          </h3>
        </div>
        <div className="w-14 h-14 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner">
          {icon}
        </div>
      </div>
    </div>
  );
}

function BulkActionToolbar({ selectedCount, onApprove, onClear, isProcessing }: any) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 glass-card px-8 py-5 rounded-full border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-50 flex items-center gap-8"
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-70">Bulk Actions</span>
            <span className="text-foreground font-bold text-lg tracking-tight">{selectedCount} Selected</span>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="flex gap-3">
            <button 
              onClick={onApprove}
              disabled={isProcessing}
              className="bg-brand-gradient text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isProcessing ? "Processing..." : "Approve Now"}
              <CheckCircle className="w-4 h-4" />
            </button>
            <button 
              onClick={onClear}
              className="bg-white/5 dark:bg-white/[0.03] text-muted-foreground hover:text-foreground text-xs font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-all border border-white/10"
            >
              Deselect
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RequestRow({ request, isSelected, onSelect, onApprove }: any) {
  const router = useRouter();

  return (
    <motion.tr 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`group hover:bg-white/[0.04] dark:hover:bg-white/[0.02] transition-all duration-300 ${isSelected ? 'bg-brand-primary/10' : ''}`}
    >
      <td className="px-6 py-5">
        <input 
          type="checkbox"
          className="rounded border-border bg-secondary text-brand-primary focus:ring-brand-primary cursor-pointer transition-colors"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
        />
      </td>
      <td className="px-6 py-5 font-mono text-xs text-brand-secondary">
        {request.requestNumber}
      </td>
      <td className="px-6 py-5">
        <div className="font-semibold text-foreground tracking-tight transition-colors">{request.title}</div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">{request.requester?.username} • {request.requester?.department}</div>
      </td>
      <td className="px-6 py-5">
        <StatusBadge status={request.status} />
      </td>
      <td className="px-6 py-5 font-semibold text-foreground">
        {request.totalEstimatedCost?.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">QAR</span>
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex justify-end gap-1.5">
          {request.status === "pending" && (
            <button 
              onClick={onApprove}
              className="p-2 rounded-xl hover:bg-emerald-500/10 text-emerald-500 transition-all active:scale-90"
              title="Quick Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          
          <button 
            onClick={() => router.push(`/dashboard/requests/${request.id}`)}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-90 border border-transparent hover:border-border"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button 
            onClick={() => apiClient.documents.downloadPdf(request.id)}
            className="p-2 rounded-xl hover:bg-brand-primary/10 text-zinc-400 hover:text-brand-primary transition-all active:scale-90"
            title="Download PDF"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button 
            onClick={() => apiClient.documents.downloadZip(request.id)}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-90 border border-transparent hover:border-border"
            title="Download All (ZIP)"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    draft: "bg-secondary text-muted-foreground border-border",
    changes_requested: "bg-amber-600/10 text-amber-600 border-amber-600/20",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${configs[status] || configs.draft}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function ActionBar() {
  return (
    <div className="flex gap-3">
      <button 
        onClick={() => apiClient.documents.exportExcel()}
        className="flex items-center gap-2 bg-brand-primary text-white font-semibold px-4 py-2 rounded-md hover:bg-brand-primary/90 transition-all shadow-lg active:scale-95"
      >
        <FileSpreadsheet className="w-4 h-4" /> Bulk Excel
      </button>
    </div>
  );
}

function FilterBar({ current, set }: { current: string; set: (v: string) => void }) {
  const filters = ["all", "pending", "approved", "rejected", "draft", "changes_requested"];
  return (
    <div className="flex gap-2 p-1 glass w-fit rounded-lg self-start">
      {filters.map(f => (
        <button
          key={f}
          onClick={() => set(f)}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${current === f ? "bg-primary/10 text-primary shadow-inner" : "text-muted-foreground hover:text-foreground"}`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-8 max-w-7xl mx-auto w-full h-[60vh] justify-center items-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"
      />
      <p className="text-muted-foreground animate-pulse font-mono tracking-widest text-[10px] font-bold uppercase transition-colors">Initializing Grid...</p>
    </div>
  );
}
