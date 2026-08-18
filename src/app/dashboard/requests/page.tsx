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
  Lock,
  Inbox
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
import { usePageTitle } from "@/lib/hooks/usePageTitle";

// Lazy-load the heavy 62KB modal — only downloaded when user clicks "New Request"
const CreateRequestModal = lazy(() => import("@/components/requests/CreateRequestModal"));

function RequestsDashboardContent() {
  usePageTitle("Purchase Requests");
  const queryClient = useQueryClient();
  const { user, isSuperAdmin, isAdmin, isApprover, isSupervisor, canApproveInDepartment } = useAuth();
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const { highPerformanceMode } = usePerformance();

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

  const { data: subPurposes = [] } = useQuery({
    queryKey: ["sub-purposes"],
    queryFn: () => apiClient.requests.getSubPurposes(),
  });

  useEffect(() => {
    if (!highPerformanceMode) {
      pageLoad(".glass-card, .glass");
    }
  }, [highPerformanceMode]);

  const [page, setPage] = useState(1);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", filters, page],
    queryFn: () => {
      const params: any = { limit: page * 50 };
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

  // Edit/Delete/Approve Confirmation State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<any | null>(null);
  const [confirmApprovalRequest, setConfirmApprovalRequest] = useState<any | null>(null);
  const [myQueueMode, setMyQueueMode] = useState(false);

  // "My Queue" — requests where logged-in user is an approver and has an active pending approval slot
  const myQueueRequests = (!isSupervisor && (isSuperAdmin || isApprover)) ? (requests || []).filter((req: any) =>
    Array.isArray(req.approvals) &&
    req.approvals.some((a: any) =>
      a.status === 'pending' && (isSuperAdmin || canApproveInDepartment(a.department))
    )
  ) : [];

  const displayedRequests = myQueueMode ? myQueueRequests : (requests || []);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
      toast.success("Request approval submitted successfully");
      setConfirmApprovalRequest(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve request.");
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

  return (
    <div className="flex flex-col gap-4 sm:gap-6 md:gap-8 p-1 sm:p-4 md:p-8 w-full max-w-full overflow-hidden">
      <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Purchase Requests</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage procurement lifecycle and approval workflows.</p>
        </div>
        <ActionBar onNewRequest={() => setIsCreateModalOpen(true)} />
      </header>

      <SpendAnalytics data={analytics} isLoading={analyticsLoading} />

      {/* My Queue Tab — only shown to users in approver-flagged departments */}
      {isApprover && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMyQueueMode(false)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              !myQueueMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            All Requests
          </button>
          <button
            onClick={() => setMyQueueMode(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              myQueueMode
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20"
            }`}
          >
            <span>⏳</span> My Queue
            {myQueueRequests.length > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                myQueueMode ? "bg-white/30 text-white" : "bg-amber-500 text-white"
              }`}>
                {myQueueRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

      <RequestFilters
        filters={filters}
        setFilters={setFilters}
        metadata={{ departments, vendors, purposes, subPurposes }}
      />

      <main className="w-full">
        {isLoading ? (
          <div className="space-y-4">
            <div className="md:hidden space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card p-5 rounded-xl border border-border animate-pulse space-y-3">
                  <div className="h-4 w-28 bg-white/10 dark:bg-white/5 rounded" />
                  <div className="h-5 w-4/5 bg-white/10 dark:bg-white/5 rounded" />
                  <div className="h-4 w-1/2 bg-white/10 dark:bg-white/5 rounded" />
                  <div className="h-8 w-full bg-white/10 dark:bg-white/5 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-card border border-border shadow-sm rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-secondary/50 border-b border-border text-xs font-medium text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-6 py-5 w-12 text-center"><div className="w-4 h-4 rounded bg-white/10 mx-auto" /></th>
                    <th scope="col" className="px-6 py-5 font-bold">Request #</th>
                    <th scope="col" className="px-6 py-5 font-bold">Title & Requester</th>
                    <th scope="col" className="px-6 py-5 font-bold">Status</th>
                    <th scope="col" className="px-6 py-5 font-bold">Amount</th>
                    <th scope="col" className="px-6 py-5 text-right font-bold pr-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </tbody>
              </table>
            </div>
          </div>
        ) : requests?.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center border border-border text-muted-foreground">
              <Inbox className="w-8 h-8 opacity-70" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {filters.search ? "No matching requests found" : filters.status !== 'all' ? `No ${filters.status.replace(/_/g, ' ')} requests` : "No purchase requests"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filters.search
                  ? `No requests match "${filters.search}". Try adjusting your keywords or clearing active filters.`
                  : filters.status !== 'all' || filters.department !== 'all' || filters.vendor !== 'all'
                  ? "No purchase requests match the active filter criteria. Clear your filters to see all requests."
                  : "Get started by creating your first purchase request in the procurement workflow."}
              </p>
            </div>
            {(filters.search || filters.status !== 'all' || filters.department !== 'all' || filters.vendor !== 'all' || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => setFilters({
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
                  search: "",
                  requestNo: ""
                })}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View: Request Cards */}
            <div className="md:hidden space-y-4">
              {displayedRequests.map((req: any) => {
                const awaitingMyApproval = !isSupervisor && (isSuperAdmin || isApprover) && Array.isArray(req.approvals) &&
                  req.approvals.some((a: any) =>
                    a.status === 'pending' && (isSuperAdmin || canApproveInDepartment(a.department))
                  );
                return (
                  <div key={req.id} className="relative">
                    {awaitingMyApproval && (
                      <div className="absolute -top-2 left-3 z-10 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm">
                        <span>⏳</span> Awaiting Your Approval
                      </div>
                    )}
                    <RequestMobileCard
                      request={req}
                      isSelected={selectedIds.includes(req.id)}
                      onSelect={(checked: boolean) => handleSelectRow(req.id, checked)}
                      onRequestApprove={(targetReq: any) => setConfirmApprovalRequest(targetReq)}
                      onEdit={() => setEditingId(req.id)}
                      onDelete={() => setDeleteRequest(req)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet View: Full Table */}
            <div className="hidden md:block bg-card border border-border overflow-x-auto shadow-sm rounded-lg w-full custom-scrollbar relative">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-secondary/50 border-b border-border text-xs font-medium text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-6 py-5 w-12 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select all requests"
                        className="w-4 h-4 rounded-md border-white/20 bg-white/5 text-brand-primary focus:ring-brand-primary cursor-pointer transition-all"
                        checked={selectedIds.length === requests?.length && requests?.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th scope="col" className="px-6 py-5 font-bold">Request #</th>
                    <th scope="col" className="px-6 py-5 font-bold">Title & Requester</th>
                    <th scope="col" className="px-6 py-5 font-bold">Status</th>
                    <th scope="col" className="px-6 py-5 font-bold">Amount</th>
                    <th scope="col" className="px-6 py-5 text-right font-bold pr-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedRequests.map((req: any) => {
                    const awaitingMyApproval = !isSupervisor && (isSuperAdmin || isApprover) && Array.isArray(req.approvals) &&
                      req.approvals.some((a: any) =>
                        a.status === 'pending' && (isSuperAdmin || canApproveInDepartment(a.department))
                      );
                    return (
                      <RequestRow
                        key={req.id}
                        request={req}
                        isSelected={selectedIds.includes(req.id)}
                        onSelect={(checked: boolean) => handleSelectRow(req.id, checked)}
                        onApprove={() => setConfirmApprovalRequest(req)}
                        onEdit={() => setEditingId(req.id)}
                        onDelete={() => setDeleteRequest(req)}
                        awaitingMyApproval={awaitingMyApproval}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {requests && requests.length >= page * 50 && (
              <div className="p-4 flex justify-center border-t border-border mt-4">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-5 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors min-h-[44px] touch-target"
                >
                  Load More Requests
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {!isSupervisor && (isSuperAdmin || isApprover) && (
        <BulkActionToolbar
          selectedCount={selectedIds.length}
          onApprove={() => bulkApproveMutation.mutate(selectedIds)}
          onClear={() => setSelectedIds([])}
          isProcessing={bulkApproveMutation.isPending}
        />
      )}

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

      {/* Explicit Approval Confirmation Dialog */}
      {confirmApprovalRequest && (
        <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground">Confirm Request Approval</h3>
                <p className="text-xs font-mono text-muted-foreground truncate">{confirmApprovalRequest.requestNumber}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title:</span>
                <span className="font-semibold text-foreground truncate max-w-[220px] text-right">{confirmApprovalRequest.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-foreground">{confirmApprovalRequest.totalEstimatedCost?.toLocaleString()} QAR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requester:</span>
                <span className="font-medium text-foreground">{confirmApprovalRequest.requester?.username} ({confirmApprovalRequest.requester?.department})</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to approve this purchase request? This action will transition the request to the next workflow stage.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmApprovalRequest(null)}
                disabled={approveMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 font-semibold text-xs min-h-[44px] touch-target"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => approveMutation.mutate(confirmApprovalRequest.id)}
                disabled={approveMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm min-h-[44px] touch-target flex items-center gap-1.5"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  if (isLoading) return <div className="h-32 bg-card border border-border animate-pulse rounded-lg" />;

  // Prefer canonical overview from FinancialMetricsService if provided
  const overview = data?.overview;
  const kpis = data?.kpis?.byStatus || [];

  const getStatusSum = (...statuses: string[]) => {
    return kpis
      .filter((k: any) => statuses.some(s => s.toLowerCase() === (k.status || "").toLowerCase()))
      .reduce((acc: { count: number; totalValue: number }, curr: any) => ({
        count: acc.count + Number(curr.count || 0),
        totalValue: acc.totalValue + Number(curr.totalValue || 0)
      }), { count: 0, totalValue: 0 });
  };

  const approved = overview ? overview.fullyApprovedAmount : getStatusSum('approved').totalValue;
  const approvedCount = overview ? overview.fullyApprovedCount : getStatusSum('approved').count;

  // In-flight / pending volume = pending + partially_approved requests
  const pendingStat = getStatusSum('pending', 'partially_approved', 'PARTIALLY_APPROVED');
  const pending = overview
    ? (overview.partiallyApprovedAmount + (kpis.find((k: any) => k.status === 'pending')?.totalValue || 0))
    : pendingStat.totalValue;
  const pendingCount = overview
    ? (overview.partiallyApprovedCount + (kpis.find((k: any) => k.status === 'pending')?.count || 0))
    : pendingStat.count;

  // Active count = pending + partially_approved + approved + variation_pending + changes_requested
  const activeCount = overview
    ? overview.activeRequestsCount
    : getStatusSum('pending', 'partially_approved', 'PARTIALLY_APPROVED', 'approved', 'VARIATION_PENDING', 'variation_pending', 'changes_requested').count;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <div className="col-span-1 sm:col-span-2 lg:col-span-1">
        <AnalyticsCard
          label="Total Approved"
          value={approved}
          suffix="QAR"
          subValue={approvedCount}
          subLabel="requests"
          icon={<TrendingUp className="text-emerald-500 w-5 h-5" />}
          glowClass="bg-emerald-500"
        />
      </div>
      <AnalyticsCard
        label="Pending Volume"
        value={pending}
        suffix="QAR"
        subValue={pendingCount}
        subLabel="requests"
        icon={<BarChart3 className="text-brand-secondary w-5 h-5" />}
        glowClass="bg-brand-secondary"
      />
      <AnalyticsCard
        label="Active Requests"
        value={activeCount}
        suffix="REQ"
        subLabel="in workflow"
        icon={<div className="text-brand-primary font-bold text-xs">QAR</div>}
        glowClass="bg-brand-primary"
      />
    </div>
  );
}

function AnalyticsCard({ label, value, suffix = "", subValue, subLabel, icon, glowClass = "" }: any) {
  return (
    <div className="bg-card border border-border p-4 sm:p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground truncate">{label}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-baseline gap-1.5 mt-0.5">
            {value.toLocaleString()}
            {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}
          </h3>
          {subValue !== undefined && (
            <p className="text-xs text-muted-foreground">
              {subValue.toLocaleString()} {subLabel}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 shadow-sm">
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
    <div className="fixed bottom-16 sm:bottom-10 left-1/2 -translate-x-1/2 bg-card border border-border px-4 py-3 rounded-2xl shadow-2xl z-[110] flex items-center gap-4 sm:gap-6 w-[92vw] max-w-lg">
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bulk Actions</span>
        <span className="text-xs sm:text-sm font-bold text-foreground truncate">{selectedCount} Selected</span>
      </div>
      <div className="h-8 w-px bg-border shrink-0" />
      <div className="flex gap-2 flex-1 justify-end">
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="bg-primary text-primary-foreground text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 min-h-[44px] touch-target"
        >
          {isProcessing ? "Processing..." : "Approve Now"}
          <CheckCircle className="w-4 h-4" />
        </button>
        <button
          onClick={onClear}
          className="bg-secondary text-muted-foreground hover:text-foreground text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors min-h-[44px] touch-target"
        >
          Deselect
        </button>
      </div>
    </div>
  );

  if (highPerformanceMode) return content;

  return (
    <div className="animate-fade-scale-in">
      {content}
    </div>
  );
}

function RequestMobileCard({ request, isSelected, onSelect, onRequestApprove, onEdit, onDelete }: any) {
  const router = useRouter();
  const { user, isSuperAdmin, isAdmin, isApprover, isSupervisor, canApproveInDepartment } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isOwner = request.requesterId === user?.id;
  const approvedCount = (request.approvals?.filter((a: any) => a.status === 'approved').length) || Number(request.approvedCount || 0);
  const isPaidOrDisbursed = ['fully_paid', 'partially_paid'].includes(request.status) || Number(request.paidAmount || 0) > 0;

  const canEdit =
    (isAdmin && !['fully_paid', 'archived'].includes(request.status)) ||
    (isOwner && (
      request.status === 'draft' ||
      request.status === 'changes_requested' ||
      (request.status === 'pending' && approvedCount === 0)
    ));

  // Request can only be deleted by the user who created it (until someone approved it) or superadmin (until amount is paid)
  const canDelete =
    (isSuperAdmin && !isPaidOrDisbursed) ||
    (isOwner && approvedCount === 0 && !isPaidOrDisbursed);

  const isSupervisorGate = request.status === "pending_dept_head";
  const canQuickApprove = !isSupervisor && (isSuperAdmin || isApprover) && (
    (
      (request.status === "pending" || request.status === "partially_approved" || request.status === "VARIATION_PENDING") &&
      Array.isArray(request.approvals) &&
      request.approvals.some((a: any) => a.status === 'pending' && (isSuperAdmin || canApproveInDepartment(a.department)))
    ) || (
      isSupervisorGate && (isSuperAdmin || canApproveInDepartment(request.department))
    )
  );

  return (
    <div className={`bg-card rounded-2xl border p-4 shadow-sm transition-all relative ${isSelected ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-border hover:border-brand-primary/20'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0">
          <input
            type="checkbox"
            aria-label={`Select request ${request.requestNumber}`}
            className="w-5 h-5 rounded-md border-border bg-secondary text-brand-primary focus:ring-brand-primary cursor-pointer mt-0.5 shrink-0"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
          />
          <div className="min-w-0">
            <span className="font-mono text-xs font-bold text-brand-secondary break-all">
              {request.requestNumber}
            </span>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {request.requester?.username} • {request.requester?.department}
            </div>
          </div>
        </div>
        <div className="self-start sm:self-auto pl-8 sm:pl-0">
          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="my-3 pl-8">
        <h4 className="font-semibold text-foreground text-sm leading-snug">
          {request.title}
        </h4>
        {request.subPurpose?.name && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
            <span className="truncate">{request.subPurpose.name}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border mt-3 pl-8">
        <div>
          <span className="text-[11px] font-semibold text-muted-foreground block">Estimated</span>
          <span className="text-base font-bold text-foreground">
            {request.totalEstimatedCost?.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">QAR</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/dashboard/requests/${request.id}`)}
            aria-label={`View details for request ${request.requestNumber}`}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm min-h-[44px] touch-target"
          >
            <Eye className="w-4 h-4" /> View
          </button>

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="More options for request"
              className="w-11 h-11 rounded-xl flex items-center justify-center border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground transition-colors touch-target"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-card border border-border rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden animate-in fade-in zoom-in-95">
                  {canQuickApprove && (
                    <button
                      onClick={() => { setIsMenuOpen(false); onRequestApprove(request); }}
                      className="w-full text-left px-3 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl flex items-center gap-2.5 min-h-[44px] touch-target"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve Request
                    </button>
                  )}
                  {(canEdit || canDelete) && (
                    <>
                      {canEdit && (
                        <button
                          onClick={() => { setIsMenuOpen(false); onEdit(); }}
                          className="w-full text-left px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary rounded-xl flex items-center gap-2.5 min-h-[44px] touch-target"
                        >
                          <Edit2 className="w-4 h-4" /> Edit Request
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => { setIsMenuOpen(false); onDelete(); }}
                          className="w-full text-left px-3 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl flex items-center gap-2.5 min-h-[44px] touch-target"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Request
                        </button>
                      )}
                      <div className="h-px bg-border my-1 mx-2" />
                    </>
                  )}
                  <button
                    onClick={() => { setIsMenuOpen(false); apiClient.documents.downloadPdf(request.id); }}
                    className="w-full text-left px-3 py-2.5 text-xs font-medium text-foreground hover:bg-secondary rounded-xl flex items-center gap-2.5 min-h-[44px] touch-target"
                  >
                    <FileText className="w-4 h-4" /> Download PDF
                  </button>
                  <button
                    onClick={() => { setIsMenuOpen(false); apiClient.documents.downloadZip(request.id); }}
                    className="w-full text-left px-3 py-2.5 text-xs font-medium text-foreground hover:bg-secondary rounded-xl flex items-center gap-2.5 min-h-[44px] touch-target"
                  >
                    <Archive className="w-4 h-4" /> Download ZIP
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestRow({ request, isSelected, onSelect, onApprove, onEdit, onDelete, awaitingMyApproval }: any) {
  const router = useRouter();
  const { highPerformanceMode } = usePerformance();
  const { user, isSuperAdmin, isAdmin, isApprover, isSupervisor, canApproveInDepartment } = useAuth();

  const isOwner = request.requesterId === user?.id;
  const approvedCount = (request.approvals?.filter((a: any) => a.status === 'approved').length) || Number(request.approvedCount || 0);
  const isPaidOrDisbursed = ['fully_paid', 'partially_paid'].includes(request.status) || Number(request.paidAmount || 0) > 0;

  const canEdit =
    (isAdmin && !['fully_paid', 'archived'].includes(request.status)) ||
    (isOwner && (
      request.status === 'draft' ||
      request.status === 'changes_requested' ||
      (request.status === 'pending' && approvedCount === 0)
    ));

  // Request can only be deleted by the user who created it (until someone approved it) or superadmin (until amount is paid)
  const canDelete =
    (isSuperAdmin && !isPaidOrDisbursed) ||
    (isOwner && approvedCount === 0 && !isPaidOrDisbursed);

  const isSupervisorGate = request.status === "pending_dept_head";
  const canQuickApprove = !isSupervisor && (isSuperAdmin || isApprover) && (
    (
      (request.status === "pending" || request.status === "partially_approved" || request.status === "VARIATION_PENDING") &&
      Array.isArray(request.approvals) &&
      request.approvals.some((a: any) => a.status === 'pending' && (isSuperAdmin || canApproveInDepartment(a.department)))
    ) || (
      isSupervisorGate && (isSuperAdmin || canApproveInDepartment(request.department))
    )
  );

  const rowClassName = `group hover:bg-white/[0.04] dark:hover:bg-white/[0.02] transition-all duration-300 hover:relative hover:z-50 ${isSelected ? 'bg-brand-primary/10' : ''}`;

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
        <div className="font-medium text-foreground transition-colors">{request.title}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {request.requester?.username} • {request.requester?.department}
          {request.subPurpose?.name && (
            <>
              <span className="mx-1.5 opacity-30">|</span>
              <span className="text-foreground">{request.subPurpose.name}</span>
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <StatusBadge status={request.status} />
          {awaitingMyApproval && (
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full w-max flex items-center gap-1">
              <span>⏳</span> Action Required
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-5 font-semibold text-foreground">
        {request.totalEstimatedCost?.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">QAR</span>
      </td>
      <td className="px-6 py-5 text-right overflow-visible">
        <div className="flex justify-end gap-2 items-center">
          {canQuickApprove && (
            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors text-xs font-medium"
              title="Quick Approve"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}

          <button
            onClick={() => router.push(`/dashboard/requests/${request.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-xs font-medium border border-border"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>

          <div className="relative group/menu z-10 hover:z-50">
            <button className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-md shadow-md opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 py-1 overflow-hidden">
              {(canEdit || canDelete) && (
                <>
                  {canEdit && (
                    <button onClick={onEdit} className="w-full text-left px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary flex items-center gap-2">
                      <Edit2 className="w-3.5 h-3.5" /> Edit Request
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-xs font-medium text-destructive hover:bg-secondary flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Request
                    </button>
                  )}
                </>
              )}
              <div className="h-px bg-border my-1 mx-2" />
              <button onClick={() => apiClient.documents.downloadPdf(request.id)} className="w-full text-left px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Download PDF
              </button>
              <button onClick={() => apiClient.documents.downloadZip(request.id)} className="w-full text-left px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary flex items-center gap-2">
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
  const normalized = (status || "").toLowerCase().trim();
  const configs: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    pending_dept_head: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]",
    approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    draft: "bg-secondary text-muted-foreground border-border",
    changes_requested: "bg-amber-600/10 text-amber-800 dark:text-amber-300 border-amber-600/30",
    partially_approved: "bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]",
    variation_pending: "bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/30",
  };

  const label = normalized === 'pending_dept_head' ? 'Pending Dept Head'
    : normalized === 'partially_approved' ? 'Partially Approved'
    : normalized === 'changes_requested' ? 'Changes Requested'
    : normalized === 'variation_pending' ? 'Variation Pending'
    : (status || "").replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${configs[normalized] || configs.draft}`}>
      {label}
    </span>
  );
}

function ActionBar({ onNewRequest }: { onNewRequest: () => void }) {
  const handleExportExcel = () => {
    toast.info("Generating corporate Excel report...");
    window.open("/api/export/excel", "_blank");
  };

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <button
        onClick={handleExportExcel}
        aria-label="Export corporate Excel report"
        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-secondary/80 hover:bg-secondary text-foreground text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-border shadow-sm transition-all min-h-[44px] touch-target"
        title="Export Corporate Excel Report"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="truncate">Export</span>
      </button>
      <button
        onClick={onNewRequest}
        aria-label="Create new purchase request"
        className="flex-[2] sm:flex-initial flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:bg-primary/90 transition-colors min-h-[44px] touch-target"
      >
        <PlusCircle className="w-4 h-4 shrink-0" />
        <span className="truncate">New Request</span>
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
