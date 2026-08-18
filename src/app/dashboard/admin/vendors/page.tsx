"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Building, ShieldCheck, Lock, XCircle, Search, Pencil } from "lucide-react";
import { VendorManagementModal } from "@/components/vendors/VendorManagementModal";

import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function AdminVendorsPage() {
  usePageTitle("Vendor Enforcement");
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    },
    onError: (error: any) => toast.error(error.message || "Failed to update vendor"),
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
              <p className="flex justify-between"><span className="font-semibold text-foreground">Contact:</span> {vendor.contactPerson} ({vendor.email})</p>
              <p className="flex justify-between"><span className="font-semibold text-foreground">Bank:</span> {vendor.bankName} (IBAN: {vendor.ibanNumber})</p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
              <button
                onClick={() => handleEdit(vendor)}
                aria-label={`Edit ${vendor.companyName}`}
                className="min-h-[44px] px-4 flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-colors"
              >
                <Pencil className="w-4 h-4 text-brand-primary" /> Edit
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: "active" })}
                  disabled={vendor.status === "active" || updateStatusMutation.isPending}
                  className="min-h-[44px] px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors disabled:opacity-30 border border-emerald-500/20"
                >
                  Approve
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: "frozen" })}
                  disabled={vendor.status === "frozen" || updateStatusMutation.isPending}
                  className="min-h-[44px] px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition-colors disabled:opacity-30 border border-cyan-500/20"
                >
                  Freeze
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: "blocked" })}
                  disabled={vendor.status === "blocked" || updateStatusMutation.isPending}
                  className="min-h-[44px] px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors disabled:opacity-30 border border-rose-500/20"
                >
                  Block
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
