"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import React, { useState } from "react";
import { format } from "date-fns";
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
    <div className="flex flex-col gap-6 p-8 w-full">
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary/10 rounded-lg border border-brand-primary/20">
              <History className="w-6 h-6 text-brand-primary" />
            </div>
            <h1 className="text-3xl font-serif text-white tracking-tight">Audit Timeline</h1>
          </div>
          <p className="text-zinc-400">Comprehensive trace view of all system activities for compliance monitoring.</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={filteredLogs.length === 0}
          className="bg-white/10 text-white px-5 py-2.5 rounded-lg hover:bg-white/20 transition-all font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <FilterInput 
          icon={<User className="w-4 h-4 text-zinc-500" />}
          placeholder="Filter by User..."
          value={filterUser}
          onChange={(e: any) => setFilterUser(e.target.value)}
        />
        <FilterInput 
          icon={<Filter className="w-4 h-4 text-zinc-500" />}
          placeholder="Filter by Action..."
          value={filterAction}
          onChange={(e: any) => setFilterAction(e.target.value)}
        />
        <FilterInput 
          icon={<Tag className="w-4 h-4 text-zinc-500" />}
          placeholder="Filter by Resource..."
          value={filterResource}
          onChange={(e: any) => setFilterResource(e.target.value)}
        />
      </div>

      {/* Timeline */}
      <div className="glass-card p-6 min-h-[500px]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center py-20">
            <div className="w-8 h-8 border-t-2 border-brand-primary rounded-full animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-1">No logs found</h3>
            <p className="text-zinc-500 text-sm max-w-sm">Try adjusting your filters to find the specific events you're looking for.</p>
          </div>
        ) : (
          <div className="relative pt-4 pl-4 pr-4">
            {/* Timeline track */}
            <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-white/5" />
            
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
                    <span className="text-xs font-bold text-white leading-tight">{format(new Date(log.timestamp), "HH:mm")}</span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{format(new Date(log.timestamp), "MMM dd")}</span>
                  </div>
                  
                  <div className="relative z-10 w-8 h-8 rounded-full bg-zinc-900 border-2 border-brand-primary/50 flex items-center justify-center mt-1 flex-shrink-0 group-hover:bg-brand-primary/20 group-hover:border-brand-primary transition-all">
                    <div className="w-2 h-2 rounded-full bg-brand-primary" />
                  </div>
                  
                  <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-4 group-hover:bg-white/[0.04] transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {log.action.replace(/_/g, " ").toUpperCase()}
                        </h4>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-brand-primary font-medium flex items-center gap-1">
                            <User className="w-3 h-3" /> {log.user?.username || "System Actor"}
                          </span>
                          {log.resourceType && (
                            <span className="text-zinc-400 flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {log.resourceType} {log.resourceId ? `#${log.resourceId}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono bg-black/40 px-2 py-1 rounded">
                        ip: {log.ipAddress || "internal"}
                      </div>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-3 bg-black/30 rounded p-3 text-[10px] text-zinc-400 font-mono max-h-32 overflow-y-auto">
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
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {icon}
      </div>
      <input 
        type="text" 
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/50 transition-all focus:outline-none placeholder:text-zinc-600"
      />
    </div>
  );
}
