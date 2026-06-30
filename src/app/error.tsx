"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border/50 shadow-2xl rounded-[2rem] overflow-hidden"
      >
        <div className="p-8 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center relative">
             <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full" />
             <AlertCircle className="w-10 h-10 text-rose-500 relative z-10" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground font-medium">
              We encountered an unexpected error while loading this page.
            </p>
          </div>

          <div className="w-full bg-secondary/50 rounded-xl p-4 text-left border border-border/50">
             <p className="text-xs font-mono text-muted-foreground break-words overflow-auto max-h-32 scrollbar-thin">
               {error.message || "Unknown rendering error occurred."}
             </p>
             {error.digest && (
               <p className="text-[10px] mt-2 text-muted-foreground/60 uppercase tracking-widest">
                 Digest: {error.digest}
               </p>
             )}
          </div>

          <div className="flex w-full gap-3 mt-2">
            <button
              onClick={() => reset()}
              className="flex-1 bg-brand-primary text-white h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <Link
              href="/"
              className="flex-1 bg-secondary text-foreground border border-border h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest hover:bg-secondary/80 transition-all active:scale-[0.98]"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
