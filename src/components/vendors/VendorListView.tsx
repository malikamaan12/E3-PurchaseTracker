"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Mail, Phone, MapPin, ShieldCheck, Wallet, Globe, FileText, Edit3, Trash2 } from "lucide-react";
import { StarRating } from "@/components/shared/StarRating";
import { VendorDocumentsModal } from "@/components/vendors/VendorDocumentsModal";

interface VendorListViewProps {
  vendors: any[];
  onStatusChange: (id: number, status: string) => void;
  onRate: (id: number, rating: number) => void;
  isAdmin: boolean;
  canManage?: boolean;
  onEdit?: (vendor: any) => void;
  onDelete?: (vendor: any) => void;
}

export function VendorListView({ vendors, onStatusChange, onRate, isAdmin, canManage = false, onEdit, onDelete }: VendorListViewProps) {
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
    <div className="bg-background/80 backdrop-blur-md rounded-[2rem] border border-border/50 shadow-lg overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full -mr-48 -mt-48 pointer-events-none" />
      
      <div className="overflow-x-auto scrollbar-thin relative z-10">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-secondary/30 border-b border-border/50">
            <tr>
              <th className="px-8 py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Entity / Reputation</th>
              <th className="px-8 py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Connection Identity</th>
              <th className="px-8 py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Regulatory Metadata</th>
              <th className="px-8 py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Capital Gateway</th>
              <th className="px-8 py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Compliance Status</th>
              <th className="px-8 py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Administrative State</th>
            </tr>
          </thead>
          <motion.tbody 
            variants={container}
            initial="hidden"
            animate="show"
            className="divide-y divide-border/50"
          >
            {vendors.map((vendor) => (
              <motion.tr 
                variants={item}
                key={vendor.id} 
                className="hover:bg-primary/[0.02] transition-colors group cursor-default"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border shadow-sm group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300 relative overflow-hidden shrink-0">
                       <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                       <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-bold text-foreground truncate max-w-[220px] leading-tight group-hover:text-primary transition-colors">{vendor.companyName}</span>
                      <div className="flex items-center gap-2">
                        <StarRating rating={vendor.rating} onRate={(r) => onRate(vendor.id, r)} size={12} />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-0.5">Rating Verified</span>
                      </div>
                    </div>
                  </div>
                </td>
                
                <td className="px-8 py-5 hidden md:table-cell">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 text-xs font-medium text-foreground">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="truncate max-w-[180px]">{vendor.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs font-medium text-foreground">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="truncate max-w-[180px]">{vendor.contactNumber}</span>
                    </div>
                  </div>
                </td>
  
                <td className="px-8 py-5 hidden lg:table-cell">
                  <div className="flex flex-col gap-2">
                     <div className="flex justify-between items-center bg-secondary/30 p-2 rounded-xl border border-border/50 px-3 min-w-[140px]">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">TAX</span>
                        <span className="text-xs font-mono font-medium text-primary ml-4 truncate">{vendor.taxNumber || "—"}</span>
                     </div>
                     <div className="flex justify-between items-center bg-secondary/30 p-2 rounded-xl border border-border/50 px-3 min-w-[140px]">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">REG</span>
                        <span className="text-xs font-mono font-medium text-primary ml-4 truncate">{vendor.registrationNumber || "—"}</span>
                     </div>
                  </div>
                </td>
  
                <td className="px-8 py-5 hidden lg:table-cell">
                  <div className="flex flex-col gap-1.5 p-3 bg-secondary/30 rounded-2xl border border-border/50 group-hover:border-primary/20 transition-colors max-w-[200px]">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground tracking-wide truncate">
                      <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> <span className="truncate">{vendor.bankName}</span>
                    </div>
                    <span className="text-[11px] font-mono font-medium text-muted-foreground group-hover:text-foreground transition-colors tracking-wide truncate">{vendor.ibanNumber || "No IBAN Configured"}</span>
                  </div>
                </td>
  
                <td className="px-8 py-5 hidden xl:table-cell">
                  {(() => {
                    const docs = vendor.documents || [];
                    let complianceStatus = { color: "text-muted-foreground", bg: "bg-secondary", text: "No Documents", alert: false };
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
                      if (hasExpired) complianceStatus = { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", text: "Expired", alert: true };
                      else if (hasExpiringSoon) complianceStatus = { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", text: "Expiring Soon", alert: true };
                      else complianceStatus = { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", text: `${docs.length} Docs Valid`, alert: false };
                    }

                    return (
                      <button 
                        onClick={() => setSelectedVendorForDocs(vendor)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-transparent hover:border-primary/20 transition-all ${complianceStatus.bg} group/btn`}
                      >
                         <FileText className={`w-4 h-4 ${complianceStatus.color} ${complianceStatus.alert ? 'animate-pulse' : ''}`} />
                         <span className={`text-xs font-bold uppercase tracking-wider ${complianceStatus.color}`}>{complianceStatus.text}</span>
                      </button>
                    );
                  })()}
                </td>

                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-xs ${
                      vendor.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 
                      vendor.status === 'blocked' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}>
                      {vendor.status}
                    </div>
                    {(canManage || isAdmin) && (
                      <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(vendor)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
                            title="Edit Vendor Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(vendor)}
                            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/15 border border-rose-500/20 transition-colors"
                            title="Delete Vendor (if not assigned to projects)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
      className="bg-secondary text-xs font-bold text-foreground border border-border/50 rounded-lg px-2 py-1.5 outline-none hover:border-primary transition-all cursor-pointer shadow-sm uppercase tracking-wider"
    >
      {options.map(opt => <option key={opt} value={opt} className="bg-background text-foreground">{opt.toUpperCase()}</option>)}
    </select>
  );
}
