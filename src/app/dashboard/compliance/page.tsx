"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  Search, 
  Download, 
  ExternalLink,
  ShieldQuestion,
  Info,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { usePerformance } from "@/context/PerformanceContext"

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface ComplianceDoc {
  status: "valid" | "expired" | "missing"
  file?: {
    id: number
    name: string
    url: string
    date: string
  }
}

interface ComplianceVendor {
  id: number
  companyName: string
  registrationNumber: string | null
  taxNumber: string | null
  healthScore: number
  docs: {
    registration: ComplianceDoc
    tax: ComplianceDoc
    establishment: ComplianceDoc
    contract: ComplianceDoc
  }
}

// ─── COMPONENT: KPI DISK ────────────────────────────────────────────────────
const KpiDisk = ({ label, value, sub, color }: { label: string, value: string | number, sub: string, color: string }) => {
  return (
    <div className="glass p-5 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-none relative overflow-hidden group">
      <div className={cn("absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-20 transition-all duration-700 group-hover:scale-150 group-hover:opacity-40", color)} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 dark:text-muted-foreground mb-4">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-4xl font-serif text-foreground tracking-tight">{value}</h3>
        <span className="text-xs font-bold text-muted-foreground/60 dark:text-muted-foreground font-mono">{sub}</span>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ComplianceGatewayPage() {
  const { highPerformanceMode } = usePerformance()
  const [search, setSearch] = React.useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/compliance/status");
      if (!res.ok) throw new Error("Failed to fetch compliance data");
      return res.json();
    }
  })

  const filteredVendors = (data?.vendors || []).filter((v: ComplianceVendor) => 
    v.companyName.toLowerCase().includes(search.toLowerCase()) ||
    v.registrationNumber?.includes(search)
  )

  return (
    <div className="relative min-h-screen p-8 max-w-[1440px] mx-auto overflow-hidden">
      {/* 1. Header & Global Analytics */}
      <header className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-12 relative z-10">
        <div className="max-w-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
              <ShieldCheck className="w-8 h-8 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-serif text-foreground tracking-tight">Compliance Gateway</h1>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1 opacity-60">
                System-Wide Regulatory Audit • Q2 2026
              </p>
            </div>
          </div>
          <p className="text-foreground/60 leading-relaxed">
            Centralized intelligence hub for monitoring vendor legality. This gateway aggregates proof-of-registration 
            and tax certificates across the entire procurement lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto min-w-[600px]">
          <KpiDisk 
            label="System Health" 
            value={data?.summary.systemHealth || 0} 
            sub="%" 
            color="bg-emerald-500" 
          />
          <KpiDisk 
            label="Fully Secured" 
            value={data?.summary.fullyCompliant || 0} 
            sub="vendors" 
            color="bg-brand-primary" 
          />
          <KpiDisk 
            label="Regulatory Risk" 
            value={data?.summary.highRisk || 0} 
            sub="critical" 
            color="bg-rose-500" 
          />
        </div>
      </header>

      {/* 2. Controls */}
      <div className="flex items-center gap-4 mb-8 sticky top-20 z-40 bg-background/50 backdrop-blur-md p-2 rounded-2xl border border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search vendor legal cache..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button className="h-12 px-6 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Download className="w-4 h-4" /> Export Audit
          </button>
          <button className="h-12 px-6 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 transition-all hover:scale-[1.02] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <ShieldAlert className="w-4 h-4" /> Request Updates
          </button>
        </div>
      </div>

      {/* 3. Compliance Matrix (DESKTOP) */}
      <div className="hidden lg:block glass p-1 rounded-3xl border border-black/5 dark:border-white/10 mb-20 overflow-x-auto custom-scrollbar shadow-sm dark:shadow-none">
        <div className="bg-white/40 dark:bg-white/[0.02] rounded-[22px] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Vendor Entity</th>
                <th className="p-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40">Registration (CR)</th>
                <th className="p-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40">Tax Certificate</th>
                <th className="p-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40">Computer Card</th>
                <th className="p-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40">Master Contract</th>
                <th className="p-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="p-12 text-center text-muted-foreground">Hydrating Legal Matrix...</td>
                    </tr>
                  ))
                ) : filteredVendors.length === 0 ? (
                  <tr><td colSpan={6} className="p-20 text-center text-muted-foreground">No records found matching your query.</td></tr>
                ) : (
                  filteredVendors.map((vendor: ComplianceVendor, idx: number) => (
                    <motion.tr 
                      key={vendor.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground group-hover:text-brand-primary transition-colors">
                            {vendor.companyName}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/60 mt-1 uppercase">
                            ID: {vendor.id} • {vendor.registrationNumber || "Unrecognized registration"}
                          </span>
                        </div>
                      </td>
                      <ComplianceCell doc={vendor.docs.registration} />
                      <ComplianceCell doc={vendor.docs.tax} />
                      <ComplianceCell doc={vendor.docs.establishment} />
                      <ComplianceCell doc={vendor.docs.contract} />
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${vendor.healthScore}%` }}
                              className={cn(
                                "h-full rounded-full shrink-0",
                                vendor.healthScore === 100 ? "bg-brand-secondary shadow-[0_0_10px_rgba(47,183,178,0.3)]" :
                                vendor.healthScore > 50 ? "bg-brand-primary shadow-[0_0_10px_rgba(91,75,138,0.3)]" : "bg-rose-500"
                              )}
                            />
                          </div>
                          <span className="text-xs font-black tabular-nums opacity-80">{vendor.healthScore}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Compliance Cards (MOBILE) */}
      <div className="lg:hidden space-y-4 mb-20">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="glass p-6 rounded-3xl animate-pulse h-40 flex items-center justify-center text-muted-foreground">
                Hydrating Legal Cache...
              </div>
            ))
          ) : filteredVendors.length === 0 ? (
            <div className="glass p-12 rounded-3xl text-center text-muted-foreground">
              No matching legal records found.
            </div>
          ) : (
            filteredVendors.map((vendor: ComplianceVendor, idx: number) => (
              <motion.div 
                key={vendor.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass p-6 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm active-scale"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-foreground truncate max-w-[200px]">{vendor.companyName}</span>
                    <span className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">ID: {vendor.id} • CR: {vendor.registrationNumber?.slice(0,8) || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-black/5">
                    <span className="text-xs font-black tabular-nums">{vendor.healthScore}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <MobileDocCell label="CR" doc={vendor.docs.registration} />
                  <MobileDocCell label="Tax" doc={vendor.docs.tax} />
                  <MobileDocCell label="Card" doc={vendor.docs.establishment} />
                  <MobileDocCell label="Contract" doc={vendor.docs.contract} />
                </div>

                <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${vendor.healthScore}%` }}
                    className={cn(
                      "h-full rounded-full",
                      vendor.healthScore === 100 ? "bg-emerald-500" :
                      vendor.healthScore > 50 ? "bg-brand-primary" : "bg-rose-500"
                    )}
                  />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Persistent Background Textures */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-background transition-colors duration-700">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[160px] animate-fluid-drift" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[140px] [animation-delay:2s] animate-fluid-drift" />
      </div>
    </div>
  )
}

// ─── HELPER: COMPLIANCE CELL ──────────────────────────────────────────────
function ComplianceCell({ doc }: { doc: ComplianceDoc }) {
  if (!doc || doc.status === "missing") {
    return (
      <td className="p-6 text-center">
        <div className="flex justify-center group/icon">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-500/5 border border-rose-500/20 dark:border-rose-500/10 flex items-center justify-center text-rose-500/60 dark:text-rose-500/30 group-hover/icon:bg-rose-500/20 group-hover/icon:text-rose-500 transition-all duration-300 cursor-help relative hover:scale-110 shadow-sm">
            <AlertCircle className="w-4 h-4" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-32 bg-gray-900 dark:bg-black p-2.5 rounded-xl opacity-0 group-hover/icon:opacity-100 transition-all duration-300 pointer-events-none text-[9px] font-black uppercase tracking-widest text-white border border-white/10 shadow-2xl z-50 scale-95 group-hover/icon:scale-100 origin-bottom">
              Missing Documentation
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-black rotate-45 border-r border-b border-white/10"></div>
            </div>
          </div>
        </div>
      </td>
    )
  }

  return (
    <td className="p-6 text-center">
      <div className="flex justify-center group/icon">
        <button 
          onClick={() => doc.file && window.open(doc.file.url, "_blank")}
          className="w-8 h-8 rounded-lg bg-brand-secondary/10 dark:bg-brand-secondary/5 border border-brand-secondary/20 dark:border-brand-secondary/10 flex items-center justify-center text-brand-secondary group-hover/icon:bg-brand-secondary/20 group-hover/icon:text-brand-secondary transition-all duration-300 relative hover:scale-110 shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-gray-900 dark:bg-black p-3 rounded-xl opacity-0 group-hover/icon:opacity-100 transition-all duration-300 pointer-events-none text-left border border-white/10 shadow-2xl z-50 scale-95 group-hover/icon:scale-100 origin-bottom">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Authenticated</p>
            <p className="text-xs font-bold text-white truncate max-w-full leading-tight">{doc.file?.name}</p>
            <p className="text-[9px] text-white/50 mt-1.5 uppercase font-bold tracking-wider">Uploaded {doc.file?.date ? new Date(doc.file.date).toLocaleDateString() : 'N/A'}</p>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-black rotate-45 border-r border-b border-white/10"></div>
          </div>
        </button>
      </div>
    </td>
  )
}

function MobileDocCell({ label, doc }: { label: string, doc: ComplianceDoc }) {
  const isMissing = !doc || doc.status === "missing";
  return (
    <div 
      onClick={() => (!isMissing && doc?.file) ? window.open(doc.file.url, "_blank") : undefined}
      className={cn(
        "flex flex-col gap-2 p-3.5 rounded-2xl border transition-all duration-300",
        isMissing 
          ? "bg-rose-500/5 border-rose-500/20 text-rose-500/80" 
          : "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 active:bg-emerald-500/10 active:scale-95 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</span>
        {isMissing ? <AlertCircle className="w-4 h-4 opacity-50" /> : <CheckCircle2 className="w-4 h-4" />}
      </div>
      <span className="text-xs font-bold uppercase truncate">
        {isMissing ? "Missing" : "View Proof"}
      </span>
    </div>
  )
}
