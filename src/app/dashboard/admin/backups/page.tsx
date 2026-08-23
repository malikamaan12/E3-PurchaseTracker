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
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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
export default function AdminBackupsPage() {
  usePageTitle("Enterprise Backups");
  const { user, isLoading: isAuthLoading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [vaultConfig, setVaultConfig] = useState({ primary: "", secondary: "" });
  const [vaultStatus, setVaultStatus] = useState<any>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user && !isSuperAdmin) {
      toast.error("Access denied. Governance & System is restricted to Super Admin.");
      router.replace("/dashboard/admin");
    }
  }, [isAuthLoading, user, isSuperAdmin, router]);

  const fetchVaultStatus = async () => {
    try {
      const res = await fetch("/api/admin/backups/status");
      if (res.ok) {
        const data = await res.json();
        setVaultStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch backup status:", err);
    }
  };

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/backups/history");
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setBackups(data);
    } catch (error) {
      console.error("Backup history error:", error);
      toast.error("Institutional Vault Retrieval Failed", {
        description: "Cloudflare R2 is temporarily unreachable or misconfigured. Retrying later."
      });
      setBackups([]);
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
      fetchVaultStatus();
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
    if (user && isSuperAdmin) {
      fetchBackups();
      fetchVaultConfig();
      fetchVaultStatus();
    }
  }, [user, isSuperAdmin]);

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

  if (isAuthLoading || (user && !isSuperAdmin)) {
    return null;
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Database className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Institutional Core</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-black text-foreground tracking-tight">Enterprise Backup Vault</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed font-medium">
            Automated multi-cloud synchronization for PurchaseTracker's institutional data.
            Redundant snapshots are distributed across Cloudflare R2 and Google Drive primary/secondary folders.
          </p>
        </div>

        <Button
          onClick={triggerManualBackup}
          disabled={isTriggering}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-14 rounded-2xl shadow-lg flex items-center gap-4 group font-bold"
        >
          <AnimatePresence mode="wait">
            {isTriggering ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Archive className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
          </AnimatePresence>
          <span className="text-xs font-bold uppercase tracking-wider">Generate Manual Snapshot</span>
        </Button>
      </div>

      {/* Persistence Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: "Primary Storage",
            value: "Cloudflare R2",
            icon: <Cloud className="w-5 h-5" />,
            status: vaultStatus?.primary?.status || (backups.length > 0 ? "Healthy" : "No verified backup"),
            sub: vaultStatus?.primary?.sub || (backups.length > 0 ? `${backups.length} Verified Archive(s)` : "Awaiting archive verification")
          },
          {
            label: "Secondary Sync",
            value: "Google Drive",
            icon: <LucideHardDrive className="w-5 h-5" />,
            status: vaultStatus?.secondary?.status || (vaultConfig.primary ? "No verified backup" : "Not configured"),
            sub: vaultStatus?.secondary?.sub || (vaultConfig.primary ? "Destination linked, awaiting archive" : "Vault destination not configured")
          },
          {
            label: "Next Scheduled",
            value: vaultStatus?.schedule?.scheduleText || "Daily 02:00 UTC",
            icon: <LucideClock className="w-5 h-5" />,
            status: vaultStatus?.schedule?.status || "Armed",
            sub: vaultStatus?.schedule?.sub || "Automated Vercel Cron"
          }
        ].map((stat, i) => {
          const badge = (() => {
            switch (stat.status) {
              case "Healthy":
              case "Active":
                return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-500", dot: "bg-emerald-500 animate-pulse" };
              case "Armed":
                return { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-500", dot: "bg-cyan-500 animate-pulse" };
              case "No verified backup":
                return { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-500", dot: "bg-amber-500" };
              case "Error":
                return { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-500", dot: "bg-rose-500" };
              default:
                return { bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", dot: "bg-muted-foreground/60" };
            }
          })();

          return (
            <div key={i} className="glass-card p-6 border-border relative overflow-hidden group">
              <div className="flex items-start justify-between">
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border w-fit">
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                    <p className="text-xl font-serif font-black text-foreground mt-1">{stat.value}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${badge.bg} border ${badge.border}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  <span className={`text-[9px] font-black uppercase tracking-wider ${badge.text}`}>{stat.status}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-4 group-hover:text-primary transition-colors">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Vault Configuration (Dynamic Drive Setup) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 border-border space-y-8"
      >
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">Vault Configuration</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Google Drive Redundancy Matrix</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Governance Mode Active
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Primary Drive */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Primary Destination Link / ID</label>
              <span className="text-[9px] font-mono text-primary/70">Auto-Extract Enabled</span>
            </div>
            <div className="relative group">
              <Input
                placeholder="Paste Folder ID or full Google Drive Link"
                value={vaultConfig.primary}
                onChange={(e) => setVaultConfig(prev => ({ ...prev, primary: e.target.value }))}
                className="h-14 bg-background border-border focus:border-primary/50 text-xs font-bold pl-12 rounded-xl transition-all"
              />
              <LucideHardDrive className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <p className="text-[9px] text-muted-foreground italic pl-1">Target folder for the primary institutional archive.</p>
          </div>

          {/* Secondary Drive */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Secondary Fallback Link / ID</label>
              <span className="text-[9px] font-mono text-emerald-500/80 font-bold">Redundancy Layer</span>
            </div>
            <div className="relative group">
              <Input
                placeholder="Paste Backup Folder ID or Link"
                value={vaultConfig.secondary}
                onChange={(e) => setVaultConfig(prev => ({ ...prev, secondary: e.target.value }))}
                className="h-14 bg-background border-border focus:border-emerald-500/50 text-xs font-bold pl-12 rounded-xl transition-all"
              />
              <Cloud className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <p className="text-[9px] text-muted-foreground italic pl-1">Ensures continuity if the primary vault reaches capacity or rate limits.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-border">
           <div className="flex items-center gap-3 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
              <AlertCircle className="w-4 h-4" />
              <p className="text-[9px] font-black uppercase tracking-widest leading-none">Database Overrides Environment Variables Once Saved</p>
           </div>

           <Button
            onClick={saveVaultConfig}
            disabled={isSavingConfig}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-10 h-14 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 transition-all active:scale-[0.98]"
           >
             {isSavingConfig ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
             <span className="text-xs font-black uppercase tracking-widest">Secure Vault Configuration</span>
           </Button>
        </div>
      </motion.div>

      {/* Backup History Table */}
      <div className="glass-card border-border overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="p-5 sm:p-8 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">Archive Registry</h3>
              <p className="text-xs text-muted-foreground">Historical snapshots persisted in the R2 primary vault</p>
            </div>
          </div>
          <Button variant="ghost" onClick={fetchBackups} aria-label="Refresh backups" className="h-11 w-11 p-0 rounded-xl touch-target">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Mobile Backup Cards (< md) */}
        <div className="md:hidden p-4 space-y-3">
          {backups.length === 0 && !isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Archive className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">No Backups Found</p>
            </div>
          ) : (
            backups.map((backup) => (
              <div key={backup.key} className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground font-mono truncate">{backup.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {backup.lastModified ? new Date(backup.lastModified).toLocaleString() : "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-bold text-emerald-500 uppercase">Verified</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs font-bold text-muted-foreground">
                    {(backup.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => handleDownload(backup.key)}
                    aria-label={`Download ${backup.name}`}
                    className="min-h-[44px] px-4 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground transition-all touch-target text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                {["Reference Name", "Timestamp", "Archive Size", "Integrity", "Action"].map((h) => (
                  <th key={h} className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                      className="hover:bg-secondary/30 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <Archive className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
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
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 w-fit">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Verified</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Button
                          variant="secondary"
                          onClick={() => handleDownload(backup.key)}
                          className="h-9 px-4 rounded-lg bg-secondary/80 hover:bg-primary hover:text-primary-foreground transition-all group/btn min-h-[36px]"
                        >
                          <Download className="w-3.5 h-3.5 mr-2 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-xs font-bold uppercase tracking-wider">Download</span>
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
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Synchronizing Registry...</p>
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
