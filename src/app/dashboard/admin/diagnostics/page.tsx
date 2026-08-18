"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { Activity, BugPlay, ShieldAlert, Cpu, DownloadCloud, ChevronRight, Zap } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function DiagnosticsPage() {
  usePageTitle("System Diagnostics");
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin_audit_logs"],
    queryFn: () => apiClient.admin.auditLogs(),
    enabled: !!user && !isAuthLoading
  });

  const handleExport = () => {
    toast.promise(
      new Promise((resolve) => {
        window.open("/api/admin/diagnostics/export", "_blank");
        setTimeout(resolve, 1000);
      }),
      {
        loading: "Generating diagnostic report...",
        success: "Audit report dispatched to browser",
        error: "Failed to assemble report"
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-serif font-black text-foreground tracking-tight flex items-center gap-3">
             <Zap className="w-8 h-8 text-brand-primary" />
             System Diagnostics
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Audit logs, system events, and real-time runtime diagnostics.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-brand-primary text-white font-black px-6 py-2.5 rounded-2xl hover:brightness-110 shadow-lg shadow-brand-primary/20 transition-all group"
          >
            <DownloadCloud className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Export Diagnostics (CSV)
          </button>
          <div className="bg-secondary/50 p-2.5 rounded-2xl border border-border">
            <BugPlay className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-lg transition-colors">
            <div className="flex gap-3 items-center mb-2">
               <Activity className="w-5 h-5 text-emerald-500"/>
               <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Load</h3>
            </div>
            <p className="text-2xl font-mono text-foreground">12%</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-lg transition-colors">
            <div className="flex gap-3 items-center mb-2">
               <ShieldAlert className="w-5 h-5 text-amber-500"/>
               <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Warnings</h3>
            </div>
            <p className="text-2xl font-mono text-foreground">0</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-lg transition-colors">
            <div className="flex gap-3 items-center mb-2">
               <Cpu className="w-5 h-5 text-blue-500"/>
               <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Worker Threads</h3>
            </div>
            <p className="text-2xl font-mono text-foreground">4 / 4</p>
          </div>
       </div>

      <div className="glass rounded-[2rem] border border-border/40 p-10 shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />

        <div className="flex justify-between items-center mb-10 relative">
          <h2 className="text-xl font-black text-foreground flex items-center gap-3">
            <Activity className="w-6 h-6 text-brand-primary animate-pulse" />
            Live Audit Stream
          </h2>
          <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
            Syncing Live
          </span>
        </div>

        {isLoading ? (
           <div className="flex flex-col items-center justify-center h-48 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Scanning audit trail...</p>
           </div>
        ) : (
          <div className="space-y-4 relative">
            {logs.map((log: any) => {
              const actionType = log.action.toLowerCase();
              const isDanger = actionType.includes('delete') || actionType.includes('rejected');
              const isSuccess = actionType.includes('approve') || actionType.includes('create');
              
              return (
                <div key={log.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-5 bg-secondary/10 hover:bg-secondary/30 rounded-2xl border border-border/30 hover:border-brand-primary/30 transition-all group">
                   <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center font-black uppercase text-xs border shadow-sm transition-transform group-hover:scale-105 ${
                     isDanger ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                     isSuccess ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                     'bg-secondary/80 text-foreground border-border'
                   }`}>
                     {log.action.substring(0,2)}
                   </div>
                   
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-black text-brand-primary uppercase tracking-tighter">Event #{(log.id % 99999).toString().padStart(5, '0')}</span>
                       <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                       <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                         {log.resourceType || "System"} Entity
                       </p>
                     </div>
                     <p className="text-sm text-foreground font-bold mt-0.5">
                       User <span className="text-brand-primary italic opacity-90">{log.user?.username || 'System Root'}</span> 
                       &nbsp;performed <span className="text-foreground uppercase tracking-tight">{log.action}</span>
                     </p>
                     
                     {log.details && (
                       <details className="mt-3 cursor-pointer group/details">
                         <summary className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 hover:text-brand-primary transition-colors">
                           <ChevronRight className="w-3 h-3 group-open/details:rotate-90 transition-transform" />
                           View Detailed Payload
                         </summary>
                         <pre className="mt-3 text-[10px] text-muted-foreground font-mono bg-black/20 backdrop-blur-md p-4 rounded-xl overflow-x-auto border border-white/5 scrollbar-hide select-all">
                           {JSON.stringify(log.details, null, 2)}
                         </pre>
                       </details>
                     )}
                   </div>

                   <div className="shrink-0 flex flex-col items-start md:items-end gap-1">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary/50 rounded-lg border border-border/50">
                        <Activity className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-bold text-foreground">{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest pr-1">
                        {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                      </span>
                   </div>
                </div>
              );
            })}
            {logs.length === 0 && (
               <div className="text-center py-20 flex flex-col items-center gap-4">
                 <div className="w-16 h-16 rounded-3xl bg-secondary/50 flex items-center justify-center border border-dashed border-border text-muted-foreground">
                    <Activity className="w-8 h-8 opacity-20" />
                 </div>
                 <div>
                   <p className="text-xs font-black text-foreground uppercase tracking-widest">Audit Vacuum</p>
                   <p className="text-[10px] text-muted-foreground mt-1">No system events captured in the current synchronization window.</p>
                 </div>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
