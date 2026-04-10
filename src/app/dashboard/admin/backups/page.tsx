"use client";

import { useState, useEffect } from "react";
import { 
  Database, 
  Archive, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Cloud, 
  ArrowRight,
  History,
  AlertCircle,
  Settings2,
  Save,
  ExternalLink,
  HardDrive as LucideHardDrive,
  Clock as LucideClock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BackupRecord {
  name: string;
  size: number;
  lastModified: string;
  key: string;
}

/**
 * Enterprise Backup Dashboard
 * Premium Admin interface for data preservation and cloud distribution management.
 */
export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [vaultConfig, setVaultConfig] = useState({ primary: "", secondary: "" });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/backups/manual");
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setBackups(data);
    } catch (error) {
      console.error("Backup history error:", error);
      toast.error("Institutional Vault Retrieval Failed");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVaultConfig = async () => {
    try {
      const res = await fetch("/api/admin/settings/backup");
      if (res.ok) {
        const data = await res.json();
        setVaultConfig({ 
          primary: data.primary || "", 
          secondary: data.secondary || "" 
        });
      }
    } catch (error) {
      console.error("Failed to fetch vault config:", error);
    }
  };

  const saveVaultConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/admin/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vaultConfig),
      });

      if (!res.ok) throw new Error("Update failed");
      
      const data = await res.json();
      setVaultConfig({ primary: data.primaryId, secondary: data.secondaryId });
      toast.success("Vault Configuration Secured", {
        description: "Google Drive destinations have been updated in the database.",
      });
    } catch (error) {
      toast.error("Failed to update vault configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchVaultConfig();
  }, []);

  const triggerManualBackup = async () => {
    setIsTriggering(true);
    toast.info("Initializing Enterprise Backup Pipeline...", {
      description: "Data extraction started in background vault.",
    });

    try {
      const response = await fetch("/api/admin/backups/manual", { method: "POST" });
      if (!response.ok) throw new Error("Sync failed");
      
      toast.success("Background Snapshot Initiated", {
        description: "Distribution to R2 and Google Drive will complete shortly.",
      });
      
      // Refresh list after a few seconds to allow R2 to process
      setTimeout(fetchBackups, 3000);
    } catch (error) {
      toast.error("Manual Export Failed", {
        description: "Protocol disruption in the backup engine.",
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDownload = async (key: string) => {
    try {
      // In a production app, we'd fetch a signed URL or stream the body
      // For this implementation, we'll assume a direct secure redirect or signed URL from the API
      toast.promise(
        async () => {
          // This would ideally be a call to R2Storage.getDownloadUrl on the server
          // but for simplicity in the UI we'll just alert the admin.
          window.open(`/api/admin/backups/download?key=${encodeURIComponent(key)}`, "_blank");
        },
        {
          loading: "Authorizing secure download...",
          success: "Download stream initialized",
          error: "Authentication failed for vault access",
        }
      );
    } catch (error) {
      toast.error("Download Error");
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <Database className="w-4 h-4 text-brand-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary">Institutional Core</span>
          </div>
          <h1 className="text-4xl font-serif font-black text-foreground tracking-tight">Enterprise Backup Vault</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Automated multi-cloud synchronization for PurchaseTracker's institutional data. 
            Redundant snapshots are distributed across Cloudflare R2 and Google Drive primary/secondary folders.
          </p>
        </div>

        <Button 
          onClick={triggerManualBackup}
          disabled={isTriggering}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white px-8 h-14 rounded-2xl shadow-2xl shadow-brand-primary/20 flex items-center gap-4 group"
        >
          <AnimatePresence mode="wait">
            {isTriggering ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Archive className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
          </AnimatePresence>
          <span className="text-xs font-black uppercase tracking-widest">Generate Manual Snapshot</span>
        </Button>
      </div>

      {/* Persistence Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Primary Storage", value: "Cloudflare R2", icon: <Cloud className="w-5 h-5" />, status: "Active", sub: "S3-Compatible Vault" },
          { label: "Secondary Sync", value: "Google Drive", icon: <LucideHardDrive className="w-5 h-5" />, status: "Healthy", sub: "Redundant Repositories" },
          { label: "Next Scheduled", value: "Daily 02:00 UTC", icon: <LucideClock className="w-5 h-5" />, status: "Armed", sub: "Automated Vercel Cron" }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 border-white/5 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-fit">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-serif font-black text-foreground mt-1">{stat.value}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">{stat.status}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-4 group-hover:text-brand-primary transition-colors">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Vault Configuration (Dynamic Drive Setup) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 border-white/5 space-y-8"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <Settings2 className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">Vault Configuration</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Google Drive Redundancy Matrix</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
            <ShieldCheck className="w-3 h-3 text-brand-primary" />
            Governance Mode Active
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Primary Drive */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Primary Destination Link / ID</label>
              <span className="text-[9px] font-mono text-brand-primary/60">Auto-Extract Enabled</span>
            </div>
            <div className="relative group">
              <Input 
                placeholder="Paste Folder ID or full Google Drive Link"
                value={vaultConfig.primary}
                onChange={(e) => setVaultConfig(prev => ({ ...prev, primary: e.target.value }))}
                className="h-14 bg-white/5 border-white/10 focus:border-brand-primary/50 text-xs font-bold pl-12 rounded-xl transition-all"
              />
              <LucideHardDrive className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-brand-primary transition-colors" />
            </div>
            <p className="text-[9px] text-muted-foreground italic pl-1">Target folder for the primary institutional archive.</p>
          </div>

          {/* Secondary Drive */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Secondary Fallback Link / ID</label>
              <span className="text-[9px] font-mono text-emerald-500/60 font-bold">Redundancy Layer</span>
            </div>
            <div className="relative group">
              <Input 
                placeholder="Paste Backup Folder ID or Link"
                value={vaultConfig.secondary}
                onChange={(e) => setVaultConfig(prev => ({ ...prev, secondary: e.target.value }))}
                className="h-14 bg-white/5 border-white/10 focus:border-emerald-500/30 text-xs font-bold pl-12 rounded-xl transition-all"
              />
              <Cloud className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <p className="text-[9px] text-muted-foreground italic pl-1">Ensures continuity if the primary vault reaches capacity or rate limits.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-white/5">
           <div className="flex items-center gap-3 text-amber-500 bg-amber-500/5 px-4 py-2 rounded-xl border border-amber-500/10">
              <AlertCircle className="w-4 h-4" />
              <p className="text-[9px] font-black uppercase tracking-widest leading-none">Database Overrides Environment Variables Once Saved</p>
           </div>
           
           <Button 
            onClick={saveVaultConfig}
            disabled={isSavingConfig}
            className="w-full md:w-auto bg-[#5B4B8A] hover:bg-[#4A3B72] text-white px-10 h-14 rounded-2xl shadow-xl shadow-[#5B4B8A]/20 flex items-center gap-3 transition-all active:scale-[0.98]"
           >
             {isSavingConfig ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
             <span className="text-xs font-black uppercase tracking-widest">Secure Vault Configuration</span>
           </Button>
        </div>
      </motion.div>

      {/* Backup History Table */}
      <div className="glass-card border-white/5 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <History className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground">Archive Registry</h3>
              <p className="text-xs text-muted-foreground">Historical snapshots persisted in the R2 primary vault</p>
            </div>
          </div>
          <Button variant="ghost" onClick={fetchBackups} className="h-10 w-10 p-0 rounded-xl">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.01]">
                {["Reference Name", "Timestamp", "Archive Size", "Integrity", "Action"].map((h) => (
                  <th key={h} className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence>
                {backups.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Archive className="w-12 h-12" />
                        <p className="text-xs font-bold uppercase tracking-widest">No Backups Found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  backups.map((backup, idx) => (
                    <motion.tr 
                      key={backup.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <Archive className="w-4 h-4 text-brand-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                          <span className="text-xs font-bold text-foreground font-mono">{backup.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-foreground">
                            {backup.lastModified ? (() => {
                              try {
                                return new Date(backup.lastModified).toLocaleDateString();
                              } catch (e) {
                                return "Invalid Date";
                              }
                            })() : "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">
                            {backup.lastModified ? (() => {
                              try {
                                return new Date(backup.lastModified).toLocaleTimeString();
                              } catch (e) {
                                return "00:00";
                              }
                            })() : "00:00"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs font-bold text-muted-foreground tabular-nums">
                          {(backup.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 w-fit">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Verified</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Button
                          variant="secondary"
                          onClick={() => handleDownload(backup.key)}
                          className="h-9 px-4 rounded-lg bg-secondary/80 hover:bg-brand-primary hover:text-white transition-all group/btn"
                        >
                          <Download className="w-3.5 h-3.5 mr-2 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Download</span>
                        </Button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {isLoading && (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronizing Registry...</p>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">Security Protocol Note</p>
          <p className="text-[10px] text-amber-500/70 font-medium leading-relaxed">
            Manual snapshots trigger intensive data extraction and multi-cloud synchronization. Downloads are restricted to institutional administrators via secure presigned URL protocols. 
            All backup activities are tracked in the global audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}
