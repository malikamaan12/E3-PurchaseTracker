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
  Globe, 
  Mail, 
  Phone 
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import * as Tabs from "@radix-ui/react-tabs";
import { OnboardVendorModal } from "@/components/vendors/OnboardVendorModal";
import { useState } from "react";

export default function VendorsDashboard() {
  const queryClient = useQueryClient();
  const [isOnboarding, setIsOnboarding] = useState(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiClient.vendors.list(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "blocked" | "frozen" }) => 
      apiClient.vendors.patchStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor status updated successfully");
    },
    onError: () => toast.error("Failed to update status"),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif tracking-tight text-white">Vendor Ecosystem</h1>
          <p className="text-zinc-400">Manage global supplier relationships and compliance.</p>
        </div>
        <button 
          onClick={() => setIsOnboarding(true)}
          className="flex items-center gap-2 bg-brand-secondary text-black font-bold px-5 py-2.5 rounded-full hover:scale-105 transition-transform shadow-lg active:scale-95"
        >
          <Plus className="w-5 h-5" /> Onboard Vendor
        </button>
      </header>

      <OnboardVendorModal open={isOnboarding} onOpenChange={setIsOnboarding} />

      <Tabs.Root defaultValue="all" className="flex flex-col gap-6">
        <Tabs.List className="flex gap-4 p-1 glass w-fit rounded-lg self-start">
          <Tabs.Trigger value="all" className="tabs-trigger">All Entities</Tabs.Trigger>
          <Tabs.Trigger value="active" className="tabs-trigger">Compliant</Tabs.Trigger>
          <Tabs.Trigger value="blocked" className="tabs-trigger">Restricted</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="all" className="grid grid-cols-1 lg:grid-cols-2 gap-6 outline-none">
          {vendors?.map((vendor: any) => (
            <VendorCard 
              key={vendor.id} 
              vendor={vendor} 
              onStatusChange={(status) => statusMutation.mutate({ id: vendor.id, status })}
            />
          ))}
        </Tabs.Content>
      </Tabs.Root>

      <section className="mt-12 space-y-6">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-brand-secondary" />
          <h2 className="text-xl font-semibold text-white">Compliance Document Gateway</h2>
        </div>
        <div className="glass h-48 border-dashed border-2 border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-brand-secondary/50 transition-colors group cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-zinc-400 group-hover:text-brand-secondary" />
          </div>
          <div className="text-center">
            <p className="text-zinc-300 font-medium">Drop regulatory files here</p>
            <p className="text-zinc-500 text-xs">PDF, XLSX, or DOCX (Max 10MB)</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function VendorCard({ vendor, onStatusChange }: { vendor: any; onStatusChange: (s: any) => void }) {
  const statusColors: any = {
    active: "text-emerald-500",
    blocked: "text-rose-500",
    frozen: "text-amber-500",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass-card p-6 flex flex-col gap-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
            <Building2 className="w-7 h-7 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{vendor.companyName}</h3>
            <p className="text-xs text-zinc-500 font-medium">VAT: {vendor.taxNumber || "N/A"}</p>
          </div>
        </div>
        <StatusToggle current={vendor.status} onChange={onStatusChange} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ContactInfo icon={<Mail className="w-3.5 h-3.5" />} text={vendor.email} />
        <ContactInfo icon={<Phone className="w-3.5 h-3.5" />} text={vendor.contactNumber} />
        <ContactInfo icon={<Globe className="w-3.5 h-3.5" />} text={vendor.address} colSpan="col-span-2" />
      </div>

      <div className="pt-4 border-t border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Verified Entity</span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-tighter ${statusColors[vendor.status]}`}>
          {vendor.status}
        </span>
      </div>
    </motion.div>
  );
}

function ContactInfo({ icon, text, colSpan = "" }: { icon: any; text: string; colSpan?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${colSpan}`}>
      <div className="text-zinc-500">{icon}</div>
      <span className="text-xs text-zinc-300 font-medium truncate">{text}</span>
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
    <div className="flex gap-1.5 p-1 glass rounded-md">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`p-1.5 rounded transition-all ${current === opt.value ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-400"}`}
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
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="w-16 h-16 rounded-3xl bg-brand-secondary/20 border border-brand-secondary/30"
      />
      <p className="text-zinc-500 font-mono tracking-widest text-xs uppercase">Mapping Ecosystem...</p>
    </div>
  );
}
