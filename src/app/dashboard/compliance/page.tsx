"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"
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
  AlertCircle,
  Settings2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePerformance } from "@/context/PerformanceContext"
import { usePageTitle } from "@/lib/hooks/usePageTitle"
import { ComplianceSettingsModal } from "@/components/compliance/ComplianceSettingsModal"
import { useAuth } from "@/context/AuthContext"

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
    <div className="bg-background/80 backdrop-blur-xl p-6 rounded-[2rem] border border-border/50 shadow-lg relative overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/40">
      <div className={cn("absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-20 transition-all duration-700 group-hover:scale-150 group-hover:opacity-40", color)} />
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors mb-4">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-4xl font-serif text-foreground tracking-tight group-hover:text-primary transition-colors">{value}</h3>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{sub}</span>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ComplianceGatewayPage() {
  usePageTitle("Compliance Gateway")
  const { user } = useAuth()
  const { highPerformanceMode } = usePerformance()
  const [search, setSearch] = React.useState("")
  const [isScanning, setIsScanning] = React.useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const queryClient = useQueryClient()

  const handleScan = async () => {
    setIsScanning(true);
    toast.info("Executing system-wide compliance audit scan...");
    try {
      const res = await fetch("/api/admin/compliance/scan", { method: "POST" });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Scan failed");
      toast.success(resData.message || "Compliance audit completed successfully!");
      await queryClient.invalidateQueries({ queryKey: ["compliance-status"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to complete compliance scan");
    } finally {
      setIsScanning(false);
    }
  }

  const handleExport = () => {
    if (!data?.vendors || data.vendors.length === 0) {
      toast.error("No compliance data available to export");
      return;
    }
    toast.info("Exporting compliance audit CSV...");
    const csvContent = [
      ["Vendor Entity", "Registration", "Tax", "Establishment", "Contract", "Health Score"],
      ...data.vendors.map((v: ComplianceVendor) => [
        `"${v.companyName}"`,
        v.docs.registration?.status || "missing",
        v.docs.tax?.status || "missing",
        v.docs.establishment?.status || "missing",
        v.docs.contract?.status || "missing",
        `${v.healthScore}%`
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `E3_Compliance_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Compliance Audit CSV downloaded");
  }

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

  const auditQuarter = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`

  return (
    <div className="relative min-h-screen p-4 sm:p-8 w-full overflow-hidden">
      {/* 1. Header & Global Analytics */}
      <header className="flex flex-col lg:flex-row justify-between items-start gap-6 lg:gap-8 mb-8 sm:mb-12 relative z-10">
        <div className="max-w-xl">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="p-3 bg-brand-primary/10 rounded-2xl border border-brand-primary/20 shrink-0">
              <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-serif text-foreground tracking-tight">Compliance Gateway</h1>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-widest mt-0.5 opacity-60">
                System-Wide Regulatory Audit • {auditQuarter}
              </p>
            </div>
          </div>
          <p className="text-sm text-foreground/60 leading-relaxed">
            Centralized intelligence hub for monitoring vendor legality. This gateway aggregates proof-of-registration 
            and tax certificates across the entire procurement lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full lg:w-auto min-w-0 sm:min-w-[500px]">
          <KpiDisk
            label="System Health"
            value={data?.summary?.systemHealth || 0}
            sub="%"
            color="bg-emerald-500"
          />
          <KpiDisk
            label="Fully Secured"
            value={data?.summary?.fullyCompliant || 0}
            sub="vendors"
            color="bg-primary"
          />
          <KpiDisk
            label="Regulatory Risk"
            value={data?.summary?.highRisk || 0}
            sub="critical"
            color="bg-rose-500"
          />
        </div>
      </header>

      {/* 2. Controls */}
      <section className="bg-background/80 backdrop-blur-md rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch md:items-center shadow-lg border border-border/50 relative overflow-hidden mb-8 sticky top-20 z-40">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text"
            placeholder="Search vendor legal cache..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-12 pr-4 py-3 min-h-[44px] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {user?.role === "super_admin" && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Compliance Policy Settings"
              className="min-h-[44px] px-4 bg-secondary/40 hover:bg-secondary/70 border border-border/50 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground touch-target flex-1 sm:flex-none shadow-sm"
            >
              <Settings2 className="w-4 h-4 text-primary" /> Policy Settings
            </button>
          )}
          <button
            onClick={handleExport}
            aria-label="Export Compliance Audit CSV"
            className="min-h-[44px] px-5 bg-secondary/30 hover:bg-secondary/60 border border-transparent hover:border-border/50 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground touch-target flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4" /> Export Audit
          </button>
          <button 
            onClick={handleScan}
            disabled={isScanning}
            aria-label="Run Compliance Scan"
            className="min-h-[44px] px-5 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none shrink-0 touch-target flex-1 sm:flex-none"
          >
            {isScanning ? <ShieldAlert className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} 
            {isScanning ? "Scanning Vault..." : "Run Compliance Scan"}
          </button>
        </div>
      </section>

      <ComplianceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 3. Compliance Matrix (DESKTOP) */}
      <div className="hidden lg:block bg-background/80 backdrop-blur-xl p-1 rounded-[2rem] border border-border/50 mb-20 overflow-x-auto custom-scrollbar shadow-lg">
        <div className="rounded-[30px] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="p-6 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendor Entity</th>
                <th className="p-6 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground w-40">Registration (CR)</th>
                <th className="p-6 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground w-40">Tax Certificate</th>
                <th className="p-6 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground w-40">Computer Card</th>
                <th className="p-6 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground w-40">Master Contract</th>
                <th className="p-6 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground w-48">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="p-12 text-center text-muted-foreground font-bold uppercase tracking-wider text-sm">Hydrating Legal Matrix...</td>
                    </tr>
                  ))
                ) : filteredVendors.length === 0 ? (
                  <tr><td colSpan={6} className="p-20 text-center text-muted-foreground font-bold uppercase tracking-wider text-sm">No records found matching your query.</td></tr>
                ) : (
                  filteredVendors.map((vendor: ComplianceVendor, idx: number) => (
                    <tr 
                      key={vendor.id}
                      className="group hover:bg-primary/[0.02] transition-colors animate-slide-up"
                      style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}
                    >
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {vendor.companyName}
                          </span>
                          <span className="text-[11px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
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
                          <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full shrink-0 transition-all duration-700",
                                vendor.healthScore === 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" :
                                vendor.healthScore > 50 ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "bg-rose-500"
                              )}
                              style={{ width: `${vendor.healthScore}%` }}
                            />
                          </div>
                          <span className="text-xs font-black tabular-nums">{vendor.healthScore}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Compliance Cards (MOBILE) */}
      <div className="lg:hidden space-y-4 mb-20">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-background/80 backdrop-blur-md p-6 rounded-3xl animate-pulse h-40 flex items-center justify-center text-muted-foreground font-bold uppercase tracking-wider text-sm">
                Hydrating Legal Cache...
              </div>
            ))
          ) : filteredVendors.length === 0 ? (
            <div className="bg-background/80 backdrop-blur-md p-12 rounded-3xl text-center text-muted-foreground font-bold uppercase tracking-wider text-sm">
              No matching legal records found.
            </div>
          ) : (
            filteredVendors.map((vendor: ComplianceVendor, idx: number) => (
              <div 
                key={vendor.id}
                className="bg-background/80 backdrop-blur-xl p-6 rounded-[2rem] border border-border/50 shadow-lg animate-slide-up group hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-foreground truncate max-w-[200px]">{vendor.companyName}</span>
                    <span className="text-[10px] font-bold text-muted-foreground mt-1 uppercase">ID: {vendor.id} • CR: {vendor.registrationNumber?.slice(0,8) || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-xl border border-border/50">
                    <span className="text-xs font-black tabular-nums">{vendor.healthScore}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <MobileDocCell label="CR" doc={vendor.docs.registration} />
                  <MobileDocCell label="Tax" doc={vendor.docs.tax} />
                  <MobileDocCell label="Card" doc={vendor.docs.establishment} />
                  <MobileDocCell label="Contract" doc={vendor.docs.contract} />
                </div>

                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      vendor.healthScore === 100 ? "bg-emerald-500" :
                      vendor.healthScore > 50 ? "bg-primary" : "bg-rose-500"
                    )}
                    style={{ width: `${vendor.healthScore}%` }}
                  />
                </div>
              </div>
            ))
          )}
      </div>

      {/* Persistent Background Textures */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-background transition-colors duration-700">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[160px] animate-fluid-drift" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[140px] [animation-delay:2s] animate-fluid-drift" />
      </div>
    </div>
  )
}

function ComplianceCell({ doc }: { doc: ComplianceDoc }) {
  if (!doc || doc.status === "missing") {
    return (
      <td className="p-6 text-center">
        <div className="flex justify-center group/icon">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500/80 group-hover/icon:bg-rose-500/20 group-hover/icon:text-rose-500 transition-all duration-300 cursor-help relative hover:scale-110 shadow-sm">
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

  const viewUrl = doc.file?.url ? `/api/documents/view?url=${encodeURIComponent(doc.file.url)}` : undefined;

  return (
    <td className="p-6 text-center">
      <div className="flex justify-center group/icon">
        <button 
          onClick={() => viewUrl && window.open(viewUrl, "_blank")}
          className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover/icon:bg-emerald-500/20 group-hover/icon:text-emerald-500 transition-all duration-300 relative hover:scale-110 shadow-sm"
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
  const viewUrl = doc?.file?.url ? `/api/documents/view?url=${encodeURIComponent(doc.file.url)}` : undefined;
  return (
    <div 
      onClick={() => (!isMissing && viewUrl) ? window.open(viewUrl, "_blank") : undefined}
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
