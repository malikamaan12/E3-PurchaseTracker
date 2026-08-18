"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Building, ShieldCheck, Lock, XCircle, Search, Pencil, MoreHorizontal, AlertCircle } from "lucide-react";
import { VendorManagementModal } from "@/components/vendors/VendorManagementModal";
import { ActionConfirmDialog } from "@/components/ui/ActionConfirmDialog";

import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function AdminVendorsPage() {
  usePageTitle("Vendor Enforcement");
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionMenuVendor, setActionMenuVendor] = useState<any>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    vendor: any;
    targetStatus: string;
  } | null>(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["admin_vendors"],
    queryFn: () => apiClient.vendors.list(), // using the global vendors list route
    enabled: !!user && !isAuthLoading
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiClient.admin.vendors.updateStatus(id, status),
    onSuccess: () => {
      toast.success("Vendor status updated");
      queryClient.invalidateQueries({ queryKey: ["admin_vendors"] });
      setPendingStatusChange(null);
      setActionMenuVendor(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update vendor");
      setPendingStatusChange(null);
    },
  });

  const handleEdit = (vendor: any) => {
    setSelectedVendor(vendor);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Vendor Enforcement</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">High-level supplier compliance tracking and RBAC status overrides.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors">
          <Building className="w-5 h-5 text-indigo-500" />
          <span className="text-foreground font-bold">{vendors.length} {vendors.length === 1 ? 'Vendor' : 'Vendors'}</span>
        </div>
      </div>

      {/* Mobile Vendor Cards */}
      <div className="md:hidden space-y-4 pt-4">
        {vendors.map((vendor: any) => (
          <div key={vendor.id} className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-bold text-foreground uppercase text-sm border border-border shrink-0">
                  {vendor.companyName.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{vendor.companyName}</p>
                  <span className="px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground font-bold uppercase mt-1 inline-block border border-border">
                    {vendor.category || "General"}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                vendor.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                vendor.status === 'frozen' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20' :
                'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}>
                {vendor.status === 'active' && <ShieldCheck className="w-3 h-3"/>}
                {vendor.status === 'frozen' && <Lock className="w-3 h-3"/>}
                {vendor.status === 'blocked' && <XCircle className="w-3 h-3"/>}
                {vendor.status || 'active'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 min-w-0">
                <span className="font-semibold text-foreground shrink-0">Contact:</span>
                <span className="truncate">{vendor.contactPerson || "N/A"} ({vendor.email || "No email"})</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 min-w-0">
                <span className="font-semibold text-foreground shrink-0">Bank:</span>
                <span className="font-mono text-[11px] truncate">{vendor.bankName || "N/A"} (IBAN: {vendor.ibanNumber || "N/A"})</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
              <button
                onClick={() => handleEdit(vendor)}
                aria-label={`Edit ${vendor.companyName}`}
                className="flex-1 min-h-[44px] px-4 flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-colors touch-target"
              >
                <Pencil className="w-4 h-4 text-brand-primary" /> Edit
              </button>

              <button
                onClick={() => setActionMenuVendor(vendor)}
                aria-label={`More actions for ${vendor.companyName}`}
                className="min-h-[44px] min-w-[44px] px-3.5 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors touch-target"
                title="More actions"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Overflow Actions Sheet */}
      {actionMenuVendor && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{actionMenuVendor.companyName}</p>
                <p className="text-xs text-muted-foreground">Status: <span className="font-bold capitalize">{actionMenuVendor.status || "active"}</span></p>
              </div>
              <button
                onClick={() => setActionMenuVendor(null)}
                aria-label="Close actions menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground touch-target"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setPendingStatusChange({ vendor: actionMenuVendor, targetStatus: "active" });
                  setActionMenuVendor(null);
                }}
                disabled={actionMenuVendor.status === "active"}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors disabled:opacity-30 border border-emerald-500/20 flex items-center justify-between touch-target"
              >
                <span>Approve Vendor</span>
                <ShieldCheck className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setPendingStatusChange({ vendor: actionMenuVendor, targetStatus: "frozen" });
                  setActionMenuVendor(null);
                }}
                disabled={actionMenuVendor.status === "frozen"}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition-colors disabled:opacity-30 border border-cyan-500/20 flex items-center justify-between touch-target"
              >
                <span>Freeze Vendor</span>
                <Lock className="w-4 h-4" />
              </button>

              <div className="pt-2 border-t border-border/50">
                <button
                  onClick={() => {
                    setPendingStatusChange({ vendor: actionMenuVendor, targetStatus: "blocked" });
                    setActionMenuVendor(null);
                  }}
                  disabled={actionMenuVendor.status === "blocked"}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors disabled:opacity-30 border border-rose-500/20 flex items-center justify-between touch-target"
                >
                  <span>Block Vendor (Destructive)</span>
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Confirmation Dialog */}
      <ActionConfirmDialog
        isOpen={!!pendingStatusChange}
        onOpenChange={(open) => { if (!open) setPendingStatusChange(null); }}
        title={`Confirm Status Change`}
        variant={pendingStatusChange?.targetStatus === "blocked" ? "danger" : pendingStatusChange?.targetStatus === "frozen" ? "warning" : "success"}
        confirmText={`Set to ${pendingStatusChange?.targetStatus || ""}`}
        isLoading={updateStatusMutation.isPending}
        onConfirm={() => {
          if (pendingStatusChange) {
            updateStatusMutation.mutate({
              id: pendingStatusChange.vendor.id,
              status: pendingStatusChange.targetStatus
            });
          }
        }}
        description={
          <div className="space-y-3 text-left">
            <p>
              Are you sure you want to change the status of <span className="font-bold text-foreground">{pendingStatusChange?.vendor?.companyName}</span>?
            </p>
            <div className="p-3 bg-secondary/40 rounded-xl border border-border space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Current Status:</span>
                <span className="font-bold capitalize text-foreground">{pendingStatusChange?.vendor?.status || "active"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Proposed Status:</span>
                <span className="font-bold capitalize text-brand-primary">{pendingStatusChange?.targetStatus}</span>
              </div>
            </div>
            {pendingStatusChange?.targetStatus === "blocked" && (
              <p className="text-rose-500 text-[11px] font-semibold">
                Warning: Blocking this vendor will restrict new purchase requests and orders from associating with this supplier.
              </p>
            )}
          </div>
        }
      />

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar pt-6">
        <table className="w-full text-left border-collapse bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th scope="col" className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Company</th>
              <th scope="col" className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Contact & Email</th>
              <th scope="col" className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Financial Data</th>
              <th scope="col" className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Compliance Status</th>
              <th scope="col" className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {vendors.map((vendor: any) => (
              <tr key={vendor.id} className="hover:bg-secondary/50 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-bold text-foreground uppercase text-sm border border-border transition-colors">
                      {vendor.companyName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground tracking-tight transition-colors">{vendor.companyName}</p>
                      <span className="px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground font-bold uppercase mt-1 inline-block border border-border">
                        {vendor.category || "General"}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm text-foreground font-bold transition-colors">{vendor.contactPerson}</p>
                  <p className="text-xs text-muted-foreground">{vendor.email}</p>
                </td>
                <td className="p-4">
                  <p className="text-sm text-foreground font-mono font-medium transition-colors">{vendor.bankName}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1 opacity-70">IBAN: {vendor.ibanNumber}</p>
                </td>
                <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-max gap-1 !pl-1 ${
                      vendor.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                      vendor.status === 'frozen' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20' :
                      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {vendor.status === 'active' && <ShieldCheck className="w-3 h-3"/>}
                      {vendor.status === 'frozen' && <Lock className="w-3 h-3"/>}
                      {vendor.status === 'blocked' && <XCircle className="w-3 h-3"/>}
                      {vendor.status || 'active'}
                    </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(vendor)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-brand-primary transition-all border border-border group-hover:border-brand-primary/30"
                      title="Edit Details"
                      aria-label={`Edit ${vendor.companyName}`}
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: "active" })}
                      disabled={vendor.status === "active" || updateStatusMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors disabled:opacity-30 border border-emerald-500/20 min-h-[36px]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: "frozen" })}
                      disabled={vendor.status === "frozen" || updateStatusMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition-colors disabled:opacity-30 border border-cyan-500/20 min-h-[36px]"
                    >
                      Freeze
                    </button>
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: "blocked" })}
                      disabled={vendor.status === "blocked" || updateStatusMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors disabled:opacity-30 border border-rose-500/20 min-h-[36px]"
                    >
                      Block
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vendors.length === 0 && (
          <div className="p-12 text-center text-muted-foreground font-bold uppercase tracking-widest text-[10px] bg-secondary/20 rounded-b-3xl border border-border border-t-0 shadow-inner">
            No vendors registered in the system.
          </div>
        )}
      </div>

      <VendorManagementModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        vendor={selectedVendor}
      />
    </div>
  );
}
