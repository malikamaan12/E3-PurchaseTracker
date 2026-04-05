"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Activity, BugPlay, ShieldAlert, Cpu } from "lucide-react";
import { format } from "date-fns";

export default function DiagnosticsPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin_audit_logs"],
    queryFn: () => apiClient.admin.auditLogs(),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">System Diagnostics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">Audit logs, system events, and runtime diagnostics.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors">
          <BugPlay className="w-5 h-5 text-indigo-500" />
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

      <div className="bg-card rounded-3xl border border-border p-8 shadow-xl overflow-hidden">
        <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-primary" />
          Recent Audit Trail
        </h2>
        {isLoading ? (
           <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
           </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log: any) => (
              <div key={log.id} className="flex gap-4 items-start p-4 bg-secondary/20 rounded-2xl border border-border hover:bg-secondary/40 transition-all">
                 <div className="w-10 h-10 shrink-0 bg-secondary rounded-xl flex items-center justify-center font-bold text-foreground uppercase text-xs border border-border">
                   {log.action.substring(0,2)}
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-sm text-foreground font-medium">User <b className="text-brand-primary">{log.user?.username || 'System'}</b> performed <span className="text-amber-500 font-mono text-xs">{log.action}</span></p>
                   <p className="text-xs text-muted-foreground mt-1 font-medium">Resource: <span className="opacity-70">{log.resourceType}</span> {log.resourceId ? `#${log.resourceId}` : ''}</p>
                   {log.details && (
                     <pre className="mt-3 text-[10px] text-muted-foreground font-mono bg-secondary/80 p-3 rounded-xl overflow-x-auto border border-border/50">
                       {JSON.stringify(log.details, null, 2)}
                     </pre>
                   )}
                 </div>
                 <div className="shrink-0 text-right">
                    <p className="text-xs font-mono text-muted-foreground opacity-70">{format(new Date(log.timestamp), 'HH:mm:ss')}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1 tracking-widest">{format(new Date(log.timestamp), 'MMM dd')}</p>
                 </div>
              </div>
            ))}
            {logs.length === 0 && (
               <div className="text-center py-12 text-muted-foreground font-bold uppercase tracking-widest text-[10px] border border-dashed border-border rounded-2xl">
                 No recent audit logs available.
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
