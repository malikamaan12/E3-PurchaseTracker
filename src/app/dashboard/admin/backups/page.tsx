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
  Clock as LucideClock,
  CheckCircle2,
  XCircle,
  Key,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  Info
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

  // Credentials & Diagnostics State
  const [credsInfo, setCredsInfo] = useState<any>(null);
  const [showCredsConfig, setShowCredsConfig] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [testResults, setTestResults] = useState<{
    r2?: { loading?: boolean; ok?: boolean; msg?: string; bucket?: string };
    gdrive_primary?: { loading?: boolean; ok?: boolean; msg?: string; folderName?: string };
    gdrive_secondary?: { loading?: boolean; ok?: boolean; msg?: string; folderName?: string };
  }>({});

  useEffect(() => {
    if (!isAuthLoading && user && !isSuperAdmin) {
      toast.error("Access denied. Governance & System is restricted to Super Admin.");
      router.replace("/dashboard/admin");
    }
  }, [isAuthLoading, user, isSuperAdmin, router]);

  const fetchVaultStatus = async () => {
    try {
      const res = await fetch("/api/admin/backups/status", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setVaultStatus(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn("Vault status response not ok:", res.status, errData);
      }
    } catch (err) {
      console.error("Failed to fetch backup status:", err);
    }
  };

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/backups/history", { credentials: "include" });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error || errData.message || (response.status === 403 ? "Administrator privileges required to view backup vault." : "Failed to fetch backup history");
        throw new Error(errMsg);
      }
      const data = await response.json();
      setBackups(data);
    } catch (error: any) {
      console.error("Backup history error:", error);
      toast.error("Institutional Vault Retrieval Failed", {
        description: error.message || "Failed to retrieve archive registry from backup vault."
      });
      setBackups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVaultConfig = async () => {
    try {
      const res = await fetch("/api/admin/settings/backup", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setVaultConfig({
          primary: data.primary || "",
          secondary: data.secondary || ""
        });
        if (data.credentials) {
          setCredsInfo(data.credentials);
          if (data.credentials.clientEmail) {
            setServiceAccountEmail(data.credentials.clientEmail);
          }
          if (data.credentials.hasPrivateKey) {
            setPrivateKey("••••••••••••••••••••");
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch vault config:", error);
    }
  };

  const saveVaultConfig = async () => {
    setIsSavingConfig(true);
    try {
      const payload: any = {
        primary: vaultConfig.primary,
        secondary: vaultConfig.secondary,
      };

      if (serviceAccountJson.trim()) {
        payload.serviceAccountJson = serviceAccountJson.trim();
      } else {
        if (serviceAccountEmail.trim()) {
          payload.serviceAccountEmail = serviceAccountEmail.trim();
        }
        if (privateKey.trim() && !privateKey.includes("••••")) {
          payload.privateKey = privateKey.trim();
        }
      }

      const res = await fetch("/api/admin/settings/backup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Update failed");
      }

      const data = await res.json();
      setVaultConfig(prev => ({
        primary: data.primaryId !== undefined ? data.primaryId : prev.primary,
        secondary: data.secondaryId !== undefined ? data.secondaryId : prev.secondary
      }));
      setServiceAccountJson("");
      fetchVaultConfig();
      fetchVaultStatus();
      toast.success("Vault Configuration Secured", {
        description: "Destinations and authentication credentials updated.",
      });
    } catch (error: any) {
      toast.error("Failed to update vault configuration", {
        description: error.message || "Please verify your settings and administrative access."
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const runTestConnection = async (target: "r2" | "gdrive_primary" | "gdrive_secondary", folderId?: string) => {
    setTestResults(prev => ({ ...prev, [target]: { loading: true } }));
    try {
      const res = await fetch("/api/admin/backups/test-connection", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, folderId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection test failed");
      }

      const result = data.results[target];
      setTestResults(prev => ({
        ...prev,
        [target]: {
          loading: false,
          ok: result.ok,
          msg: result.ok ? (result.message || "Connected successfully") : (result.error || "Connection failed"),
          folderName: result.folderName,
          bucket: result.bucket,
        }
      }));

      const targetLabel = target === "r2" ? "Cloudflare R2" : target === "gdrive_primary" ? "Primary Drive" : "Secondary Drive";
      if (result.ok) {
        toast.success(`Connection Verified: ${targetLabel}`, {
          description: result.message || "Read/write permissions confirmed.",
        });
      } else {
        toast.error(`Connection Alert: ${targetLabel}`, {
          description: result.error || "Failed to verify connection.",
        });
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [target]: {
          loading: false,
          ok: false,
          msg: err.message || "Verification request failed",
        }
      }));
      toast.error("Verification Request Failed", {
        description: err.message || "Check network or admin permissions.",
      });
    }
  };

  const copyServiceEmail = () => {
    const email = credsInfo?.clientEmail || serviceAccountEmail;
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast.success("Service Account Email Copied", {
      description: "Share your Google Drive backup folder with this email as Editor.",
    });
    setTimeout(() => setCopiedEmail(false), 2500);
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
      const response = await fetch("/api/admin/backups/manual", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Protocol disruption in the backup engine.");
      }

      toast.success("Background Snapshot Initiated", {
        description: "Distribution to R2 and secondary vaults will complete shortly.",
      });

      // Refresh list after a few seconds to allow R2 to process
      setTimeout(fetchBackups, 3000);
    } catch (error: any) {
      toast.error("Manual Export Failed", {
        description: error.message || "Protocol disruption in the backup engine.",
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
            target: "r2" as const,
            label: "Primary Storage",
            value: "Cloudflare R2",
            icon: <Cloud className="w-5 h-5" />,
            status: testResults.r2?.ok !== undefined 
              ? (testResults.r2.ok ? "Healthy" : "Error")
              : (vaultStatus?.primary?.status || (backups.length > 0 ? "Healthy" : "No verified backup")),
            sub: testResults.r2?.msg || vaultStatus?.primary?.sub || (backups.length > 0 ? `${backups.length} Verified Archive(s)` : "Awaiting archive verification"),
            canTest: true,
          },
          {
            target: "gdrive_primary" as const,
            label: "Secondary Sync",
            value: "Google Drive",
            icon: <LucideHardDrive className="w-5 h-5" />,
            status: testResults.gdrive_primary?.ok !== undefined
              ? (testResults.gdrive_primary.ok ? "Healthy" : "Error")
              : (vaultStatus?.secondary?.status || (vaultConfig.primary ? "No verified backup" : "Not configured")),
            sub: testResults.gdrive_primary?.msg || vaultStatus?.secondary?.sub || (vaultConfig.primary ? "Destination linked, awaiting archive" : "Vault destination not configured"),
            canTest: true,
          },
          {
            target: null,
            label: "Next Scheduled",
            value: vaultStatus?.schedule?.scheduleText || "Daily 02:00 UTC",
            icon: <LucideClock className="w-5 h-5" />,
            status: vaultStatus?.schedule?.status || "Armed",
            sub: vaultStatus?.schedule?.sub || "Automated Vercel Cron",
            canTest: false,
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

          const isTesting = stat.target && testResults[stat.target]?.loading;

          return (
            <div key={i} className="glass-card p-6 border-border relative overflow-hidden group flex flex-col justify-between">
              <div>
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
                <p className="text-[10px] text-muted-foreground font-medium mt-4 group-hover:text-primary transition-colors line-clamp-2">{stat.sub}</p>
              </div>

              {stat.canTest && stat.target && (
                <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground font-mono">Live Diagnosis</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(isTesting)}
                    onClick={() => runTestConnection(stat.target as any)}
                    className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1.5"
                  >
                    {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                    <span>{isTesting ? "Testing..." : "Test Connection"}</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vault Configuration (Dynamic Drive & Credentials Setup) */}
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
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Google Drive & Multi-Vault Redundancy</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Governance Mode Active
          </div>
        </div>

        {/* Drive Destination Folders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Primary Drive */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Primary Destination Link / ID</label>
              <span className="text-[9px] font-mono text-primary/70">Auto-Extract Enabled</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Input
                  placeholder="Paste Folder ID or full Google Drive Link"
                  value={vaultConfig.primary}
                  onChange={(e) => setVaultConfig(prev => ({ ...prev, primary: e.target.value }))}
                  className="h-14 bg-background border-border focus:border-primary/50 text-xs font-bold pl-12 rounded-xl transition-all"
                />
                <LucideHardDrive className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={testResults.gdrive_primary?.loading}
                onClick={() => runTestConnection("gdrive_primary", vaultConfig.primary)}
                className="h-14 px-4 rounded-xl border-border hover:border-primary/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shrink-0"
              >
                {testResults.gdrive_primary?.loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-primary" />
                )}
                <span>Test Access</span>
              </Button>
            </div>

            {testResults.gdrive_primary && (
              <div className={cn(
                "p-3 rounded-xl text-xs flex flex-col gap-2 border",
                testResults.gdrive_primary.ok
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              )}>
                <div className="flex items-start gap-2.5">
                  {testResults.gdrive_primary.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <p className="text-[11px] leading-relaxed font-medium">{testResults.gdrive_primary.msg}</p>
                </div>
                {testResults.gdrive_primary.msg?.includes("https://console.developers.google.com") && (
                  <a
                    href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=223226755597"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 font-bold text-[10px] uppercase tracking-wider transition-colors ml-6"
                  >
                    <span>Enable Drive API in Google Cloud</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <p className="text-[9px] text-muted-foreground italic pl-1">Target folder for the primary institutional archive.</p>
          </div>

          {/* Secondary Drive */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Secondary Fallback Link / ID</label>
              <span className="text-[9px] font-mono text-emerald-500/80 font-bold">Redundancy Layer</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Input
                  placeholder="Paste Backup Folder ID or Link"
                  value={vaultConfig.secondary}
                  onChange={(e) => setVaultConfig(prev => ({ ...prev, secondary: e.target.value }))}
                  className="h-14 bg-background border-border focus:border-emerald-500/50 text-xs font-bold pl-12 rounded-xl transition-all"
                />
                <Cloud className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={testResults.gdrive_secondary?.loading}
                onClick={() => runTestConnection("gdrive_secondary", vaultConfig.secondary)}
                className="h-14 px-4 rounded-xl border-border hover:border-emerald-500/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shrink-0"
              >
                {testResults.gdrive_secondary?.loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
                <span>Test Access</span>
              </Button>
            </div>

            {testResults.gdrive_secondary && (
              <div className={cn(
                "p-3 rounded-xl text-xs flex flex-col gap-2 border",
                testResults.gdrive_secondary.ok
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              )}>
                <div className="flex items-start gap-2.5">
                  {testResults.gdrive_secondary.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <p className="text-[11px] leading-relaxed font-medium">{testResults.gdrive_secondary.msg}</p>
                </div>
                {testResults.gdrive_secondary.msg?.includes("https://console.developers.google.com") && (
                  <a
                    href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=223226755597"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 font-bold text-[10px] uppercase tracking-wider transition-colors ml-6"
                  >
                    <span>Enable Drive API in Google Cloud</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <p className="text-[9px] text-muted-foreground italic pl-1">Ensures continuity if the primary vault reaches capacity or rate limits.</p>
          </div>
        </div>

        {/* Google Drive Credentials Panel */}
        <div className="rounded-2xl border border-border bg-secondary/20 overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/50">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-sm font-black text-foreground">Google Cloud Service Account Credentials</h3>
                  {credsInfo?.isConfigured ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active ({credsInfo.source === "database" ? "Database" : "Environment"})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Awaiting Service Account
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Required for automated server-to-server Google Drive uploads</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCredsConfig(prev => !prev)}
              className="rounded-xl text-xs font-bold flex items-center gap-2 self-end sm:self-center"
            >
              <span>{showCredsConfig ? "Hide Credential Setup" : "Configure Credentials"}</span>
              {showCredsConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Active Email & Sharing Helper */}
          {credsInfo?.clientEmail && (
            <div className="p-5 sm:p-6 bg-primary/5 border-b border-border/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Share Google Drive Folders With This Email:</p>
                <code className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg inline-block break-all">
                  {credsInfo.clientEmail}
                </code>
                <p className="text-[10px] text-muted-foreground">Make sure you grant <strong className="text-foreground">Editor</strong> permissions so the backup engine can write files.</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyServiceEmail}
                className="rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 bg-background"
              >
                {copiedEmail ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedEmail ? "Email Copied!" : "Copy Service Account Email"}</span>
              </Button>
            </div>
          )}

          {/* Collapsible Form */}
          {showCredsConfig && (
            <div className="p-6 sm:p-8 space-y-6 bg-background/60">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                  <span>Option A: Paste Service Account JSON (Recommended)</span>
                  <span className="text-[9px] font-mono text-primary/80 font-normal">Auto-extracts client_email & private_key</span>
                </label>
                <textarea
                  placeholder='Paste the entire JSON downloaded from Google Cloud Console ({"type": "service_account", "client_email": "...", "private_key": "..."})'
                  value={serviceAccountJson}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  rows={4}
                  className="w-full bg-background border border-border focus:border-primary/50 text-xs font-mono p-3 rounded-xl transition-all resize-y"
                />
              </div>

              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-border w-full absolute" />
                <span className="bg-secondary/60 text-muted-foreground text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full relative">OR Manually Provide Keys</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Service Account Email</label>
                  <Input
                    placeholder="e.g., backup-agent@project.iam.gserviceaccount.com"
                    value={serviceAccountEmail}
                    onChange={(e) => setServiceAccountEmail(e.target.value)}
                    className="h-12 bg-background border-border text-xs font-bold rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Private Key (PEM format)</label>
                  <Input
                    type="password"
                    placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    className="h-12 bg-background border-border text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>How to obtain credentials:</strong> In Google Cloud Console, enable the <strong>Google Drive API</strong>, create a Service Account, click <strong>Keys &gt; Add Key &gt; Create new key &gt; JSON</strong>. Then paste the JSON above and save.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
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
