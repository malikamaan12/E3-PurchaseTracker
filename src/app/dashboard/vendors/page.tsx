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
import { toast } from "sonner";
import * as Tabs from "@radix-ui/react-tabs";
import { VendorManagementModal } from "@/components/vendors/VendorManagementModal";
import { VendorDocumentsModal } from "@/components/vendors/VendorDocumentsModal";
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
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 mx-auto w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-serif font-black tracking-tighter text-foreground leading-none">Vendor Ecosystem</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-[0.2em] opacity-60">Global Supplier Matrix & Compliance Hub</p>
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
              className="flex items-center gap-3 bg-brand-primary text-white font-black px-8 py-3 rounded-2xl hover:brightness-110 shadow-xl shadow-brand-primary/20 transition-all group shrink-0"
            >
              <Plus className="w-5 h-5 stroke-[4] group-hover:rotate-90 transition-transform" /> 
              <span>Onboard Entity</span>
            </button>
          )}
        </div>
      </header>

      {/* Advanced Search & Filtering Toolbar */}
      <section className="glass rounded-[2rem] p-5 flex flex-col md:flex-row gap-6 items-center shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
        
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-primary transition-all duration-300" />
          <input 
            type="text"
            placeholder="Search Entity Name, IBAN, Tax ID, or Contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 border-2 border-border/40 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:outline-none focus:ring-8 focus:ring-brand-primary/10 focus:border-brand-primary focus:bg-background transition-all duration-300 placeholder:text-muted-foreground/30 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar py-1 relative">
          {["All", "Active", "Blocked", "Frozen"].map(s => (
            <button 
              key={s} 
              onClick={() => setStatusFilter(s)}
              className={`px-6 py-3 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest leading-none ${
                statusFilter === s 
                  ? "bg-brand-primary text-white border-brand-primary shadow-xl shadow-brand-primary/30 scale-105 z-10" 
                  : "bg-secondary/30 border-transparent text-muted-foreground hover:border-brand-primary/30 hover:text-brand-primary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <VendorManagementModal open={isOnboarding} onOpenChange={setIsOnboarding} />

      {viewMode === "grid" ? (
          <div 
            className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-8"
          >
            {filteredVendors.map((vendor: any, idx: number) => (
              <VendorCard 
                key={vendor.id} 
                vendor={vendor}
                index={idx}
                isAdmin={isAdmin}
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

function VendorCard({ vendor, isAdmin, onStatusChange, onRate, index }: { vendor: any; isAdmin: boolean; onStatusChange: (s: any) => void; onRate: (r: number) => void; index: number }) {
  const [docModalOpen, setDocModalOpen] = useState(false);
  const statusColors: any = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    blocked: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    frozen: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  // Compliance calculations
  const docs = vendor.documents || [];
  let complianceStatus = { color: "text-zinc-500", bg: "bg-zinc-500/10", text: "No Documents", alert: false };
  if (docs.length > 0) {
    const now = new Date();
    let hasExpired = false;
    let hasExpiringSoon = false;
    
    docs.forEach((d: any) => {
      if (d.expiryDate) {
        const expiry = new Date(d.expiryDate);
        const daysLeft = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (daysLeft < 0) hasExpired = true;
        else if (daysLeft <= 30) hasExpiringSoon = true;
      }
    });

    if (hasExpired) complianceStatus = { color: "text-rose-500", bg: "bg-rose-500/10", text: "Compliance Expired", alert: true };
    else if (hasExpiringSoon) complianceStatus = { color: "text-amber-500", bg: "bg-amber-500/10", text: "Expiring Soon", alert: true };
    else complianceStatus = { color: "text-emerald-500", bg: "bg-emerald-500/10", text: `${docs.length} Docs Valid`, alert: false };
  }

  return (
    <div 
      className="glass-card flex flex-col gap-0 overflow-hidden group border-border/40 hover:border-brand-primary/50 transition-all shadow-2xl relative hover:-translate-y-2 duration-300 animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
    >
      <VendorDocumentsModal open={docModalOpen} onOpenChange={setDocModalOpen} vendor={vendor} />
      <div className="p-8 pb-6 relative">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-brand-primary/10 transition-colors" />
        
        <div className="flex items-start justify-between gap-6 relative">
          <div className="flex gap-5">
            <div className="w-20 h-20 rounded-3xl bg-secondary/50 flex items-center justify-center border-2 border-border shadow-inner group-hover:scale-105 group-hover:border-brand-primary/30 transition-all duration-500 overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               <Building2 className="w-10 h-10 text-brand-primary drop-shadow-sm" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground leading-tight tracking-tight group-hover:text-brand-primary transition-colors">{vendor.companyName}</h3>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-black uppercase tracking-widest rounded-lg border border-brand-primary/20">
                  {vendor.category || "GENERAL"}
                </span>
                <div className="h-4 w-px bg-border invisible md:visible" />
                <StarRating rating={vendor.rating} onRate={onRate} size={16} />
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
               <StatusToggle current={vendor.status} onChange={onStatusChange} />
            </div>
          )}
        </div>

        {/* Bento Grid Contacts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
           <ContactItem icon={<Mail className="w-4 h-4" />} label="Identity" value={vendor.email} theme="teal" />
           <ContactItem icon={<Phone className="w-4 h-4" />} label="Hotline" value={vendor.contactNumber} theme="teal" />
           <ContactItem icon={<ShieldCheck className="w-4 h-4" />} label="TAX/VAT" value={vendor.taxNumber || "UNREGISTERED"} theme="purple" />
           <ContactItem icon={<Globe className="w-4 h-4" />} label="Reg. ID" value={vendor.registrationNumber || "PENDING"} theme="purple" />
        </div>
      </div>

      <div className="px-8 py-5 bg-zinc-900/50 backdrop-blur-md border-y border-border/50 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50 group-hover:border-brand-primary/20 transition-colors">
              <MapPin className="w-5 h-5 text-zinc-500 group-hover:text-brand-primary" />
            </div>
            <div className="min-w-0">
               <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Base of Operations</p>
               <p className="text-sm text-zinc-300 w-full font-medium">{vendor.address}</p>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10 group-hover:border-emerald-500/30 transition-colors">
              <Wallet className="w-5 h-5 text-emerald-500/60" />
            </div>
            <div className="min-w-0">
               <p className="text-[10px] font-black text-emerald-500/40 uppercase tracking-widest">Banking Pipeline</p>
               <p className="text-sm text-zinc-300 font-medium">{vendor.bankName} — <span className="font-mono text-zinc-500 text-[10px] tracking-widest">{vendor.ibanNumber}</span></p>
            </div>
         </div>
      </div>

      <div className="px-8 py-4 bg-secondary/30 flex justify-between items-center group/footer">
        <button 
          onClick={() => setDocModalOpen(true)}
          className="flex items-center gap-2 group-hover:translate-x-1 transition-transform cursor-pointer"
        >
          <div className={`w-2 h-2 rounded-full ${complianceStatus.bg.split('/')[0]} ${complianceStatus.alert ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest font-mono ${complianceStatus.color}`}>
            {complianceStatus.text}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest ml-2 hover:text-brand-primary transition-colors underline decoration-dotted">
            Manage Docs
          </span>
        </button>
        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 shadow-sm ${statusColors[vendor.status]}`}>
          {vendor.status}
        </div>
      </div>
    </div>
  );
}

function ContactItem({ icon, label, value, theme }: { icon: any; label: string; value: string; theme: 'teal' | 'purple' }) {
  const themes = {
    teal: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10",
    purple: "text-brand-primary bg-brand-primary/5 border-brand-primary/10"
  };

  return (
    <div className="space-y-2 p-3 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-colors cursor-default">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">{label}</p>
        <div className={`${themes[theme]} p-1 rounded-md border`}>{icon}</div>
      </div>
      <p className="text-[11px] text-foreground font-black break-all leading-tight pt-1">{value}</p>
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
    <div className="flex flex-col gap-4 p-8 w-full h-[60vh] justify-center items-center">
      <div 
        className="w-16 h-16 rounded-3xl bg-brand-secondary/20 border border-brand-secondary/30 flex items-center justify-center shadow-lg spin-css"
      >
         <Building2 className="w-8 h-8 text-brand-secondary" />
      </div>
      <p className="text-muted-foreground font-mono tracking-widest text-[10px] font-bold uppercase pt-4 animate-pulse">Syncing Entity Matrix...</p>
    </div>
  );
}
