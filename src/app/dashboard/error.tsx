"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an analytics or reporting service
    console.error("Critical Dashboard Failure:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card max-w-xl w-full p-12 text-center border-rose-500/20 shadow-2xl shadow-rose-500/10 relative overflow-hidden"
      >
        {/* Background Visualizer */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-[#5B4B8A] to-rose-500 opacity-30" />
        
        <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>

        <h1 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-4">
          Institutional Service Interruption
        </h1>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          An unexpected error occurred within the procurement engine. This may be due to a temporary synchronization failure or an unauthorized state transition. 
          The security layer has intercepted the fault to prevent data corruption.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 bg-foreground text-background px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl"
          >
            <RotateCcw className="w-4 h-4" />
            Resume Operation
          </button>
          
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="flex items-center gap-2 bg-secondary border border-border px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
          >
            <Home className="w-4 h-4" />
            Abort to Hub
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.3em]">
            Fault Signature: {error.digest || "SYSTEM_RUNTIME_ERR_001"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
