"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Mail, Phone, MapPin, ShieldCheck, Wallet, Globe, FileText } from "lucide-react";
import { StarRating } from "@/components/shared/StarRating";
import { VendorDocumentsModal } from "@/components/vendors/VendorDocumentsModal";

interface VendorListViewProps {
  vendors: any[];
  onStatusChange: (id: number, status: string) => void;
  onRate: (id: number, rating: number) => void;
  isAdmin: boolean;
}

export function VendorListView({ vendors, onStatusChange, onRate, isAdmin }: VendorListViewProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0 }
  };

  const [selectedVendorForDocs, setSelectedVendorForDocs] = useState<any>(null);

  return (
    <>
    <div className="glass rounded-[2rem] border border-border/40 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 blur-[120px] rounded-full -mr-48 -mt-48 pointer-events-none" />
      
      <div className="overflow-x-auto relative">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-secondary/20 border-b border-border/50">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Entity / Reputation</th>
              <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hidden md:table-cell">Connection Identity</th>
              <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hidden lg:table-cell">Regulatory Metadata</th>
              <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hidden lg:table-cell">Capital Gateway</th>
              <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hidden xl:table-cell">Compliance Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-right">Administrative State</th>
            </tr>
          </thead>
          <motion.tbody 
            variants={container}
            initial="hidden"
            animate="show"
            className="divide-y divide-border/30"
          >
            {vendors.map((vendor) => (
              <motion.tr 
                variants={item}
                key={vendor.id} 
                className="hover:bg-brand-primary/[0.03] transition-colors group cursor-default"
              >
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border shadow-sm group-hover:border-brand-primary/30 group-hover:scale-105 transition-all duration-300 relative overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                       <Building2 className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-sm font-black text-foreground truncate max-w-[200px] leading-none group-hover:text-brand-primary transition-colors">{vendor.companyName}</span>
                      <div className="flex items-center gap-2">
                        <StarRating rating={vendor.rating} onRate={(r) => onRate(vendor.id, r)} size={11} />
                        <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-tighter pt-0.5">Rating Verified</span>
                      </div>
                    </div>
                  </div>
                </td>
                
                <td className="px-8 py-6 hidden md:table-cell">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 text-[11px] font-bold text-foreground/80">
                      <div className="p-1 px-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Mail className="w-3 h-3 text-emerald-500" />
                      </div>
                      {vendor.email}
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] font-bold text-foreground/80">
                      <div className="p-1 px-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Phone className="w-3 h-3 text-emerald-500" />
                      </div>
                      {vendor.contactNumber}
                    </div>
                  </div>
                </td>
  
                <td className="px-8 py-6 hidden lg:table-cell">
                  <div className="flex flex-col gap-2">
                     <div className="flex justify-between items-center bg-secondary/30 p-1.5 rounded-xl border border-border/50 px-3">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">TAX</span>
                        <span className="text-[10px] font-mono font-black text-brand-primary">{vendor.taxNumber || "—"}</span>
                     </div>
                     <div className="flex justify-between items-center bg-secondary/30 p-1.5 rounded-xl border border-border/50 px-3">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">REG</span>
                        <span className="text-[10px] font-mono font-black text-brand-primary">{vendor.registrationNumber || "—"}</span>
                     </div>
                  </div>
                </td>
  
                <td className="px-8 py-6 hidden lg:table-cell">
                  <div className="flex flex-col gap-2 p-3 bg-zinc-900/40 rounded-2xl border border-white/5 group-hover:border-brand-primary/20 transition-colors">
                    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                      <Wallet className="w-3.5 h-3.5 text-emerald-500/60" /> {vendor.bankName}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors tracking-[0.1em]">{vendor.ibanNumber || "No IBAN Configured"}</span>
                  </div>
                </td>
  
                <td className="px-8 py-6 hidden xl:table-cell">
                  {(() => {
                    const docs = vendor.documents || [];
                    let complianceStatus = { color: "text-zinc-500", bg: "bg-zinc-500/10", text: "No Documents", alert: false };
                    if (docs.length > 0) {
                      const now = new Date();
                      let hasExpired = false;
                      let hasExpiringSoon = false;
                      docs.forEach((d: any) => {
                        if (d.expiryDate) {
                          const daysLeft = (new Date(d.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24);
                          if (daysLeft < 0) hasExpired = true;
                          else if (daysLeft <= 30) hasExpiringSoon = true;
                        }
                      });
                      if (hasExpired) complianceStatus = { color: "text-rose-500", bg: "bg-rose-500/10", text: "Expired", alert: true };
                      else if (hasExpiringSoon) complianceStatus = { color: "text-amber-500", bg: "bg-amber-500/10", text: "Expiring Soon", alert: true };
                      else complianceStatus = { color: "text-emerald-500", bg: "bg-emerald-500/10", text: `${docs.length} Docs Valid`, alert: false };
                    }

                    return (
                      <button 
                        onClick={() => setSelectedVendorForDocs(vendor)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-transparent hover:border-brand-primary/20 transition-all ${complianceStatus.bg} group/btn`}
                      >
                         <FileText className={`w-3.5 h-3.5 ${complianceStatus.color} ${complianceStatus.alert ? 'animate-pulse' : ''}`} />
                         <span className={`text-[10px] font-black uppercase tracking-widest ${complianceStatus.color}`}>{complianceStatus.text}</span>
                      </button>
                    );
                  })()}
                </td>

                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <div className={`px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 shadow-sm ${
                      vendor.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      vendor.status === 'blocked' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {vendor.status}
                    </div>
                    {isAdmin && (
                      <div className="opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 translate-x-1 group-hover:translate-x-0">
                        <StatusToggleMini 
                          current={vendor.status} 
                          onChange={(s) => onStatusChange(vendor.id, s)} 
                        />
                      </div>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
    
    <VendorDocumentsModal 
      open={!!selectedVendorForDocs} 
      onOpenChange={(isOpen: boolean) => !isOpen && setSelectedVendorForDocs(null)} 
      vendor={selectedVendorForDocs} 
    />
    </>
  );
}

function StatusToggleMini({ current, onChange }: { current: string; onChange: (s: any) => void }) {
  const options = ["active", "blocked", "frozen"];
  return (
    <select 
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="bg-secondary/80 text-[10px] font-black text-foreground border-2 border-border/50 rounded-xl px-2 py-1.5 outline-none hover:border-brand-primary transition-all cursor-pointer shadow-sm uppercase tracking-tighter"
    >
      {options.map(opt => <option key={opt} value={opt} className="bg-background text-foreground">{opt.toUpperCase()}</option>)}
    </select>
  );
}
