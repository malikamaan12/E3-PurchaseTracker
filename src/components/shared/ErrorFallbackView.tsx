"use client";

import React, { useState, useEffect } from "react";
import { 
  RotateCcw, Home, Sparkles, Copy, Check, 
  RefreshCw, ShieldAlert, HeartHandshake, Zap, Smile
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";

interface ErrorFallbackViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  isDashboard?: boolean;
}

const FUNNY_MESSAGES = [
  {
    headline: "Our server had too much caffeine ☕",
    subtext: "It started calculating Qatari Riyals faster than the speed of light and tripped over a cable. Our engineers are already bribing it with fresh cookies.",
    quote: "“It worked on my machine.” — Every Engineer in Human History",
  },
  {
    headline: "Don't panic! Your data is 100% safe in the vault 🏦",
    subtext: "We just dropped a digital coffee mug on the floor. No budgets were harmed, no approvals were lost, and our tech team is already sweeping up the bytes.",
    quote: "“Have you tried turning it off and on again?” — IT Crowd",
  },
  {
    headline: "A wild glitch appeared! 👾",
    subtext: "Our digital procurement ninja is currently executing a 360-degree roundhouse kick on this bug. Normal service will resume immediately.",
    quote: "“To err is human, to reboot is divine.” — Anonymous Sysadmin",
  },
  {
    headline: "Even NASA's rockets need a quick reboot 🛸",
    subtext: "The system took a micro-siesta. All your purchase requests, attachments, and approvals are safe and sound.",
    quote: "“There are 10 types of people in the world: those who understand binary, and those who don't.”",
  }
];

export function ErrorFallbackView({
  error,
  reset,
  title = "Minor System Hiccup",
  isDashboard = true,
}: ErrorFallbackViewProps) {
  const [copied, setCopied] = useState(false);
  const [stressClicks, setStressClicks] = useState(0);
  const [randomMessage, setRandomMessage] = useState(FUNNY_MESSAGES[0]);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [isReported, setIsReported] = useState(false);

  useEffect(() => {
    // Pick a random funny message on mount
    const idx = Math.floor(Math.random() * FUNNY_MESSAGES.length);
    setRandomMessage(FUNNY_MESSAGES[idx]);
    console.error("[PurchaseTracker Error Boundary Caught]:", error);

    // Automatically report crash to Super Admins & telemetry
    try {
      fetch("/api/admin/diagnostics/report-crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Unknown client render error",
          stack: error?.stack || "",
          digest: error?.digest || null,
          url: typeof window !== "undefined" ? window.location.href : "/",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.incidentId) {
            setIncidentId(data.incidentId);
            setIsReported(true);
          }
        })
        .catch(() => {});
    } catch {}
  }, [error]);

  const handleCopyDiagnostics = () => {
    const diagText = JSON.stringify({
      error: error.name || "Error",
      message: error.message || "Unknown error",
      digest: error.digest || "N/A",
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "N/A",
    }, null, 2);

    navigator.clipboard.writeText(diagText).then(() => {
      setCopied(true);
      toast.success("Error diagnostics copied to clipboard! 📋");
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast.error("Could not copy diagnostics to clipboard");
    });
  };

  const handleStressClick = () => {
    setStressClicks(prev => {
      const next = prev + 1;
      if (next === 1) toast("💥 Pop! That's 1 point of stress eliminated.");
      else if (next === 5) toast.success("🌟 5 clicks in! Blood pressure dropping...");
      else if (next === 10) toast.success("🧘 Zen master mode achieved. Now hit 'Try Again'!");
      else if (next === 20) toast("🚀 Incredible stamina! You're ready to approve 100 requests now.");
      return next;
    });
  };

  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center p-4 sm:p-6 select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="max-w-2xl w-full bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden relative"
      >
        {/* Top vibrant ambient gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-brand-primary to-purple-500" />

        <div className="p-6 sm:p-10 flex flex-col items-center text-center">
          
          {/* Animated Mascot / Badge */}
          <div className="relative mb-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shadow-lg shadow-brand-primary/5">
              <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse text-teal-400" />
            </div>
            <span className="absolute -bottom-2 -right-2 text-2xl animate-bounce">
              🛠️
            </span>
          </div>

          {/* Headline and Funny Narrative */}
          <div className="space-y-3 max-w-lg mb-6">
            <span className="text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 inline-block">
              {title}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {randomMessage.headline}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {randomMessage.subtext}
            </p>
          </div>

          {/* Safety Reassurance & SuperAdmin Alert Badge */}
          <div className="w-full space-y-2 mb-6">
            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 text-xs text-emerald-400 font-bold">
              <HeartHandshake className="w-4 h-4 shrink-0" />
              <span>Peace of mind: All your requests, budgets & files are safely preserved.</span>
            </div>

            {isReported && (
              <div className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs text-indigo-400 font-bold px-4">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  Super Admin notified automatically
                </span>
                <span className="font-mono text-[11px] bg-indigo-500/20 px-2 py-0.5 rounded">
                  Incident Ref #{incidentId || "LIVE"}
                </span>
              </div>
            )}
          </div>

          {/* Humorous Quote Box */}
          <div className="w-full bg-secondary/40 border border-border/60 rounded-2xl p-4 text-xs font-mono text-muted-foreground/80 mb-6 italic">
            {randomMessage.quote}
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-6">
            <button
              onClick={() => reset()}
              className="w-full h-12 rounded-2xl bg-brand-primary hover:bg-brand-primary/90 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/25 active:scale-[0.98] transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again (Fix It)
            </button>

            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="w-full h-12 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground border border-border font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <RefreshCw className="w-4 h-4 text-teal-400" />
              Fresh Page Reload
            </button>
          </div>

          {/* Secondary Actions: Dashboard Hub + Stress Buster */}
          <div className="flex flex-wrap items-center justify-between w-full pt-4 border-t border-border/50 gap-3">
            <Link
              href={isDashboard ? "/dashboard" : "/"}
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Home className="w-4 h-4" />
              {isDashboard ? "Return to Dashboard Hub" : "Return to Homepage"}
            </Link>

            {/* Frustration Buster Stress Button */}
            <button
              onClick={handleStressClick}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
              title="Click as much as you want to relieve stress!"
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Relieve Stress 💥 {stressClicks > 0 ? `(${stressClicks})` : ""}</span>
            </button>
          </div>

          {/* Collapsible Tech Diagnostics */}
          <div className="w-full mt-6 pt-4 border-t border-border/30 text-left">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-[11px] font-mono text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 underline underline-offset-4"
              >
                {showTechnicalDetails ? "Hide Technical Details" : "View Technical Diagnostics"}
              </button>

              <button
                onClick={handleCopyDiagnostics}
                className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Diagnostics"}
              </button>
            </div>

            <AnimatePresence>
              {showTechnicalDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 p-3 bg-black/40 border border-border/40 rounded-xl font-mono text-[11px] text-muted-foreground overflow-auto max-h-32 scrollbar-thin"
                >
                  <p className="font-bold text-rose-400">{error.message || "Unknown rendering exception"}</p>
                  {error.digest && <p className="text-[10px] opacity-75 mt-1">Digest: {error.digest}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
