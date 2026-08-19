"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, RotateCcw, Home, Smile, HeartHandshake } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [stressClicks, setStressClicks] = useState(0);

  useEffect(() => {
    console.error("Global Root Layout Crash Caught:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen selection:bg-brand-primary/30 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden"
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-brand-primary to-purple-500" />
          
          <div className="p-8 sm:p-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary mb-6">
              <Sparkles className="w-10 h-10 text-teal-400 animate-pulse" />
            </div>
            
            <div className="space-y-3 max-w-md mb-6">
              <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 inline-block">
                Root System Refresh
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Our server tripped on a coffee wire ☕
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Don&apos;t panic! All your purchase requests, vendors, and budgets are safe in the database vault. We just need a quick reboot.
              </p>
            </div>

            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 mb-6 flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold">
              <HeartHandshake className="w-4 h-4 shrink-0" />
              <span>Zero data loss: Your account and records are 100% intact.</span>
            </div>

            <div className="w-full bg-secondary/40 rounded-2xl p-4 text-left border border-border/50 font-mono text-xs text-muted-foreground mb-6 overflow-auto max-h-32">
              <p className="font-bold text-rose-400">{error.message || "Unknown root layout error occurred."}</p>
              {error.digest && (
                <p className="text-[10px] opacity-60 mt-1">Digest: {error.digest}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row w-full gap-3 mb-6">
              <button
                onClick={() => reset()}
                className="flex-1 bg-brand-primary text-white h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-primary/25 hover:bg-brand-primary/90 transition-all active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Application
              </button>
              <Link
                href="/"
                className="flex-1 bg-secondary text-foreground border border-border h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest hover:bg-secondary/80 transition-all active:scale-[0.98]"
              >
                <Home className="w-4 h-4" />
                Go to Homepage
              </Link>
            </div>

            <button
              onClick={() => setStressClicks(c => c + 1)}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95"
            >
              <Smile className="w-4 h-4" />
              <span>Relieve Stress 💥 {stressClicks > 0 ? `(${stressClicks})` : ""}</span>
            </button>
          </div>
        </motion.div>
      </body>
    </html>
  );
}

