"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useState, lazy, useMemo, useEffect, useRef, Suspense } from "react";
import {
  FileText,
  Download,
  CheckCircle,
  Check,
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
  Clock,
  Inbox
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { RequestFilters } from "@/components/requests/RequestFilters";
import { DeleteRequestDialog } from "@/components/requests/DeleteRequestDialog";
import { pageLoad } from "@/lib/animations";
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

  // Status counts for dynamic filter tabs
  const statusCounts = useMemo(() => {
    const list = requests || [];
    const pending = list.filter((r: any) =>
      ['pending', 'partially_approved', 'pending_dept_head', 'variation_pending'].includes((r.status || '').toLowerCase())
    ).length;
    const approved = list.filter((r: any) =>
      ['approved', 'fully_paid'].includes((r.status || '').toLowerCase())
    ).length;
    const rejected = list.filter((r: any) =>
      (r.status || '').toLowerCase() === 'rejected'
    ).length;
    return {
      all: list.length,
      pending,
      approved,
      rejected,
      myQueue: myQueueRequests.length
    };
  }, [requests, myQueueRequests]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 md:gap-7 w-full max-w-full">
      <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground">Purchase Requests</h1>
            {isApprover && myQueueRequests.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
                <span>⏳</span> {myQueueRequests.length} Pending Your Review
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage procurement lifecycle, approval workflows, and expenditure records.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Approver My Queue Quick Toggle */}
          {isApprover && (
            <div className="flex p-1 bg-secondary/80 border border-border/80 rounded-xl shadow-xs shrink-0">
              <button
                onClick={() => setMyQueueMode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !myQueueMode
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All PRs
              </button>
              <button
                onClick={() => setMyQueueMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  myQueueMode
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                <span>⏳</span> My Queue
                {myQueueRequests.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    myQueueMode ? "bg-white/30 text-white" : "bg-amber-500 text-white"
                  }`}>
                    {myQueueRequests.length}
                  </span>
                )}
              </button>
            </div>
          )}

          <ActionBar onNewRequest={() => setIsCreateModalOpen(true)} />
        </div>
      </header>

      <SpendAnalytics data={analytics} isLoading={analyticsLoading} />

      <RequestFilters
        filters={filters}
        setFilters={setFilters}
        metadata={{ departments, vendors, purposes, subPurposes }}
        counts={statusCounts}
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
      {confirmApprovalRequest && (() => {
        const isAlreadyFullyApproved = ['approved', 'fully_paid'].includes(confirmApprovalRequest.status?.toLowerCase());
        const allApprovalsApproved = Array.isArray(confirmApprovalRequest.approvals) && confirmApprovalRequest.approvals.length > 0 &&
          confirmApprovalRequest.approvals.every((a: any) => a.status === 'approved');
        const isApproved = isAlreadyFullyApproved || allApprovalsApproved;

        const myDeptApproval = Array.isArray(confirmApprovalRequest.approvals) 
          ? confirmApprovalRequest.approvals.find((a: any) => canApproveInDepartment(a.department))
          : null;
        const isMyDeptAlreadyApproved = !isSuperAdmin && myDeptApproval && myDeptApproval.status === 'approved';

        return (
          <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isApproved 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : isMyDeptAlreadyApproved
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-foreground">
                    {isApproved 
                      ? "Request Fully Approved" 
                      : isMyDeptAlreadyApproved
                      ? "Already Approved by Your Department"
                      : "Confirm Request Approval"}
                  </h3>
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

              {isApproved ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-foreground mb-0.5">All approval stages are complete.</span>
                    This purchase request has already received all necessary management, departmental, and executive sign-offs. No further approvals are pending.
                  </div>
                </div>
              ) : isMyDeptAlreadyApproved ? (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-foreground mb-0.5">Your department has already approved.</span>
                    Your approval slot is marked as approved. The request is currently awaiting remaining department approvers in the workflow chain.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to approve this purchase request? This action will record your departmental sign-off and advance the request in the procurement cycle.
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmApprovalRequest(null)}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 font-semibold text-xs min-h-[44px] touch-target"
                >
                  {isApproved || isMyDeptAlreadyApproved ? "Close" : "Cancel"}
                </button>
                {!(isApproved || isMyDeptAlreadyApproved) && (
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(confirmApprovalRequest.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm min-h-[44px] touch-target flex items-center gap-1.5"
                  >
                    {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
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
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-card border border-border animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

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

  const approvedAmount = overview ? overview.fullyApprovedAmount : getStatusSum('approved', 'fully_paid').totalValue;
  const approvedCount = overview ? overview.fullyApprovedCount : getStatusSum('approved', 'fully_paid').count;

  // In-flight / pending volume = pending + partially_approved requests
  const pendingStat = getStatusSum('pending', 'partially_approved', 'pending_dept_head', 'variation_pending');
  const pendingAmount = overview
    ? (overview.partiallyApprovedAmount + (kpis.find((k: any) => k.status === 'pending')?.totalValue || 0))
    : pendingStat.totalValue;
  const pendingCount = overview
    ? (overview.partiallyApprovedCount + (kpis.find((k: any) => k.status === 'pending')?.count || 0))
    : pendingStat.count;

  // Active count = pending + partially_approved + approved + variation_pending + changes_requested
  const activeCount = overview
    ? overview.activeRequestsCount
    : getStatusSum('pending', 'partially_approved', 'approved', 'fully_paid', 'variation_pending', 'changes_requested').count;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <AnalyticsCard
        label="Total Approved"
        value={approvedAmount}
        suffix="QAR"
        subValue={approvedCount}
        subLabel="approved requests"
        icon={<TrendingUp className="text-emerald-500 w-5 h-5" />}
        gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
        iconBg="bg-emerald-500/10 border-emerald-500/20"
      />
      <AnalyticsCard
        label="Pending Decisions"
        value={pendingAmount}
        suffix="QAR"
        subValue={pendingCount}
        subLabel="pending requests"
        icon={<BarChart3 className="text-amber-500 w-5 h-5" />}
        gradient="from-amber-500/10 via-amber-500/5 to-transparent"
        iconBg="bg-amber-500/10 border-amber-500/20"
      />
      <AnalyticsCard
        label="Active Requests"
        value={activeCount}
        suffix="REQ"
        subValue={activeCount}
        subLabel="in active workflow"
        icon={<FileSpreadsheet className="text-primary w-5 h-5" />}
        gradient="from-primary/10 via-primary/5 to-transparent"
        iconBg="bg-primary/10 border-primary/20"
      />
      <AnalyticsCard
        label="Awaiting Sign-offs"
        value={pendingCount}
        suffix="REQ"
        subValue={pendingCount}
        subLabel="awaiting decision"
        icon={<Clock className="text-amber-500 w-5 h-5" />}
        gradient="from-orange-500/10 via-orange-500/5 to-transparent"
        iconBg="bg-orange-500/10 border-orange-500/20"
      />
    </div>
  );
}

function AnalyticsCard({ label, value, suffix = "", subValue, subLabel, icon, gradient, iconBg }: any) {
  return (
    <div className={`bg-card border border-border p-4 sm:p-5 rounded-2xl relative overflow-hidden shadow-xs flex flex-col justify-between hover:border-primary/30 transition-all bg-gradient-to-br ${gradient || 'from-secondary/30 to-transparent'} min-h-[110px]`}>
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground truncate">{label}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-baseline gap-1.5 mt-0.5">
            {Number(value || 0).toLocaleString()}
            {suffix && <span className="text-xs text-muted-foreground font-semibold">{suffix}</span>}
          </h3>
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1 truncate">
            {subValue !== undefined && (
              <span className="font-bold text-foreground/90">{Number(subValue || 0).toLocaleString()}</span>
            )}
            <span>{subLabel}</span>
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs ${iconBg || 'bg-secondary border-border'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AmountWithPaymentHover({
  totalAmount,
  paidAmount = 0,
  currency = "QAR",
}: {
  totalAmount: number;
  paidAmount?: number;
  currency?: string;
}) {
  const total = Number(totalAmount || 0);
  const paid = Number(paidAmount || 0);
  const balance = Math.max(0, total - paid);
  const percentage = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const paymentStatus =
    paid >= total && total > 0 ? "Fully Settled" :
    paid > 0 ? "Partially Paid" : "Unpaid";

  const statusStyle =
    paymentStatus === "Fully Settled" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
    paymentStatus === "Partially Paid" ? "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" :
    "text-muted-foreground bg-secondary/80 border-border";

  return (
    <div className="relative group/amt inline-block cursor-help py-1">
      <div className="flex items-baseline gap-1 font-semibold text-foreground">
        <span>{total.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground font-normal">{currency}</span>
        {paid > 0 && (
          <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" title="Payments recorded" />
        )}
      </div>

      {/* Popover Breakdown on Hover */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/amt:flex flex-col w-60 p-3.5 rounded-2xl bg-card/98 border border-border shadow-2xl z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-border mb-2.5">
          <span className="font-bold text-[11px] text-foreground uppercase tracking-wider">Payment Breakdown</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle}`}>
            {paymentStatus}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Total PR Cost:</span>
            <span className="text-foreground font-semibold">{total.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span className="font-medium">Paid Amount:</span>
            <span className="font-bold">{paid.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-between text-amber-600 dark:text-amber-400">
            <span className="font-medium">Balance Payment:</span>
            <span className="font-bold">{balance.toLocaleString()} {currency}</span>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-3 pt-2 border-t border-border/80">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Settlement Progress</span>
            <span className="font-mono font-bold text-foreground">{percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
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

  const isOwner = request.requesterId === user?.id;
  const approvedCount = (request.approvals?.filter((a: any) => a.status === 'approved').length) || Number(request.approvedCount || 0);
  const isPaidOrDisbursed = ['fully_paid', 'partially_paid'].includes(request.status) || Number(request.paidAmount || 0) > 0;

  const isFullyApproved = ['approved', 'fully_paid'].includes((request.status || '').toLowerCase()) ||
    (Array.isArray(request.approvals) && request.approvals.length > 0 && request.approvals.every((a: any) => a.status === 'approved'));

  const myDeptApproval = Array.isArray(request.approvals)
    ? request.approvals.find((a: any) => canApproveInDepartment(a.department))
    : null;
  const isMyDeptSignedOff = !isSuperAdmin && myDeptApproval && myDeptApproval.status === 'approved';

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
  const canQuickApprove = !isSupervisor && (isSuperAdmin || isApprover) && !isFullyApproved && (
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
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20 break-all inline-block">
              {request.requestNumber}
            </span>
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {request.requester?.username} • {request.requester?.department}
              {request.vendor?.name && ` • ${request.vendor.name}`}
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
          <AmountWithPaymentHover
            totalAmount={request.totalEstimatedCost}
            paidAmount={request.paidAmount}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/dashboard/requests/${request.id}`)}
            aria-label={`View details for request ${request.requestNumber}`}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm min-h-[44px] touch-target"
          >
            <Eye className="w-4 h-4" /> View
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More options for request"
                className="w-11 h-11 rounded-xl flex items-center justify-center border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors touch-target"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canQuickApprove && (
                <DropdownMenuItem onClick={() => onRequestApprove(request)} className="text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve Request
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Request
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Request
                </DropdownMenuItem>
              )}
              {(canQuickApprove || canEdit || canDelete) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => apiClient.documents.downloadPdf(request.id)}>
                <FileText className="w-4 h-4 mr-2" /> Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => apiClient.documents.downloadZip(request.id)}>
                <Archive className="w-4 h-4 mr-2" /> Download ZIP
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

  const isFullyApproved = ['approved', 'fully_paid'].includes((request.status || '').toLowerCase()) ||
    (Array.isArray(request.approvals) && request.approvals.length > 0 && request.approvals.every((a: any) => a.status === 'approved'));

  const myDeptApproval = Array.isArray(request.approvals)
    ? request.approvals.find((a: any) => canApproveInDepartment(a.department))
    : null;
  const isMyDeptSignedOff = !isSuperAdmin && myDeptApproval && myDeptApproval.status === 'approved';

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
  const canQuickApprove = !isSupervisor && (isSuperAdmin || isApprover) && !isFullyApproved && (
    (
      (request.status === "pending" || request.status === "partially_approved" || request.status === "VARIATION_PENDING") &&
      Array.isArray(request.approvals) &&
      request.approvals.some((a: any) => a.status === 'pending' && (isSuperAdmin || canApproveInDepartment(a.department)))
    ) || (
      isSupervisorGate && (isSuperAdmin || canApproveInDepartment(request.department))
    )
  );

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
      <td className="px-6 py-5 whitespace-nowrap">
        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
          {request.requestNumber}
        </span>
      </td>
      <td className="px-6 py-5">
        <div className="font-medium text-foreground transition-colors">{request.title}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {request.requester?.username} • {request.requester?.department}
          {request.vendor?.name && (
            <>
              <span className="mx-1.5 opacity-30">|</span>
              <span className="text-foreground/80 font-medium">{request.vendor.name}</span>
            </>
          )}
          {request.subPurpose?.name && (
            <>
              <span className="mx-1.5 opacity-30">|</span>
              <span className="text-foreground">{request.subPurpose.name}</span>
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-5 whitespace-nowrap">
        <div className="flex flex-col gap-1.5">
          <StatusBadge status={request.status} />
          {awaitingMyApproval && !isFullyApproved && (
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full w-max flex items-center gap-1">
              <span>⏳</span> Action Required
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-5 whitespace-nowrap">
        <AmountWithPaymentHover
          totalAmount={request.totalEstimatedCost}
          paidAmount={request.paidAmount}
        />
      </td>
      <td className="px-6 py-5 text-right whitespace-nowrap">
        <div className="flex justify-end gap-2 items-center shrink-0">
          {canQuickApprove && (
            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors text-xs font-semibold shadow-xs"
              title="Quick Approve"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}

          {!canQuickApprove && isFullyApproved && (
            <span
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20 shadow-xs"
              title="All approval stages are complete for this request."
            >
              <CheckCircle className="w-3.5 h-3.5" /> Fully Approved
            </span>
          )}

          {!canQuickApprove && !isFullyApproved && isMyDeptSignedOff && (
            <span
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-500/20"
              title="Your department has already approved this stage."
            >
              <Check className="w-3.5 h-3.5" /> Signed Off
            </span>
          )}

          <button
            onClick={() => router.push(`/dashboard/requests/${request.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-xs font-medium border border-border shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More options"
                className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canQuickApprove && (
                <DropdownMenuItem onClick={onApprove} className="text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle className="w-3.5 h-3.5 mr-2" /> Approve Request
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Request
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-rose-500 focus:text-rose-500">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Request
                </DropdownMenuItem>
              )}
              {(canQuickApprove || canEdit || canDelete) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => apiClient.documents.downloadPdf(request.id)}>
                <FileText className="w-3.5 h-3.5 mr-2" /> Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => apiClient.documents.downloadZip(request.id)}>
                <Archive className="w-3.5 h-3.5 mr-2" /> Download ZIP
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
  const configs: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
    pending: {
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      icon: <Clock className="w-3 h-3 text-amber-500" />,
      label: "Pending"
    },
    pending_dept_head: {
      className: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/30",
      icon: <Clock className="w-3 h-3 text-cyan-500" />,
      label: "Pending Dept Head"
    },
    approved: {
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      icon: <CheckCircle className="w-3 h-3 text-emerald-500" />,
      label: "Approved"
    },
    fully_paid: {
      className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
      icon: <CheckCircle className="w-3 h-3 text-emerald-500" />,
      label: "Fully Settled"
    },
    partially_paid: {
      className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
      icon: <Clock className="w-3 h-3 text-indigo-500" />,
      label: "Partially Paid"
    },
    rejected: {
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      icon: <XCircle className="w-3 h-3 text-rose-500" />,
      label: "Rejected"
    },
    draft: {
      className: "bg-secondary text-muted-foreground border-border",
      icon: <Clock className="w-3 h-3 text-muted-foreground" />,
      label: "Draft"
    },
    changes_requested: {
      className: "bg-amber-600/10 text-amber-800 dark:text-amber-300 border-amber-600/30",
      icon: <Clock className="w-3 h-3 text-amber-600" />,
      label: "Changes Requested"
    },
    partially_approved: {
      className: "bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/30",
      icon: <Clock className="w-3 h-3 text-teal-500" />,
      label: "Partially Approved"
    },
    variation_pending: {
      className: "bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/30",
      icon: <Clock className="w-3 h-3 text-orange-500" />,
      label: "Variation Pending"
    },
  };

  const current = configs[normalized] || {
    className: "bg-secondary text-muted-foreground border-border",
    icon: <Clock className="w-3 h-3 text-muted-foreground" />,
    label: (status || "").replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs ${current.className}`}>
      {current.icon}
      <span>{current.label}</span>
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
