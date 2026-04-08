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
  Globe 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as Tabs from "@radix-ui/react-tabs";
import { OnboardVendorModal } from "@/components/vendors/OnboardVendorModal";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { StarRating } from "@/components/shared/StarRating";
import { VendorListView } from "@/components/vendors/VendorListView";

export default function VendorsDashboard() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [statusFilter, setStatusFilter] = useState("All");

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

  // Advanced Filtering Logic
  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    
    // First apply status filter
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
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif tracking-tight text-foreground">Vendor Ecosystem</h1>
          <p className="text-muted-foreground">Manage and evaluate global supplier relationships.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* View Toggles */}
          <div className="flex bg-secondary/50 p-1 rounded-xl border border-border shadow-inner">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {isAdmin && (
            <button 
              onClick={() => setIsOnboarding(true)}
              className="flex items-center gap-2 bg-brand-secondary text-black font-extrabold px-6 py-2.5 rounded-full hover:brightness-110 shadow-lg"
            >
              <Plus className="w-5 h-5 stroke-[3]" /> Onboard Vendor
            </button>
          )}
        </div>
      </header>

      {/* Advanced Search & Filtering Toolbar */}
      <section className="bg-secondary/10 p-4 rounded-2xl border border-border/50 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-secondary transition-colors" />
          <input 
            type="text"
            placeholder="Search by name, email, reg number, bank, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/20 focus:border-brand-secondary transition-all"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest whitespace-nowrap">Filter Status:</span>
          {["All", "Active", "Blocked", "Frozen"].map(s => (
            <button 
              key={s} 
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold uppercase ${
                statusFilter === s 
                  ? "bg-brand-secondary text-black border-brand-secondary shadow-lg shadow-brand-secondary/20" 
                  : "bg-background border-border text-muted-foreground hover:border-brand-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <OnboardVendorModal open={isOnboarding} onOpenChange={setIsOnboarding} />

      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6"
          >
            {filteredVendors.map((vendor: any) => (
              <VendorCard 
                key={vendor.id} 
                vendor={vendor} 
                isAdmin={isAdmin}
                onStatusChange={(status) => statusMutation.mutate({ id: vendor.id, status })}
                onRate={(r) => rateMutation.mutate({ id: vendor.id, rating: r })}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <VendorListView 
              vendors={filteredVendors} 
              isAdmin={isAdmin}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status: status as any })}
              onRate={(id, r) => rateMutation.mutate({ id, rating: r })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="mt-12 space-y-6">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-brand-secondary" />
          <h2 className="text-xl font-semibold text-foreground">Compliance Document Gateway</h2>
        </div>
        <div className="bg-secondary/20 h-48 border-dashed border-2 border-border rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-brand-secondary/50 transition-colors group cursor-pointer shadow-inner">
          <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-brand-secondary" />
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">Drop regulatory files here</p>
            <p className="text-muted-foreground text-xs font-mono tracking-tighter uppercase">PDF, XLSX, or DOCX (Max 10MB)</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function VendorCard({ vendor, isAdmin, onStatusChange, onRate }: { vendor: any; isAdmin: boolean; onStatusChange: (s: any) => void; onRate: (r: number) => void }) {
  const statusColors: any = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    blocked: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    frozen: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass-card flex flex-col gap-0 overflow-hidden group border-border/50"
    >
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 shadow-inner group-hover:scale-105 transition-transform">
              <Building2 className="w-8 h-8 text-brand-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground leading-none">{vendor.companyName}</h3>
              <p className="text-[10px] text-brand-secondary font-bold uppercase tracking-widest leading-none pt-1">
                {vendor.category || "GENERAL SUPPLIES"}
              </p>
              <div className="pt-1">
                <StarRating rating={vendor.rating} onRate={onRate} size={14} />
              </div>
            </div>
          </div>
          {isAdmin && <StatusToggle current={vendor.status} onChange={onStatusChange} />}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-8">
           <ContactItem icon={<Mail className="w-3.5 h-3.5" />} label="Email Identity" value={vendor.email} />
           <ContactItem icon={<Phone className="w-3.5 h-3.5" />} label="Connection Line" value={vendor.contactNumber} />
           <ContactItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Tax Number (VAT)" value={vendor.taxNumber || "UNREGISTERED"} />
           <ContactItem icon={<Globe className="w-3.5 h-3.5" />} label="Reg. Number (CR)" value={vendor.registrationNumber || "PENDING"} />
        </div>
      </div>

      <div className="mt-2 p-4 bg-zinc-900/40 border-t border-border flex flex-col gap-3">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex-1">
               <p className="text-[8px] font-bold text-zinc-600 uppercase">Registered Address</p>
               <p className="text-xs text-zinc-300 truncate max-w-[300px]">{vendor.address}</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10">
              <Wallet className="w-4 h-4 text-emerald-500/70" />
            </div>
            <div className="flex-1">
               <p className="text-[8px] font-bold text-emerald-500/50 uppercase">Banking Channel</p>
               <p className="text-xs text-zinc-300 truncate">{vendor.bankName} — <span className="font-mono text-zinc-500">{vendor.ibanNumber?.substring(0, 12)}...</span></p>
            </div>
         </div>
      </div>

      <div className="p-4 py-3 bg-secondary/20 flex justify-between items-center px-6">
        <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Compliant Record</span>
        </div>
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusColors[vendor.status]}`}>
          {vendor.status}
        </div>
      </div>
    </motion.div>
  );
}

function ContactItem({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none">{label}</p>
      <div className="flex items-center gap-2">
        <div className="text-zinc-600">{icon}</div>
        <span className="text-xs text-foreground font-medium truncate max-w-[120px]">{value}</span>
      </div>
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
    <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl border border-border shadow-inner">
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
    <div className="flex flex-col gap-4 p-8 max-w-7xl mx-auto w-full h-[60vh] justify-center items-center">
      <motion.div 
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="w-16 h-16 rounded-3xl bg-brand-secondary/20 border border-brand-secondary/30 flex items-center justify-center shadow-lg"
      >
         <Building2 className="w-8 h-8 text-brand-secondary" />
      </motion.div>
      <p className="text-muted-foreground font-mono tracking-widest text-[10px] font-bold uppercase pt-4 animate-pulse">Syncing Entity Matrix...</p>
    </div>
  );
}
