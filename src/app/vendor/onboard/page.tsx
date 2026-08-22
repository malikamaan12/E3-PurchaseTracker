"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function VendorOnboardEntryPage() {
  const [status, setStatus] = useState<"processing" | "error" | "no_token">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    async function exchangeToken() {
      try {
        // Read hash fragment: #token=<rawToken>
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const rawToken = params.get("token");

        if (!rawToken) {
          setStatus("no_token");
          return;
        }

        // Scrub token immediately from URL bar & history
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname);
        }

        // Exchange fragment token for HttpOnly cookie session
        const res = await fetch("/api/vendor-onboarding/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawToken }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error || "This invitation link is invalid or has expired.");
          return;
        }

        // Redirect to clean portal URL
        window.location.href = data.redirectUrl || "/vendor/portal";
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err.message || "An unexpected network error occurred while verifying your link.");
      }
    }

    exchangeToken();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center backdrop-blur-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xl shadow-inner">
            E3
          </div>
          <div className="text-left">
            <h1 className="text-sm font-semibold tracking-tight text-white leading-none">E3 PurchaseTracker</h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Secure Vendor Portal</p>
          </div>
        </div>

        {status === "processing" && (
          <div className="py-8 space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <ShieldCheck className="w-6 h-6 text-primary absolute" />
            </div>
            <h2 className="text-lg font-semibold text-white">Establishing Secure Session...</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Verifying your secure 7-day invitation and preparing your vendor onboarding environment.
            </p>
          </div>
        )}

        {status === "no_token" && (
          <div className="py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white">Missing Invitation Link</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              No authentication token was detected in your link. Please check your invitation email and click the complete link provided by the E3 Procurement team.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white">Invitation Inactive</h2>
            <div className="p-3.5 bg-rose-950/40 border border-rose-900/50 rounded-xl text-left">
              <p className="text-xs text-rose-300 font-medium">{errorMessage}</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              For your protection, onboarding invitation links expire automatically after 7 days. Please contact your procurement representative to request a new link.
            </p>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>256-Bit Encrypted Self-Service Gate</span>
        </div>
      </div>
    </div>
  );
}
