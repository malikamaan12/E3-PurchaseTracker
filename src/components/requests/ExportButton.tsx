"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, PackageCheck, Loader2, FileText, FileBadge, Archive } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ExportButtonProps {
  requestId: number;
  requestNumber: string;
  variant: "simple" | "full" | "bundle";
}

export function ExportButton({ requestId, requestNumber, variant }: ExportButtonProps) {
  const configs = {
    simple: {
      label: "Download Report",
      sub: "PDF • Standalone",
      icon: <FileText className="w-5 h-5" />,
      endpoint: `/api/requests/${requestId}/pdf`,
      filename: `PR_${requestNumber}.pdf`,
      color: "bg-secondary/50 text-foreground border-border hover:bg-secondary",
    },
    full: {
      label: "Full Package",
      sub: "PDF • Incl. Attachments",
      icon: <FileBadge className="w-5 h-5" />,
      endpoint: `/api/export/full-pdf/${requestId}`,
      filename: `Consolidated_PR_${requestNumber}_Package.pdf`,
      color: "bg-brand-primary/10 text-brand-primary border-brand-primary/20 hover:bg-brand-primary/20",
    },
    bundle: {
      label: "Audit Bundle",
      sub: "ZIP • PDF + CSV + Proof",
      icon: <Archive className="w-5 h-5" />,
      endpoint: `/api/export/bundle/${requestId}`,
      filename: `Audit_Bundle_PR_${requestNumber}.zip`,
      color: "bg-brand-primary text-white border-transparent hover:brightness-110",
    }
  };

  const config = configs[variant];

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(config.endpoint);
      if (!response.ok) throw new Error("Export failed");
      return await response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = config.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${config.label} generated successfully`);
    },
    onError: () => {
      toast.error(`Failed to generate ${config.label.toLowerCase()}`);
    },
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={`relative group flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all active:scale-95 disabled:opacity-80 overflow-hidden ${config.color}`}
    >
      {/* Animated Background Pulse */}
      <AnimatePresence>
        {mutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-brand-primary/10 animate-pulse"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-3">
        {mutation.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <div className="group-hover:translate-y-0.5 transition-transform">
            {config.icon}
          </div>
        )}
        
        <div className="flex flex-col items-start leading-none gap-1">
          <span className="text-[11px] font-black uppercase tracking-tighter">
            {mutation.isPending ? "Processing..." : config.label}
          </span>
          <span className="text-[9px] opacity-60 font-medium uppercase tracking-widest leading-none">
            {config.sub}
          </span>
        </div>
      </div>
    </button>
  );
}
