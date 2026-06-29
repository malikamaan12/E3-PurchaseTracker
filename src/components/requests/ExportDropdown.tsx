"use client";

import { useState } from "react";
import { 
  Download, 
  FileText, 
  FileBadge,
  ShieldCheck, 
  ChevronDown, 
  Loader2,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { usePerformance } from "@/context/PerformanceContext";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover";

interface ExportDropdownProps {
  requestId: number;
  requestNumber: string;
}

export function ExportDropdown({ requestId, requestNumber }: ExportDropdownProps) {
  const { highPerformanceMode } = usePerformance();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const handleExport = async (type: "simple" | "full" | "bundle") => {
    setLoadingType(type);
    try {
      const endpoints = {
        simple: `/api/requests/${requestId}/pdf`,
        full: `/api/export/full-pdf/${requestId}`,
        bundle: `/api/export/bundle/${requestId}`
      };

      const filenames = {
        simple: `PR-${requestNumber}.pdf`,
        full: `PR-Package-${requestNumber}.pdf`,
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
      sub: "Consolidated PDF with Attachments",
      icon: <FileBadge className="w-4 h-4 text-emerald-400" />,
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 bg-secondary/50 hover:bg-white/10 border border-border px-4 py-2 rounded-xl transition-all font-bold text-xs text-foreground group"
        >
          <Download className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform" />
          <span>Document Export</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className={`w-72 p-0 overflow-hidden ${highPerformanceMode ? 'bg-secondary' : 'bg-card/90 backdrop-blur-xl'}`}>
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
      </PopoverContent>
    </Popover>
  );
}
