"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import React, { useState } from "react";
import { format } from "date-fns";
import { safeFormatDate } from "@/lib/utils";
import { History, Search, Download, Filter, User, Tag, Clock, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

export default function AuditTimelinePage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => apiClient.admin.auditLogs(),
  });

  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterResource, setFilterResource] = useState("");

  const filteredLogs = logs?.filter((log: any) => {
    const matchUser = filterUser ? log.user?.username?.toLowerCase().includes(filterUser.toLowerCase()) : true;
    const matchAction = filterAction ? log.action?.toLowerCase().includes(filterAction.toLowerCase()) : true;
    const matchResource = filterResource ? log.resourceType?.toLowerCase().includes(filterResource.toLowerCase()) : true;
    return matchUser && matchAction && matchResource;
  }) || [];

  const handleExport = () => {
    if (!filteredLogs.length) return;
    const headers = ["Timestamp", "User", "Action", "Resource Type", "Resource ID", "IP Address", "Details"];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + filteredLogs.map((log: any) => {
          return [
            log.timestamp,
            log.user?.username || "System",
            log.action,
            log.resourceType || "N/A",
            log.resourceId || "N/A",
            log.ipAddress || "N/A",
            JSON.stringify(log.details || {}).replace(/,/g, ";") // basic CSV safety
          ].join(",");
        }).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Logs_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <History className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-serif text-foreground tracking-tight">Audit Timeline</h1>
          </div>
          <p className="text-sm text-muted-foreground">Comprehensive trace view of all system activities for compliance monitoring.</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={filteredLogs.length === 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl transition-all font-semibold flex items-center gap-2 disabled:opacity-50 shadow-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <FilterInput 
          icon={<User className="w-4 h-4 text-muted-foreground" />}
          placeholder="Filter by User..."
          value={filterUser}
          onChange={(e: any) => setFilterUser(e.target.value)}
        />
        <FilterInput 
          icon={<Filter className="w-4 h-4 text-muted-foreground" />}
          placeholder="Filter by Action..."
          value={filterAction}
          onChange={(e: any) => setFilterAction(e.target.value)}
        />
        <FilterInput 
          icon={<Tag className="w-4 h-4 text-muted-foreground" />}
          placeholder="Filter by Resource..."
          value={filterResource}
          onChange={(e: any) => setFilterResource(e.target.value)}
        />
      </div>

      {/* Timeline */}
      <div className="glass-card p-6 min-h-[500px]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center py-20">
            <div className="w-8 h-8 border-t-2 border-primary rounded-full animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No logs found</h3>
            <p className="text-muted-foreground text-sm max-w-sm">Try adjusting your filters to find the specific events you're looking for.</p>
          </div>
        ) : (
          <div className="relative pt-4 pl-4 pr-4">
            {/* Timeline track */}
            <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-border" />
            
            <div className="space-y-6">
              {filteredLogs.map((log: any, idx: number) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  className="flex gap-6 relative group"
                >
                  <div className="w-16 flex flex-col text-right pt-2 flex-shrink-0">
                    <span className="text-xs font-bold text-foreground leading-tight">{safeFormatDate(log.timestamp, "HH:mm")}</span>
                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{safeFormatDate(log.timestamp, "MMM dd")}</span>
                  </div>
                  
                  <div className="relative z-10 w-8 h-8 rounded-full bg-card border-2 border-primary/50 flex items-center justify-center mt-1 flex-shrink-0 group-hover:bg-primary/20 group-hover:border-primary transition-all shadow-xs">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  
                  <div className="flex-1 bg-secondary/30 border border-border rounded-2xl p-4 group-hover:bg-secondary/50 transition-all shadow-xs">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {log.action.replace(/_/g, " ").toUpperCase()}
                        </h4>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs">
                          <span className="text-primary font-medium flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> {log.user?.username || "System Actor"}
                          </span>
                          {log.resourceType && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Tag className="w-3.5 h-3.5" /> {log.resourceType} {log.resourceId ? `#${log.resourceId}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-md border border-border">
                        ip: {log.ipAddress || "internal"}
                      </div>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-3 bg-secondary/50 border border-border rounded-xl p-3 text-[10px] text-muted-foreground font-mono max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterInput({ icon, placeholder, value, onChange }: any) {
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
        {icon}
      </div>
      <input 
        type="text" 
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
