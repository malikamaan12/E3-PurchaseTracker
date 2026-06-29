"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useState, lazy } from "react";
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
  FileSpreadsheet,
  PlusCircle,
  Lock
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef, Suspense } from "react";
import { initMagnetic, initGlow, pageLoad } from "@/lib/animations";
import { RequestFilters } from "@/components/requests/RequestFilters";
import { DeleteRequestDialog } from "@/components/requests/DeleteRequestDialog";
import { Edit2, Trash2, Zap } from "lucide-react";
import { usePerformance } from "@/context/PerformanceContext";

// Lazy-load the heavy 62KB modal — only downloaded when user clicks "New Request"
const CreateRequestModal = lazy(() => import("@/components/requests/CreateRequestModal"));

function RequestsDashboardContent() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isApprover } = useAuth();
  const searchParams = useSearchParams();
  const q = searchParams.get("q");

  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    department: "all",
    vendor: "all",
    purpose: "all",
    purposeCategoryId: "all",
    subPurposeId: "all",
    dateFrom: "",
    dateTo: "",
    costMin: "",
    costMax: "",
    search: q || "",
    requestNo: ""
  });

  // Sink URL search param 'q' into filter state
  useEffect(() => {
    setFilters(prev => {
      if (q !== null && q !== prev.search) {
        return { ...prev, search: q };
      }
      return prev;
    });
  }, [q, setFilters]);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiClient.departments.list(),
    enabled: true,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiClient.vendors.list(),
  });

  const { data: purposes = [] } = useQuery({
    queryKey: ["purposes"],
    queryFn: () => apiClient.purposes.list(),
  });

  useEffect(() => {
    pageLoad(".glass-card, .glass");
  }, []);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", filters],
    queryFn: () => {
      const params: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") {
          params[key] = value;
        }
      });
      return apiClient.requests.list(params);
    },
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["requests-analytics"],
    queryFn: () => apiClient.requests.analytics(),
  });

  // Edit/Delete State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<any | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.requests.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
      toast.success("Request deleted successfully");
      setDeleteRequest(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete request"),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => apiClient.requests.approve(requestId, { status: "approved" }),
    onMutate: async (requestId) => {
      const queryKey = ["requests", filters];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[]) => 
        old?.map(r => r.id === requestId ? { ...r, status: "approved" } : r)
      );
      toast.success("Request approved optimistically");
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["requests", filters], context?.previous);
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

  const { highPerformanceMode } = usePerformance();

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif tracking-tight text-foreground">Purchase Requests</h1>
          <p className="text-muted-foreground">Manage procurement lifecycle and approval workflows.</p>
        </div>
        <ActionBar onNewRequest={() => setIsCreateModalOpen(true)} />
      </header>

      <SpendAnalytics data={analytics} isLoading={analyticsLoading} />

      <RequestFilters 
        filters={filters} 
        setFilters={setFilters} 
        metadata={{ departments, vendors, purposes }} 
      />

      <main className="glass-card overflow-x-auto shadow-sm rounded-lg w-full custom-scrollbar relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5 dark:bg-white/[0.02] border-b border-white/10 dark:border-white/5 uppercase text-xs tracking-widest text-muted-foreground font-bold font-sans">
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
            {isLoading ? (
              <>
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </>
            ) : highPerformanceMode ? (
              requests?.map((req: any) => (
                <RequestRow 
                  key={req.id} 
                  request={req} 
                  isSelected={selectedIds.includes(req.id)}
                  onSelect={(checked: boolean) => handleSelectRow(req.id, checked)}
                  onApprove={() => approveMutation.mutate(req.id)}
                  onEdit={() => setEditingId(req.id)}
                  onDelete={() => setDeleteRequest(req)}
                />
              ))
            ) : (
              <>
                {requests?.map((req: any) => (
                  <RequestRow 
                    key={req.id} 
                    request={req} 
                    isSelected={selectedIds.includes(req.id)}
                    onSelect={(checked: boolean) => handleSelectRow(req.id, checked)}
                    onApprove={() => approveMutation.mutate(req.id)}
                    onEdit={() => setEditingId(req.id)}
                    onDelete={() => setDeleteRequest(req)}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </main>

      <BulkActionToolbar 
        selectedCount={selectedIds.length} 
        onApprove={() => bulkApproveMutation.mutate(selectedIds)}
        onClear={() => setSelectedIds([])}
        isProcessing={bulkApproveMutation.isPending}
      />

      {(!!editingId || isCreateModalOpen) && (
        <Suspense fallback={null}>
          <CreateRequestModal 
            isOpen={!!editingId || isCreateModalOpen}
            onClose={() => {
              setEditingId(null);
              setIsCreateModalOpen(false);
            }}
            requestId={editingId || undefined}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["requests"] });
              queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
              setEditingId(null);
              setIsCreateModalOpen(false);
            }}
          />
        </Suspense>
      )}

      <DeleteRequestDialog 
        isOpen={!!deleteRequest}
        onOpenChange={(open) => !open && setDeleteRequest(null)}
        onConfirm={() => deleteMutation.mutate(deleteRequest.id)}
        isLoading={deleteMutation.isPending}
        requestNumber={deleteRequest?.requestNumber}
      />
    </div>
  );
}

export default function RequestsDashboard() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequestsDashboardContent />
    </Suspense>
  );
}

function SpendAnalytics({ data, isLoading }: { data: any; isLoading: boolean }) {
  const { highPerformanceMode } = usePerformance();
  if (isLoading) return <div className="h-32 glass animate-pulse rounded-2xl" />;

  // The API returns kpis: { byStatus: [], totalPaid: number }
  const kpis = data?.kpis?.byStatus || [];
  
  const approvedObj = kpis.find((k: any) => k.status === 'approved');
  const pendingObj = kpis.find((k: any) => k.status === 'pending');
  
  const approved = approvedObj?.totalValue || 0;
  const approvedCount = approvedObj?.count || 0;
  
  const pending = pendingObj?.totalValue || 0;
  const pendingCount = pendingObj?.count || 0;
  
  // Active count = pending + approved + variation_pending
  const activeCount = kpis.filter((k: any) => 
    ['pending', 'approved', 'VARIATION_PENDING', 'changes_requested'].includes(k.status)
  ).reduce((acc: number, curr: any) => acc + curr.count, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <AnalyticsCard 
        label="Total Approved" 
        value={approved} 
        suffix="QAR" 
        subValue={approvedCount}
        subLabel="requests"
        icon={<TrendingUp className="text-emerald-400 w-6 h-6" />} 
        glowClass="bg-emerald-500"
      />
      <AnalyticsCard 
        label="Pending Volume" 
        value={pending} 
        suffix="QAR" 
        subValue={pendingCount}
        subLabel="requests"
        icon={<BarChart3 className="text-brand-secondary w-6 h-6" />} 
        glowClass="bg-brand-secondary"
      />
      <AnalyticsCard 
        label="Active Status" 
        value={activeCount} 
        suffix="REQ"
        icon={<div className="text-brand-primary font-black text-sm tracking-tighter">QAR</div>} 
        glowClass="bg-brand-primary"
      />
    </div>
  );
}

function AnalyticsCard({ label, value, suffix = "", subValue, subLabel, icon, glowClass = "" }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const { highPerformanceMode } = usePerformance();

  useEffect(() => {
    if (!highPerformanceMode && cardRef.current && glowRef.current) {
      const cleanMagnetic = initMagnetic(cardRef.current);
      const cleanGlow = initGlow(cardRef.current, glowRef.current);
      return () => {
        cleanMagnetic?.();
        cleanGlow?.();
      };
    }
  }, [highPerformanceMode]);

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
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-bold mb-1 opacity-60">{label}</p>
          <h3 className="text-3xl font-bold text-foreground tracking-tighter flex items-baseline gap-2">
            {value.toLocaleString()} 
            {suffix && <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{suffix}</span>}
          </h3>
          {subValue !== undefined && (
            <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-widest">
              {subValue.toLocaleString()} {subLabel}
            </p>
          )}
        </div>
        <div className="w-14 h-14 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner">
          {icon}
        </div>
      </div>
    </div>
  );
}

function BulkActionToolbar({ selectedCount, onApprove, onClear, isProcessing }: any) {
  const { highPerformanceMode } = usePerformance();

  if (selectedCount === 0) return null;

  const content = (
    <div className="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 glass-card px-4 md:px-8 py-3 md:py-5 rounded-2xl md:rounded-full border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-[110] flex items-center gap-4 md:gap-8 w-[95vw] md:w-auto overflow-x-auto custom-scrollbar">
      <div className="flex flex-col">
        <span className="text-xs uppercase font-bold text-muted-foreground tracking-widest opacity-70">Bulk Actions</span>
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
    </div>
  );

  if (highPerformanceMode) return content;

  return (
    <div 
      className="animate-fade-scale-in"
    >
      {content}
    </div>
  );
}

function RequestRow({ request, isSelected, onSelect, onApprove, onEdit, onDelete }: any) {
  const router = useRouter();
  const { highPerformanceMode } = usePerformance();
  const { user, isAdmin } = useAuth();

  const rowClassName = `group hover:bg-white/[0.04] dark:hover:bg-white/[0.02] transition-all duration-300 ${isSelected ? 'bg-brand-primary/10' : ''}`;

  const renderCells = () => (
    <>
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
        <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mt-1">
          {request.requester?.username} • {request.requester?.department}
          {request.subPurpose?.name && (
            <>
              <span className="mx-1.5 opacity-30">|</span>
              <span className="text-brand-primary">{request.subPurpose.name}</span>
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-5">
        <StatusBadge status={request.status} />
      </td>
      <td className="px-6 py-5 font-semibold text-foreground">
        {request.totalEstimatedCost?.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">QAR</span>
      </td>
      <td className="px-6 py-5 text-right overflow-visible">
        <div className="flex justify-end gap-2 items-center">
          {request.status === "pending" && (
            <button 
              onClick={onApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all text-xs font-bold border border-emerald-500/20"
              title="Quick Approve"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          
          <button 
            onClick={() => router.push(`/dashboard/requests/${request.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground transition-all text-xs font-bold border border-white/10"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>

          <div className="relative group/menu">
            <button className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors border border-transparent group-hover/menu:border-white/10 group-hover/menu:bg-white/5">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 py-1 overflow-hidden">
              {((isAdmin && !['fully_paid', 'archived'].includes(request.status)) || 
               (request.requesterId === user?.id && (
                 request.status === 'draft' || 
                 request.status === 'changes_requested' || 
                 (request.status === 'pending' && Number(request.approvedCount || 0) === 0)
               ))) && (
                <>
                  <button onClick={onEdit} className="w-full text-left px-4 py-2 text-xs font-medium text-brand-primary/80 hover:text-brand-primary hover:bg-white/5 flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Request
                  </button>
                  <button onClick={onDelete} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-500/80 hover:text-rose-500 hover:bg-white/5 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Request
                  </button>
                </>
              )}
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button onClick={() => apiClient.documents.downloadPdf(request.id)} className="w-full text-left px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Download PDF
              </button>
              <button onClick={() => apiClient.documents.downloadZip(request.id)} className="w-full text-left px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center gap-2">
                <Archive className="w-3.5 h-3.5" /> Download ZIP
              </button>
            </div>
          </div>
        </div>
      </td>
    </>
  );

  if (highPerformanceMode) {
    return <tr className={rowClassName}>{renderCells()}</tr>;
  }

  return <tr className={`animate-slide-up ${rowClassName}`}>{renderCells()}</tr>;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    draft: "bg-secondary text-muted-foreground border-border",
    changes_requested: "bg-amber-600/10 text-amber-600 border-amber-600/20",
    VARIATION_PENDING: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase border ${configs[status] || configs.draft}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function ActionBar({ onNewRequest }: { onNewRequest: () => void }) {
  return (
    <div className="flex gap-3">
      <button 
        onClick={onNewRequest}
        className="flex items-center gap-2 bg-brand-gradient text-white font-bold px-6 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(var(--brand-primary),0.4)] transition-all shadow-lg hover:scale-105 active:scale-95 text-sm"
      >
        <PlusCircle className="w-4.5 h-4.5" /> New Request
      </button>
    </div>
  );
}

function FilterBar({ current, set }: { current: string; set: (v: string) => void }) {
  const filters = ["all", "pending", "VARIATION_PENDING", "approved", "rejected", "draft", "changes_requested"];
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

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-5 w-12 text-center">
        <div className="w-4 h-4 rounded bg-white/10 dark:bg-white/5 mx-auto" />
      </td>
      <td className="px-6 py-5">
        <div className="h-4 w-16 bg-white/10 dark:bg-white/5 rounded" />
      </td>
      <td className="px-6 py-5">
        <div className="h-4 w-48 bg-white/10 dark:bg-white/5 rounded mb-2" />
        <div className="h-3 w-32 bg-white/10 dark:bg-white/5 rounded" />
      </td>
      <td className="px-6 py-5">
        <div className="h-5 w-16 bg-white/10 dark:bg-white/5 rounded-full" />
      </td>
      <td className="px-6 py-5">
        <div className="h-4 w-20 bg-white/10 dark:bg-white/5 rounded" />
      </td>
      <td className="px-6 py-5 text-right pr-10">
        <div className="flex justify-end gap-1.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-white/5" />
          <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-white/5" />
          <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-white/5" />
        </div>
      </td>
    </tr>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-8 w-full h-[60vh] justify-center items-center">
      <div 
        className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"
      />
      <p className="text-muted-foreground animate-pulse font-mono tracking-widest text-xs font-bold uppercase transition-colors">Loading Grid...</p>
    </div>
  );
}
