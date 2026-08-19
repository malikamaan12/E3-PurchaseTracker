"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Clock
} from "lucide-react";
import { toast } from "sonner";
import * as Tabs from "@radix-ui/react-tabs";
import { VendorManagementModal } from "@/components/vendors/VendorManagementModal";
import { VendorDocumentsModal } from "@/components/vendors/VendorDocumentsModal";
import { VendorInviteModal } from "@/components/vendors/VendorInviteModal";
import { VendorDraftReviewDrawer } from "@/components/vendors/VendorDraftReviewDrawer";
import { VendorComplianceCasesModal } from "@/components/vendors/VendorComplianceCasesModal";
import { VendorGracePeriodModal } from "@/components/vendors/VendorGracePeriodModal";
import { VendorOnboardingBadge } from "@/components/vendors/VendorOnboardingBadge";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { StarRating } from "@/components/shared/StarRating";
import { VendorListView } from "@/components/vendors/VendorListView";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

function safeFormatDate(date: any, format: string) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString();
}

export default function VendorsDashboard() {
  usePageTitle("Vendor Matrix");
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"approved" | "drafts">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [statusFilter, setStatusFilter] = useState("All");

  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ["vendor_drafts"],
    queryFn: async () => {
      const res = await fetch("/api/vendors/drafts");
      const j = await res.json();
      return j.drafts || [];
    },
    enabled: !!isAdmin,
  });

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiClient.vendors.list(),
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

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
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

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold px-4 py-2.5 rounded-xl transition-all shrink-0 min-h-[44px] touch-target text-sm"
              >
                <Mail className="w-4 h-4 text-primary" />
                <span>Invite Vendor</span>
              </button>

              <button
                onClick={() => setIsOnboarding(true)}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-primary/20 shrink-0 min-h-[44px] touch-target text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Supplier</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <Tabs.Root value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <Tabs.List className="flex gap-2 border-b border-border/50 pb-2">
          <Tabs.Trigger
            value="approved"
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] touch-target ${activeTab === "approved" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}
          >
            Approved Directory ({vendors?.length || 0})
          </Tabs.Trigger>
          {isAdmin && (
            <Tabs.Trigger
              value="drafts"
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] touch-target flex items-center gap-2 ${activeTab === "drafts" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}
            >
              <span>Onboarding Pipeline</span>
              {drafts.length > 0 && (
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {drafts.length}
                </span>
              )}
            </Tabs.Trigger>
          )}
        </Tabs.List>
      </Tabs.Root>

      {activeTab === "drafts" && isAdmin ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-foreground">Self-Service Onboarding Queue</h3>
            <span className="text-xs text-muted-foreground">Pending vendor submissions & review</span>
          </div>

          {drafts.length === 0 ? (
            <div className="py-16 border-2 border-dashed border-border/50 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Mail className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm font-bold text-foreground">No active onboarding drafts</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">Use "Invite Vendor" to generate a 24-hour self-service onboarding link.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map((draft: any) => (
                <div
                  key={draft.id}
                  className="bg-card/70 border border-border/50 hover:border-primary/30 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-base text-foreground leading-snug">{draft.companyName}</div>
                      <VendorOnboardingBadge status={draft.onboardingStatus} />
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{draft.email}</span>
                    </p>

                    <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/30 flex items-center justify-between">
                      <span>Created: {safeFormatDate(draft.createdAt, "MMM dd, yyyy")}</span>
                      {draft.tokenSummary?.hasActiveToken && (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active Link
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDraftId(draft.id)}
                    className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors min-h-[44px] flex items-center justify-center gap-1.5"
                  >
                    <span>Inspect & Audit Profile</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <section className="bg-background/80 backdrop-blur-md rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch md:items-center shadow-lg border border-border/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search Entity Name, IBAN, Tax ID, or Contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-12 pr-4 py-3 min-h-[44px] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar py-1 relative">
              {["All", "Active", "Blocked", "Frozen"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider min-h-[44px] touch-target shrink-0 ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-105"
                      : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <VendorManagementModal open={isOnboarding} onOpenChange={setIsOnboarding} />

          {viewMode === "grid" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-6">
                {filteredVendors.map((vendor: any, idx: number) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    index={idx}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    onStatusChange={(status) => statusMutation.mutate({ id: vendor.id, status })}
                    onRate={(r) => rateMutation.mutate({ id: vendor.id, rating: r })}
                  />
                ))}
              </div>
            ) : (
              <div>
            <VendorListView
              vendors={filteredVendors}
              isAdmin={isAdmin}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status: status as any })}
              onRate={(id, r) => rateMutation.mutate({ id, rating: r })}
            />
          </div>
        )}
        </>
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
  onStatusChange,
  onRate,
  index
}: {
  vendor: any;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onStatusChange: (s: any) => void;
  onRate: (r: number) => void;
  index: number;
}) {
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [casesModalOpen, setCasesModalOpen] = useState(false);
  const [graceModalOpen, setGraceModalOpen] = useState(false);

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
      className="bg-background/80 backdrop-blur-xl flex flex-col gap-0 overflow-hidden group border border-border/50 hover:border-primary/40 rounded-3xl transition-all shadow-lg hover:shadow-xl relative hover:-translate-y-1 duration-300 animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
    >
      <VendorDocumentsModal open={docModalOpen} onOpenChange={setDocModalOpen} vendor={vendor} />
      <VendorComplianceCasesModal
        isOpen={casesModalOpen}
        onClose={() => setCasesModalOpen(false)}
        vendorId={vendor.id}
        vendorName={vendor.companyName}
        vendorType={vendor.vendorType || "company"}
        isSuperAdmin={isSuperAdmin}
      />
      <VendorGracePeriodModal
        isOpen={graceModalOpen}
        onClose={() => setGraceModalOpen(false)}
        vendorId={vendor.id}
        vendorName={vendor.companyName}
        currentDeadline={vendor.gracePeriodDeadline}
      />

      <div className="p-5 sm:p-6 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border shadow-sm group-hover:scale-105 group-hover:border-primary/30 transition-all duration-300 overflow-hidden relative shrink-0">
               <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary drop-shadow-sm" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors truncate">{vendor.companyName}</h3>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
           <ContactItem icon={<Mail className="w-4 h-4" />} label="Identity" value={vendor.email} theme="emerald" />
           <ContactItem icon={<Phone className="w-4 h-4" />} label="Hotline" value={vendor.contactNumber} theme="emerald" />
           <ContactItem icon={<ShieldCheck className="w-4 h-4" />} label="TAX/VAT" value={vendor.taxNumber || "UNREGISTERED"} theme="primary" />
           <ContactItem icon={<Globe className="w-4 h-4" />} label="Reg. ID" value={vendor.registrationNumber || "PENDING"} theme="primary" />
        </div>
      </div>

      <div className="px-5 sm:px-6 py-4 bg-secondary/20 border-y border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-center">
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm group-hover:border-primary/20 transition-colors shrink-0">
              <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="min-w-0">
               <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Base of Operations</p>
               <p className="text-sm text-foreground font-medium truncate">{vendor.address}</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm group-hover:border-primary/20 transition-colors shrink-0">
              <Wallet className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="min-w-0">
               <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Masked Bank IBAN</p>
               <p className="text-sm text-foreground font-medium truncate">{vendor.bankName} — <span className="font-mono text-foreground font-semibold text-xs">{maskedIban}</span></p>
            </div>
         </div>
      </div>

      <div className="px-5 sm:px-6 py-3.5 bg-background flex flex-wrap justify-between items-center gap-2 min-h-[52px]">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setDocModalOpen(true)}
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors underline decoration-dotted"
          >
            Manage Files
          </button>

          {isAdmin && (
            <button
              onClick={() => setCasesModalOpen(true)}
              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Compliance Cases</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setGraceModalOpen(true)}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:opacity-80 transition-colors flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Extend Grace</span>
            </button>
          )}
        </div>

        <div className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border shadow-sm ${statusColors[vendor.status]}`}>
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
