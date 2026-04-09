"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Download, 
  FileText, 
  Archive, 
  ShieldCheck, 
  ChevronDown, 
  Loader2,
  FileBadge,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { usePerformance } from "@/context/PerformanceContext";

interface ExportDropdownProps {
  requestId: number;
  requestNumber: string;
}

export function ExportDropdown({ requestId, requestNumber }: ExportDropdownProps) {
  const { highPerformanceMode } = usePerformance();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (type: "simple" | "full" | "bundle") => {
    setLoadingType(type);
    try {
      const endpoints = {
        simple: `/api/requests/${requestId}/pdf`,
        full: `/api/requests/${requestId}/export/full`,
        bundle: `/api/requests/${requestId}/export/bundle`
      };

      const filenames = {
        simple: `PR-${requestNumber}.pdf`,
        full: `PR-Package-${requestNumber}.zip`,
        bundle: `PR-Audit-${requestNumber}.zip`
      };

      const res = await fetch(endpoints[type]);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenames[type];
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${type.toUpperCase()} export complete.`);
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setLoadingType(null);
    }
  };

  const options = [
    { 
      id: "simple", 
      label: "Standalone PR Ledger", 
      sub: "Consolidated PDF Report",
      icon: <FileText className="w-4 h-4 text-brand-primary" />,
      color: "text-brand-primary"
    },
    { 
      id: "full", 
      label: "Full Procurement Package", 
      sub: "PDF + All Vault Attachments (ZIP)",
      icon: <Archive className="w-4 h-4 text-emerald-400" />,
      color: "text-emerald-400"
    },
    { 
      id: "bundle", 
      label: "Executive Audit Bundle", 
      sub: "PR + Audit Logs + Compliance Files (ZIP)",
      icon: <ShieldCheck className="w-4 h-4 text-purple-400" />,
      color: "text-purple-400"
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-secondary/50 hover:bg-white/10 border border-border px-4 py-2 rounded-xl transition-all font-bold text-xs text-foreground group"
      >
        <Download className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform" />
        <span>Document Export</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={highPerformanceMode ? { opacity: 1, scale: 1 } : { opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={highPerformanceMode ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute right-0 mt-2 w-72 rounded-2xl border border-border shadow-2xl z-[100] overflow-hidden ${highPerformanceMode ? 'bg-secondary' : 'bg-card/90 backdrop-blur-xl'}`}
          >
            <div className="p-2 flex flex-col gap-1">
              <div className="px-3 py-2 border-b border-border/50 mb-1">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Select Export Format
                 </p>
              </div>
              
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleExport(opt.id as any)}
                  disabled={loadingType !== null}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-secondary/80 flex items-center justify-center shrink-0 border border-border group-hover:border-white/20">
                    {loadingType === opt.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-tight ${opt.color}`}>{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="px-5 py-3 bg-secondary/30 border-t border-border mt-1">
               <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest text-center">
                 Institutional Governance Mode Active
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
