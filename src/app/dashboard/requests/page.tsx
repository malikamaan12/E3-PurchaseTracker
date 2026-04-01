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
  FileSpreadsheet,
  Archive,
  BarChart3,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from "@radix-ui/react-dropdown-menu";

export default function RequestsDashboard() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", filterStatus],
    queryFn: () => apiClient.requests.list(filterStatus !== "all" ? { status: filterStatus } : {}),
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["requests-analytics"],
    queryFn: () => apiClient.requests.analytics(),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => apiClient.requests.approve(requestId, { status: "approved" }),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: ["requests"] });
      const previous = queryClient.getQueryData(["requests", filterStatus]);
      queryClient.setQueryData(["requests", filterStatus], (old: any[]) => 
        old?.map(r => r.id === requestId ? { ...r, status: "approved" } : r)
      );
      toast.success("Request approved optimistically");
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["requests", filterStatus], context?.previous);
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
          <h1 className="text-4xl font-serif tracking-tight text-white">Purchase Requests</h1>
          <p className="text-zinc-400">Manage procurement lifecycle and approval workflows.</p>
        </div>
        <ActionBar />
      </header>

      <SpendAnalytics data={analytics} isLoading={analyticsLoading} />

      <FilterBar current={filterStatus} set={setFilterStatus} />

      <main className="glass-card overflow-hidden relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5 border-b border-white/10 uppercase text-xs tracking-widest text-zinc-500 font-semibold">
            <tr>
              <th className="px-6 py-4 w-12">
                <input 
                  type="checkbox"
                  className="rounded border-white/10 bg-white/5 text-brand-primary focus:ring-brand-primary"
                  checked={selectedIds.length === requests?.length && requests?.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-6 py-4">Request #</th>
              <th className="px-6 py-4">Title & Requester</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
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
        icon={<TrendingUp className="text-emerald-500" />} 
        borderColor="border-emerald-500/20"
      />
      <AnalyticsCard 
        label="Pending Volume" 
        value={pending} 
        suffix="QAR" 
        icon={<BarChart3 className="text-brand-primary" />} 
        borderColor="border-brand-primary/20"
      />
      <AnalyticsCard 
        label="Active Requests" 
        value={count} 
        icon={<DollarSign className="text-zinc-400" />} 
      />
    </div>
  );
}

function AnalyticsCard({ label, value, suffix = "", icon, borderColor = "border-white/5" }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-6 border-l-4 ${borderColor} flex justify-between items-center`}
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-white tracking-tighter">
          {value.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">{suffix}</span>
        </h3>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
        {icon}
      </div>
    </motion.div>
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
          className="fixed bottom-8 left-1/2 -translate-x-1/2 glass px-6 py-4 rounded-full border border-white/20 shadow-2xl z-50 flex items-center gap-6"
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Selection</span>
            <span className="text-white font-bold">{selectedCount} Requests</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex gap-2">
            <button 
              onClick={onApprove}
              disabled={isProcessing}
              className="bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isProcessing ? "Processing..." : "Approve Selected"}
            </button>
            <button 
              onClick={onClear}
              className="bg-white/5 text-zinc-400 text-xs font-bold px-4 py-2 rounded-lg hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RequestRow({ request, isSelected, onSelect, onApprove }: any) {
  return (
    <motion.tr 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`group hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-brand-primary/5' : ''}`}
    >
      <td className="px-6 py-5">
        <input 
          type="checkbox"
          className="rounded border-white/10 bg-white/5 text-brand-primary focus:ring-brand-primary cursor-pointer"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
        />
      </td>
      <td className="px-6 py-5 font-mono text-xs text-brand-secondary">
        {request.requestNumber}
      </td>
      <td className="px-6 py-5">
        <div className="font-semibold text-zinc-100">{request.title}</div>
        <div className="text-xs text-zinc-500">{request.requester?.username} • {request.requester?.department}</div>
      </td>
      <td className="px-6 py-5">
        <StatusBadge status={request.status} />
      </td>
      <td className="px-6 py-5 font-semibold text-white">
        {request.totalEstimatedCost?.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">QAR</span>
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex justify-end gap-2">
          {request.status === "pending" && (
            <button 
              onClick={onApprove}
              className="p-2 rounded-md hover:bg-emerald-500/10 text-emerald-500 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass p-1 rounded-md z-50 min-w-[120px]">
              <DropdownMenuItem 
                onClick={() => apiClient.documents.downloadPdf(request.id)}
                className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 rounded cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => apiClient.documents.downloadZip(request.id)}
                className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 rounded cursor-pointer transition-colors text-zinc-400"
              >
                <Archive className="w-3.5 h-3.5" /> Backup ZIP
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
    draft: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${configs[status] || configs.draft}`}>
      {status}
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
  const filters = ["all", "pending", "approved", "rejected", "draft"];
  return (
    <div className="flex gap-2 p-1 glass w-fit rounded-lg self-start">
      {filters.map(f => (
        <button
          key={f}
          onClick={() => set(f)}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${current === f ? "bg-white/10 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
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
      <p className="text-zinc-500 animate-pulse font-mono tracking-widest text-xs uppercase">Initializing Grid...</p>
    </div>
  );
}
