"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Clock, Building2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface VendorPortalHeaderProps {
  companyName: string;
  expiresAt: string;
  remainingSeconds: number;
  onboardingStatus: string;
  isReadOnly: boolean;
  onExpire?: () => void;
}

export function VendorPortalHeader({
  companyName,
  expiresAt,
  remainingSeconds: initialRemainingSeconds,
  onboardingStatus,
  isReadOnly,
  onExpire,
}: VendorPortalHeaderProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialRemainingSeconds);

  useEffect(() => {
    setSecondsLeft(initialRemainingSeconds);
  }, [initialRemainingSeconds]);

  useEffect(() => {
    if (isReadOnly || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isReadOnly, secondsLeft, onExpire]);

  // Format countdown: HH:MM:SS
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft > 0 && secondsLeft < 7200; // < 2 hours

  const expiryDateFormatted = new Date(expiresAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    day: "numeric",
    month: "short",
  });

  return (
    <header className="w-full bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Brand & Vendor Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
            E3
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white tracking-tight">E3 PurchaseTracker</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                Self-Service Onboarding
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-slate-200 truncate max-w-[220px] sm:max-w-[300px]">
                {companyName || "Vendor Organization"}
              </span>
            </div>
          </div>
        </div>

        {/* Status & Countdown Bar */}
        <div className="flex items-center gap-3">
          {isReadOnly ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Profile Submitted (Locked)</span>
            </div>
          ) : onboardingStatus === "changes_requested" ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Corrections Requested</span>
            </div>
          ) : (
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium border transition-colors ${
                isUrgent
                  ? "bg-amber-950/60 border-amber-800/80 text-amber-300 animate-pulse"
                  : "bg-slate-800/70 border-slate-700/80 text-slate-300"
              }`}
            >
              <Clock className={`w-4 h-4 ${isUrgent ? "text-amber-400" : "text-primary"}`} />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1.5">Link Expiry:</span>
                <span className="font-semibold text-white">
                  {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
              </div>
            </div>
          )}

          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 border-l border-slate-800 pl-3">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>256-Bit Secure</span>
          </div>
        </div>
      </div>
    </header>
  );
}
