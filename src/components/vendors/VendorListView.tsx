"use client";

import { motion } from "framer-motion";
import { Building2, Mail, Phone, MapPin, ShieldCheck, Wallet, Globe } from "lucide-react";
import { StarRating } from "@/components/shared/StarRating";

interface VendorListViewProps {
  vendors: any[];
  onStatusChange: (id: number, status: string) => void;
  onRate: (id: number, rating: number) => void;
  isAdmin: boolean;
}

export function VendorListView({ vendors, onStatusChange, onRate, isAdmin }: VendorListViewProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-secondary/5">
      <table className="w-full text-left border-collapse">
        <thead className="bg-secondary/20 border-b border-border">
          <tr>
            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Company / Rating</th>
            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Contact Identity</th>
            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Regulatory Details</th>
            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Financials</th>
            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Status / Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {vendors.map((vendor, idx) => (
            <motion.tr 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={vendor.id} 
              className="hover:bg-secondary/10 transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                      <Building2 className="w-4 h-4 text-brand-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground truncate max-w-[200px]">{vendor.companyName}</span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-500/20">L{vendor.status === 'active' ? '1' : '0'} Verified</span>
                  </div>
                  <StarRating 
                    rating={vendor.rating} 
                    onRate={(r) => onRate(vendor.id, r)}
                    size={12}
                  />
                </div>
              </td>
              
              <td className="px-6 py-4 hidden md:table-cell">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" /> {vendor.email}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" /> {vendor.contactNumber}
                  </div>
                </div>
              </td>

              <td className="px-6 py-4 hidden lg:table-cell">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-mono text-zinc-400">TAX: {vendor.taxNumber || "—"}</span>
                   <span className="text-[10px] font-mono text-zinc-400">CR: {vendor.registrationNumber || "—"}</span>
                   <div className="flex items-center gap-1 mt-1">
                      <Globe className="w-3 h-3 text-zinc-600" />
                      <span className="text-[10px] text-zinc-500 truncate max-w-[150px]">{vendor.address}</span>
                   </div>
                </div>
              </td>

              <td className="px-6 py-4 hidden lg:table-cell">
                <div className="flex flex-col gap-1 bg-secondary/20 p-2 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-300">
                    <Wallet className="w-3 h-3" /> {vendor.bankName}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500">{vendor.ibanNumber || "No IBAN"}</span>
                </div>
              </td>

              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-3">
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                    vendor.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 
                    vendor.status === 'blocked' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {vendor.status}
                  </div>
                  {isAdmin && (
                    <StatusToggleSmall 
                      current={vendor.status} 
                      onChange={(s) => onStatusChange(vendor.id, s)} 
                    />
                  )}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusToggleSmall({ current, onChange }: { current: string; onChange: (s: any) => void }) {
  const options = ["active", "blocked", "frozen"];
  return (
    <select 
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent text-[10px] font-bold border border-border rounded px-1 py-0.5 outline-none hover:border-muted-foreground transition-colors"
    >
      {options.map(opt => <option key={opt} value={opt} className="bg-background">{opt.toUpperCase()}</option>)}
    </select>
  );
}
