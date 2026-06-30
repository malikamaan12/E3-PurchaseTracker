"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import "./globals.css"; // Ensure global styles are loaded

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Application Error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen selection:bg-brand-primary/30 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-card border border-border shadow-2xl rounded-3xl overflow-hidden"
        >
          <div className="p-8 md:p-12 flex flex-col items-center text-center gap-8">
            <div className="w-24 h-24 bg-rose-500/10 rounded-3xl flex items-center justify-center relative rotate-3 hover:rotate-0 transition-transform">
               <div className="absolute inset-0 bg-rose-500/20 blur-2xl rounded-3xl" />
               <AlertTriangle className="w-12 h-12 text-rose-500 relative z-10" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-black text-foreground tracking-tight">Critical Error</h1>
              <p className="text-base text-muted-foreground font-medium max-w-sm mx-auto">
                A fatal error occurred at the layout level. The application cannot continue rendering.
              </p>
            </div>

            <div className="w-full bg-secondary/50 rounded-2xl p-5 text-left border border-border">
               <p className="text-sm font-mono text-muted-foreground break-words overflow-auto max-h-40 scrollbar-thin">
                 {error.message || "Unknown fatal error occurred."}
               </p>
               {error.digest && (
                 <p className="text-xs mt-3 text-muted-foreground/50 uppercase tracking-widest font-black">
                   Digest: {error.digest}
                 </p>
               )}
            </div>

            <div className="flex flex-col sm:flex-row w-full gap-4 pt-4">
              <button
                onClick={() => reset()}
                className="flex-1 bg-brand-primary text-white h-14 rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest shadow-[0_0_40px_rgba(var(--brand-primary),0.3)] hover:bg-brand-primary/90 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-5 h-5" />
                Reload Application
              </button>
              <Link
                href="/"
                className="flex-1 bg-secondary text-foreground border border-border h-14 rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest hover:bg-secondary/80 transition-all active:scale-[0.98]"
              >
                <Home className="w-5 h-5" />
                Go to Homepage
              </Link>
            </div>
          </div>
        </motion.div>
      </body>
    </html>
  );
}
