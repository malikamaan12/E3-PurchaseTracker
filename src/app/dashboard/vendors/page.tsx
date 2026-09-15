"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Plus,
  Upload,
  CheckCircle2,
  Mail,
  Phone,
  Search,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  Wallet,
  ChevronRight,
  Globe,
  Clock,
  Edit3,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { VendorManagementModal } from "@/components/vendors/VendorManagementModal";
import { VendorDocumentsModal } from "@/components/vendors/VendorDocumentsModal";
import { VendorInviteModal } from "@/components/vendors/VendorInviteModal";
import { VendorDraftReviewDrawer } from "@/components/vendors/VendorDraftReviewDrawer";
import { VendorComplianceCasesModal } from "@/components/vendors/VendorComplianceCasesModal";
import { VendorGracePeriodModal } from "@/components/vendors/VendorGracePeriodModal";
import { VendorOnboardingBadge } from "@/components/vendors/VendorOnboardingBadge";
import { VendorQuickCreateModal } from "@/components/vendors/VendorQuickCreateModal";
import { VendorRuleMatrixModal } from "@/components/vendors/VendorRuleMatrixModal";
import { VendorComplianceMatrixGrid } from "@/components/vendors/VendorComplianceMatrixGrid";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { StarRating } from "@/components/shared/StarRating";
import { VendorListView } from "@/components/vendors/VendorListView";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { Sliders, Sparkles } from "lucide-react";
import { featureFlags } from "@/lib/config/featureFlags";

function safeFormatDate(date: any, format: string) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString();
}

export default function VendorsDashboard() {
  usePageTitle("Vendor Matrix");
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isRuleMatrixOpen, setIsRuleMatrixOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"approved" | "matrix" | "drafts">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Auto-trigger Quick-Create modal if navigated with ?quickCreate=1
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("quickCreate") === "1" || params.get("quickCreate") === "true") {
        setIsQuickCreateOpen(true);
        params.delete("quickCreate");
        const newQuery = params.toString();
        const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, []);

  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedVendorForDocs, setSelectedVendorForDocs] = useState<any>(null);
  const [selectedVendorForCases, setSelectedVendorForCases] = useState<any>(null);
  const [selectedVendorForGrace, setSelectedVendorForGrace] = useState<any>(null);
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState<any>(null);
  const [vendorToDelete, setVendorToDelete] = useState<any>(null);

  const canManageVendors = isAdmin || isSuperAdmin || (user as any)?.canManageVendors === true;

  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ["vendor_drafts"],
    queryFn: async () => {
      const res = await fetch("/api/vendors/drafts");
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j?.drafts) ? j.drafts : [];
    },
    enabled: !!isAdmin,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: vendors, isLoading, isError, error, refetch: refetchVendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiClient.vendors.list(),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "blocked" | "frozen" }) =>
      apiClient.vendors.patchStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor status updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: number }) =>
      apiClient.vendors.rate(id, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor rated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit rating"),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: number) => apiClient.vendors.delete(id),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor_matrix"] });
      toast.success(data?.message || "Vendor deleted successfully");
      setVendorToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete vendor", { duration: 6000 });
      setVendorToDelete(null);
    },
  });

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];

    let processed = vendors;
    if (statusFilter !== "All") {
      processed = vendors.filter((v: any) => v.status.toLowerCase() === statusFilter.toLowerCase());
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return processed;

    return processed.filter((v: any) =>
      v.companyName?.toLowerCase().includes(query) ||
      v.email?.toLowerCase().includes(query) ||
      v.contactPerson?.toLowerCase().includes(query) ||
      v.registrationNumber?.toLowerCase().includes(query) ||
      v.taxNumber?.toLowerCase().includes(query) ||
      v.bankName?.toLowerCase().includes(query) ||
      v.address?.toLowerCase().includes(query)
    );
  }, [vendors, searchQuery, statusFilter]);

  if (isLoading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 mx-auto w-full max-w-7xl">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-8">
        <div className="space-y-1.5 relative">
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground relative z-10">Vendor Ecosystem</h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-widest">Global Supplier Matrix & Compliance Hub</p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full md:w-auto">
          <div className="flex bg-secondary/50 p-1.5 rounded-xl border border-border/50 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Grid View"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-all touch-target ${viewMode === "grid" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List View"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-all touch-target ${viewMode === "list" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Quick-Create Vendor (Universal - every authenticated employee) */}
          <button
            onClick={() => setIsQuickCreateOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:opacity-95 font-bold px-4 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all shrink-0 min-h-[44px] touch-target text-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Quick-Create Vendor</span>
          </button>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {isSuperAdmin && featureFlags.FF_DYNAMIC_COMPLIANCE_ENGINE && (
                <button
                  onClick={() => setIsRuleMatrixOpen(true)}
                  className="flex items-center justify-center gap-1.5 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold px-3.5 py-2.5 rounded-xl transition-all shrink-0 min-h-[44px] touch-target text-sm"
                  title="Configure Compliance Rules"
                >
                  <Sliders className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Rule Matrix</span>
                </button>
              )}

              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold px-3.5 py-2.5 rounded-xl transition-all shrink-0 min-h-[44px] touch-target text-sm"
              >
                <Mail className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex items-center gap-3 border-b border-border pb-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("approved")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === "approved"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Approved Directory</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
            activeTab === "approved" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}>
            {vendors?.length || 0}
          </span>
        </button>

        {featureFlags.FF_COMPLIANCE_MATRIX_UI && (
          <button
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === "matrix"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Compliance Matrix (Grid)</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab("drafts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === "drafts"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Onboarding Pipeline</span>
            {drafts.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500 text-white animate-pulse">
                {drafts.length}
              </span>
            )}
          </button>
        )}
      </div>

      {activeTab === "matrix" ? (
        <VendorComplianceMatrixGrid />
      ) : activeTab === "drafts" && isAdmin ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Self-Service Onboarding Pipeline</h2>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Invite Another Vendor
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="py-16 border-2 border-dashed border-border/50 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Building2 className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm font-bold text-foreground">No active onboarding drafts</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Generate an invitation link to onboard a new vendor via self-service.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((draft: any) => (
                <div
                  key={draft.id}
                  onClick={() => setSelectedDraftId(draft.id)}
                  className="bg-card border border-border/70 hover:border-primary/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors truncate">
                        {draft.companyName}
                      </h3>
                      <VendorOnboardingBadge status={draft.onboardingStatus} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{draft.contactPerson} • {draft.email}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-[11px] text-muted-foreground">
                    <span>{draft.vendorType === "freelancer" ? "Freelancer" : "Company"}</span>
                    <span className="text-primary font-semibold group-hover:underline flex items-center gap-0.5">
                      Review Draft <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <section className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Entity Name, IBAN, Tax ID, or Contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar py-1">
              {["All", "Active", "Blocked", "Frozen"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {isError ? (
            <div className="py-16 border-2 border-dashed border-destructive/30 bg-destructive/5 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-destructive">
              <ShieldAlert className="w-10 h-10 mb-3 opacity-80" />
              <p className="text-sm font-bold text-foreground">Failed to Load Vendor Matrix</p>
              <button
                type="button"
                onClick={() => refetchVendors()}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Retry Matrix Sync
              </button>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="py-16 border-2 border-dashed border-border/50 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Building2 className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm font-bold text-foreground">No matching vendors found</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-6">
              {filteredVendors.map((vendor: any, idx: number) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  index={idx}
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                  canManage={canManageVendors}
                  onEdit={() => setSelectedVendorForEdit(vendor)}
                  onDelete={() => setVendorToDelete(vendor)}
                  onStatusChange={(status) => statusMutation.mutate({ id: vendor.id, status })}
                  onRate={(r) => rateMutation.mutate({ id: vendor.id, rating: r })}
                  onOpenDocs={() => setSelectedVendorForDocs(vendor)}
                  onOpenCases={() => setSelectedVendorForCases(vendor)}
                  onOpenGrace={() => setSelectedVendorForGrace(vendor)}
                />
              ))}
            </div>
          ) : (
            <div>
              <VendorListView
                vendors={filteredVendors}
                isAdmin={isAdmin}
                canManage={canManageVendors}
                onEdit={(vendor) => setSelectedVendorForEdit(vendor)}
                onDelete={(vendor) => setVendorToDelete(vendor)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status: status as any })}
                onRate={(id, r) => rateMutation.mutate({ id, rating: r })}
              />
            </div>
          )}
        </>
      )}

      {selectedVendorForDocs && (
        <VendorDocumentsModal
          open={!!selectedVendorForDocs}
          onOpenChange={(open: boolean) => !open && setSelectedVendorForDocs(null)}
          vendor={selectedVendorForDocs}
        />
      )}

      {selectedVendorForCases && (
        <VendorComplianceCasesModal
          isOpen={!!selectedVendorForCases}
          onClose={() => setSelectedVendorForCases(null)}
          vendorId={selectedVendorForCases.id}
          vendorName={selectedVendorForCases.companyName}
          vendorType={selectedVendorForCases.vendorType || "company"}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {selectedVendorForGrace && (
        <VendorGracePeriodModal
          isOpen={!!selectedVendorForGrace}
          onClose={() => setSelectedVendorForGrace(null)}
          vendorId={selectedVendorForGrace.id}
          vendorName={selectedVendorForGrace.companyName}
          currentDeadline={selectedVendorForGrace.gracePeriodDeadline}
        />
      )}

      {selectedVendorForEdit && (
        <VendorManagementModal
          open={!!selectedVendorForEdit}
          onOpenChange={(open: boolean) => !open && setSelectedVendorForEdit(null)}
          vendor={selectedVendorForEdit}
        />
      )}

      {vendorToDelete && (
        <Dialog.Root open={!!vendorToDelete} onOpenChange={(open) => !open && setVendorToDelete(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-all" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] sm:max-w-md bg-card p-6 md:p-7 border border-border rounded-3xl shadow-2xl z-[101] focus:outline-none">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-sm">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <Dialog.Title className="text-lg font-bold text-foreground tracking-tight">
                    Delete Supplier
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to remove <strong className="text-foreground">{vendorToDelete.companyName}</strong> from the system?
                  </Dialog.Description>
                </div>
              </div>

              <div className="mt-4 p-3 bg-secondary/40 rounded-2xl border border-border/50 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">Audit Protection Policy:</p>
                Vendors that are already assigned to active Purchase Requests, Purchase Orders, or Payments cannot be deleted to maintain compliance records. Only unassigned or mistaken vendors will be deleted.
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  disabled={deleteVendorMutation.isPending}
                  onClick={() => setVendorToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteVendorMutation.isPending}
                  onClick={() => deleteVendorMutation.mutate(vendorToDelete.id)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-2"
                >
                  {deleteVendorMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Vendor</span>
                    </>
                  )}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <VendorInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => {
          refetchDrafts();
          queryClient.invalidateQueries({ queryKey: ["vendors"] });
        }}
      />

      <VendorDraftReviewDrawer
        draftId={selectedDraftId}
        isOpen={!!selectedDraftId}
        onClose={() => setSelectedDraftId(null)}
        onRefresh={() => {
          refetchDrafts();
          queryClient.invalidateQueries({ queryKey: ["vendors"] });
        }}
      />

      <VendorQuickCreateModal
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
        onVendorCreated={() => {
          refetchVendors();
          queryClient.invalidateQueries({ queryKey: ["vendors"] });
        }}
      />

      <VendorRuleMatrixModal
        open={isRuleMatrixOpen}
        onOpenChange={setIsRuleMatrixOpen}
      />

      <section className="mt-8 space-y-6">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Compliance Document Gateway</h2>
        </div>
        <div className="bg-secondary/30 h-48 border-dashed border-2 border-border/50 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-colors group cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-background/50 border border-border/50 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-foreground font-semibold">Drop regulatory files here</p>
            <p className="text-muted-foreground text-sm">PDF, XLSX, or DOCX (Max 10MB)</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function VendorCard({
  vendor,
  isAdmin,
  isSuperAdmin,
  canManage = false,
  onEdit,
  onDelete,
  onStatusChange,
  onRate,
  onOpenDocs,
  onOpenCases,
  onOpenGrace,
  index
}: {
  vendor: any;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange: (s: any) => void;
  onRate: (r: number) => void;
  onOpenDocs: () => void;
  onOpenCases: () => void;
  onOpenGrace: () => void;
  index: number;
}) {
  const statusColors: any = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    blocked: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    frozen: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };

  const rawIban = vendor.ibanNumber || "";
  const maskedIban = rawIban.length > 6
    ? `${rawIban.slice(0, 2)}•• •••• •••• ${rawIban.slice(-4)}`
    : "••••";

  const compStatus = (vendor.complianceStatus || "unassessed").toLowerCase();
  const complianceConfig: Record<string, { label: string; color: string; bg: string }> = {
    compliant: { label: "Compliant", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    expiring_soon: { label: "Expiring Soon", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    non_compliant: { label: "Non-Compliant", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    grace_period: { label: "Grace Period", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    legacy_pending_assessment: { label: "Pending Assessment", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    unassessed: { label: "Unassessed", color: "text-muted-foreground", bg: "bg-secondary border-border" },
    compliance_not_applicable: { label: "Exempt / N/A", color: "text-muted-foreground", bg: "bg-secondary border-border" },
  };

  const compBadge = complianceConfig[compStatus] || complianceConfig.unassessed;

  return (
    <div
      className="bg-card border border-border/70 hover:border-primary/40 rounded-3xl transition-all shadow-md hover:shadow-xl flex flex-col justify-between overflow-hidden group"
    >
      <div className="p-5 sm:p-6 relative">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-secondary/60 flex items-center justify-center border border-border shadow-xs group-hover:scale-105 group-hover:border-primary/30 transition-all duration-300 overflow-hidden relative shrink-0">
               <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary drop-shadow-xs" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors truncate" title={vendor.companyName}>{vendor.companyName}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-md border border-primary/20 shrink-0">
                  {vendor.vendorType === "freelancer" ? "FREELANCER" : "COMPANY"}
                </span>
                <span className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-md border shrink-0 ${compBadge.bg} ${compBadge.color}`}>
                  {compBadge.label}
                </span>
                <StarRating rating={vendor.rating} onRate={onRate} size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-5">
           <ContactItem icon={<Mail className="w-3.5 h-3.5" />} label="Identity" value={vendor.email} theme="emerald" />
           <ContactItem icon={<Phone className="w-3.5 h-3.5" />} label="Hotline" value={vendor.contactNumber} theme="emerald" />
           <ContactItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="TAX/VAT" value={vendor.taxNumber || "UNREGISTERED"} theme="primary" />
           <ContactItem icon={<Globe className="w-3.5 h-3.5" />} label="Reg. ID" value={vendor.registrationNumber || "PENDING"} theme="primary" />
        </div>
      </div>

      <div className="px-5 sm:px-6 py-3.5 bg-secondary/30 border-y border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
         <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shadow-xs shrink-0">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Base of Operations</p>
               <p className="text-xs text-foreground font-medium truncate" title={vendor.address}>{vendor.address || "Not specified"}</p>
            </div>
         </div>
         <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shadow-xs shrink-0">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bank IBAN</p>
               <p className="text-xs text-foreground font-medium truncate" title={vendor.bankName}>{vendor.bankName || "Bank"} — <span className="font-mono text-foreground font-semibold text-[11px]">{maskedIban}</span></p>
            </div>
         </div>
      </div>

      <div className="px-5 sm:px-6 py-3 bg-background flex flex-wrap justify-between items-center gap-2 min-h-[50px]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenDocs}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border/60 transition-colors"
          >
            Manage Files
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenCases}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Compliance Cases</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={onOpenGrace}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-800 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Extend Grace</span>
            </button>
          )}

          {canManage && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-foreground hover:text-primary bg-secondary/80 hover:bg-secondary border border-border transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Edit Vendor Details"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary" />
              <span>Edit</span>
            </button>
          )}

          {canManage && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Delete Vendor (if not assigned to projects)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>

        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-xs ${statusColors[vendor.status]}`}>
          {vendor.status}
        </div>
      </div>
    </div>
  );
}

function ContactItem({ icon, label, value, theme }: { icon: any; label: string; value: string; theme: 'emerald' | 'primary' }) {
  const themes = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    primary: "text-primary bg-primary/10 border-primary/20"
  };

  return (
    <div className="space-y-1.5 p-3 rounded-2xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors cursor-default">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">{label}</p>
        <div className={`${themes[theme]} p-1 rounded-md border`}>{icon}</div>
      </div>
      <p className="text-xs text-foreground font-semibold truncate pt-1">{value}</p>
    </div>
  );
}


function StatusToggle({ current, onChange }: { current: string; onChange: (s: any) => void }) {
  const options = [
    { value: "active", icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "Active" },
    { value: "blocked", icon: <ShieldAlert className="w-3.5 h-3.5" />, label: "Block" },
    { value: "frozen", icon: <ShieldOff className="w-3.5 h-3.5" />, label: "Freeze" },
  ];

  return (
    <div className="flex gap-1 bg-secondary p-1 rounded-xl border border-border shadow-inner">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`p-1.5 rounded-lg transition-all ${current === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          title={opt.label}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-8 w-full h-[60vh] justify-center items-center">
      <div
        className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center shadow-sm animate-pulse"
      >
         <Building2 className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest animate-pulse">Syncing Entity Matrix...</p>
    </div>
  );
}
