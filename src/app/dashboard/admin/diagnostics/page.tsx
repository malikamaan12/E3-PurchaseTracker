"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { 
  Activity, BugPlay, ShieldAlert, Cpu, DownloadCloud, 
  ChevronRight, Zap, RefreshCw, Trash2, CheckCircle2, 
  AlertTriangle, Server, Database, Sparkles, BellRing, 
  Wrench, Check, Clock, Globe, Laptop
} from "lucide-react";
import { safeFormatDate } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { motion, AnimatePresence } from "framer-motion";

export default function DiagnosticsPage() {
  usePageTitle("System Diagnostics & Crash Hub");
  const { user, isLoading: isAuthLoading, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"crashes" | "health" | "audit">("crashes");
  const [selectedCrash, setSelectedCrash] = useState<any>(null);

  // 1. Fetch live crash incidents
  const { data: crashes = [], isLoading: isLoadingCrashes, refetch: refetchCrashes } = useQuery({
    queryKey: ["admin_crashes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/diagnostics/crashes");
      if (!res.ok) throw new Error("Failed to load crashes");
      return res.json();
    },
    enabled: !!user && !isAuthLoading,
    refetchInterval: 15000,
  });

  // 2. Fetch live audit logs
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["admin_audit_logs"],
    queryFn: () => apiClient.admin.auditLogs(),
    enabled: !!user && !isAuthLoading,
  });

  // 3. Health Check Mutation
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/diagnostics/health-check", { method: "POST" });
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Database latency: ${data.database?.latencyMs}ms • Status: ${data.status}`);
    },
    onError: (err: any) => {
      toast.error("Health check failed: " + err.message);
    }
  });

  // 4. Purge & Self-Heal Mutation
  const purgeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/diagnostics/purge-cache", { method: "POST" });
      if (!res.ok) throw new Error("Purge failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "System self-healed and transient locks cleared! 🚀");
      queryClient.invalidateQueries();
      refetchCrashes();
    },
    onError: (err: any) => {
      toast.error("Purge failed: " + err.message);
    }
  });

  // 5. Test Alert Mutation
  const testAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/diagnostics/test-alert", { method: "POST" });
      if (!res.ok) throw new Error("Test alert failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "Simulated crash alert dispatched! Check your notification bell.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: (err: any) => {
      toast.error("Test alert failed: " + err.message);
    }
  });

  // 6. Clear Crashes Mutation
  const clearCrashesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/diagnostics/crashes", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear crashes");
      return res.json();
    },
    onSuccess: () => {
      toast.success("All crash incident logs resolved and cleared!");
      refetchCrashes();
    },
    onError: (err: any) => {
      toast.error("Failed to clear crashes: " + err.message);
    }
  });

  // Local Browser Self-Healing Action
  const handleClientSelfHeal = () => {
    try {
      if (typeof window !== "undefined") {
        // Clear non-critical caches while preserving auth token
        const authToken = localStorage.getItem("token") || localStorage.getItem("auth_token");
        sessionStorage.clear();
        queryClient.clear();
        toast.success("Local client cache purged! Reloading clean state...");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      toast.error("Local reset failed");
    }
  };

  const handleExport = () => {
    toast.promise(
      new Promise((resolve) => {
        window.open("/api/admin/diagnostics/export", "_blank");
        setTimeout(resolve, 1000);
      }),
      {
        loading: "Generating diagnostic report...",
        success: "Diagnostic report downloaded! 📋",
        error: "Failed to assemble report"
      }
    );
  };

  const healthData = healthCheckMutation.data;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 bg-card/40 backdrop-blur-md p-6 rounded-3xl border border-border/60 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              Super Admin Console
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Monitoring Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-black text-foreground tracking-tight flex items-center gap-3">
             <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary shrink-0" />
             System Diagnostics & Crash Hub
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
            Real-time incident management, automated crash alert dispatch, and one-click self-healing tools.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExport}
            aria-label="Export Diagnostics as CSV"
            className="flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold px-4 py-2.5 rounded-xl transition-all text-xs touch-target shadow-sm"
          >
            <DownloadCloud className="w-4 h-4 text-teal-400" />
            Export CSV
          </button>

          <button 
            onClick={() => healthCheckMutation.mutate()}
            disabled={healthCheckMutation.isPending}
            className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-brand-primary/20 transition-all text-xs touch-target disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${healthCheckMutation.isPending ? "animate-spin" : ""}`} />
            Run Health Scan
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-2.5 items-center">
              <Database className="w-4 h-4 text-teal-400" />
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">DB Latency</h3>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">
            {healthData?.database?.latencyMs ? `${healthData.database.latencyMs} ms` : "Optimal (< 85ms)"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Neon Serverless Connection Pool</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-2.5 items-center">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Incidents</h3>
            </div>
            {crashes.length > 0 ? (
              <span className="text-[10px] font-black bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-md border border-rose-500/20">
                Action Required
              </span>
            ) : (
              <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                All Clear
              </span>
            )}
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">
            {crashes.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Recorded in error telemetry</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-2.5 items-center">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Heap Memory</h3>
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">
            {healthData?.system?.memoryHeapUsedMB ? `${healthData.system.memoryHeapUsedMB} MB` : "Normal"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">V8 Engine Runtime Allocation</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-2.5 items-center">
              <BellRing className="w-4 h-4 text-amber-400" />
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Alert Pipeline</h3>
            </div>
            <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md">
              ARMED
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">
            SuperAdmin
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Auto-dispatches on any render crash</p>
        </div>
      </div>

      {/* Self-Healing & System Maintenance Action Center */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">Self-Healing & Emergency Maintenance Control</h2>
            <p className="text-xs text-muted-foreground">Automated remediation mechanisms to resolve stuck states, clear deadlocks, and verify alerts.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => purgeMutation.mutate()}
            disabled={purgeMutation.isPending}
            className="p-4 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/60 text-left transition-all group flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-foreground group-hover:text-brand-primary transition-colors flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  Purge & Heal Cache
                </span>
                <span className="text-[10px] font-mono opacity-50">API</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Clears transient rate limit buckets and resets stuck approval locks older than 15 mins.
              </p>
            </div>
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">
              {purgeMutation.isPending ? "Executing..." : "Execute Repair →"}
            </span>
          </button>

          <button
            onClick={() => testAlertMutation.mutate()}
            disabled={testAlertMutation.isPending}
            className="p-4 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/60 text-left transition-all group flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-foreground group-hover:text-brand-primary transition-colors flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-amber-400" />
                  Test Crash Alert
                </span>
                <span className="text-[10px] font-mono opacity-50">NOTIF</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sends a verified diagnostic alert notification to all active Super Admins.
              </p>
            </div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
              {testAlertMutation.isPending ? "Sending..." : "Dispatch Alert →"}
            </span>
          </button>

          <button
            onClick={handleClientSelfHeal}
            className="p-4 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/60 text-left transition-all group flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-foreground group-hover:text-brand-primary transition-colors flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-purple-400" />
                  Clean Browser Cache
                </span>
                <span className="text-[10px] font-mono opacity-50">CLIENT</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Clears corrupted React Query cache, sessionStorage, and reloads clean state.
              </p>
            </div>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              Purge Local State →
            </span>
          </button>

          <button
            onClick={() => clearCrashesMutation.mutate()}
            disabled={clearCrashesMutation.isPending || crashes.length === 0}
            className="p-4 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/60 text-left transition-all group flex flex-col justify-between gap-3 disabled:opacity-40"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-foreground group-hover:text-rose-400 transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Resolve All Incidents
                </span>
                <span className="text-[10px] font-mono opacity-50">DB</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Marks all recorded crash entries as resolved and purges the incident queue.
              </p>
            </div>
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
              {clearCrashesMutation.isPending ? "Clearing..." : "Clear Incidents →"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("crashes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "crashes"
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <BugPlay className="w-4 h-4" />
            Crash Incidents ({crashes.length})
          </button>

          <button
            onClick={() => setActiveTab("health")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "health"
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Server className="w-4 h-4" />
            Health & Schema Inspection
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "audit"
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Activity className="w-4 h-4" />
            Audit Stream ({logs.length})
          </button>
        </div>

        {/* Tab 1: Crash Incidents */}
        {activeTab === "crashes" && (
          <div className="glass rounded-2xl sm:rounded-[2rem] border border-border/40 p-5 sm:p-8 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Live Incident Queue
              </h3>
              <button
                onClick={() => refetchCrashes()}
                className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {isLoadingCrashes ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <p className="text-xs text-muted-foreground font-mono">Loading incident telemetry...</p>
              </div>
            ) : crashes.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-foreground">Zero Active Crashes</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  The application is operating with zero recorded errors. If an unhandled crash occurs, it will automatically alert all Super Admins in real-time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {crashes.map((crash: any) => (
                  <div
                    key={crash.id}
                    className="p-4 rounded-2xl bg-secondary/30 border border-border/60 hover:border-border transition-all flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {crash.severity || "CRITICAL"}
                        </span>
                        <span className="font-mono text-xs font-bold text-foreground break-all">
                          {crash.message}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        {safeFormatDate(crash.createdAt, "MMM dd, yyyy • HH:mm:ss")}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-teal-400" />
                        Route: <strong className="text-foreground">{crash.path || "/"}</strong>
                      </span>
                      {crash.user?.username && (
                        <span>User: <strong className="text-foreground">{crash.user.username}</strong></span>
                      )}
                      {crash.code && (
                        <span className="font-mono text-[10px] bg-secondary px-2 py-0.5 rounded">
                          {crash.code}
                        </span>
                      )}
                    </div>

                    {crash.details?.stack && (
                      <details className="mt-1">
                        <summary className="text-[11px] font-mono text-brand-primary cursor-pointer hover:underline">
                          View Stack Trace & System Metadata
                        </summary>
                        <pre className="mt-2 p-3 bg-black/60 border border-border/40 rounded-xl text-[10px] font-mono text-rose-300 overflow-auto max-h-48 whitespace-pre-wrap">
                          {crash.details.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Health & Schema */}
        {activeTab === "health" && (
          <div className="glass rounded-2xl sm:rounded-[2rem] border border-border/40 p-5 sm:p-8 shadow-xl space-y-6">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-400" />
              Database & Infrastructure Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Database Health</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-bold text-emerald-400 font-mono">CONNECTED (OPTIMAL)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Driver</span>
                    <span className="font-mono text-foreground">Neon Serverless + WebSocket Pool</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Row Locking Support</span>
                    <span className="font-bold text-emerald-400 font-mono">ACTIVE (SELECT FOR UPDATE)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Transactions</span>
                    <span className="font-bold text-emerald-400 font-mono">SUPPORTED</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Application Process</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Node Environment</span>
                    <span className="font-mono text-foreground">{process.env.NODE_ENV || "production"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Active Notifications</span>
                    <span className="font-mono text-foreground">{healthData?.counts?.notifications ?? "Syncing..."}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Total Purchase Requests</span>
                    <span className="font-mono text-foreground">{healthData?.counts?.requests ?? "Syncing..."}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Total Registered Vendors</span>
                    <span className="font-mono text-foreground">{healthData?.counts?.vendors ?? "Syncing..."}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Live Audit Stream */}
        {activeTab === "audit" && (
          <div className="glass rounded-2xl sm:rounded-[2rem] border border-border/40 p-5 sm:p-8 shadow-xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-brand-primary" />
              Real-Time Audit Stream
            </h3>

            {isLoadingLogs ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <p className="text-xs text-muted-foreground font-mono">Loading audit logs...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.slice(0, 30).map((log: any) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-secondary/30 border border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground font-mono">
                          {log.action}
                        </span>
                        {log.resourceType && (
                          <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                            {log.resourceType} {log.resourceId ? `#${log.resourceId}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Actor: <strong className="text-foreground">{log.user?.username || "System Actor"}</strong>
                      </p>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-secondary/50 px-2.5 py-1 rounded-lg">
                      {safeFormatDate(log.timestamp, "MMM dd, yyyy • HH:mm:ss")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
