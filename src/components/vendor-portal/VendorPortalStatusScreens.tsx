"use client";

import { CheckCircle2, Clock, AlertTriangle, Building2, ShieldCheck, Mail } from "lucide-react";

export function VendorPortalSubmittedScreen({
  companyName,
  submittedAt,
}: {
  companyName: string;
  submittedAt?: string | null;
}) {
  const formattedDate = submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80">
          Submission Received & Locked
        </span>

        <h2 className="text-2xl font-bold text-white mt-4 tracking-tight">
          Thank You, {companyName}
        </h2>

        <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
          Your vendor profile and compliance documents have been submitted to the E3 Procurement & Finance team for verification.
        </p>

        <div className="mt-8 p-5 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-left space-y-3">
          <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-800/80">
            <span className="text-slate-400">Submission Timestamp:</span>
            <span className="text-white font-mono">{formattedDate}</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-800/80">
            <span className="text-slate-400">Review Status:</span>
            <span className="text-amber-400 font-medium">Pending Compliance Review</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Next Steps:</span>
            <span className="text-slate-200">E3 administrators will audit your credentials</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Profile Locked Against Edits</span>
          </div>
          <span className="hidden sm:inline text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-primary" />
            <span>
              Questions? Contact{" "}
              <a href="mailto:procurement@e3.qa" className="text-primary hover:underline font-medium">
                procurement@e3.qa
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VendorPortalExpiredScreen() {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-5">
          <Clock className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">
          Invitation Link Expired
        </h2>

        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          For security and data-protection requirements, self-service onboarding links remain valid for 7 days.
        </p>

        <div className="mt-6 p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-left">
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Don't worry:</strong> Any draft details or documents you previously saved are safely preserved in our system.
          </p>
        </div>

        <p className="text-xs text-slate-400 mt-6 leading-relaxed">
          Please contact your E3 procurement representative or email{" "}
          <a href="mailto:procurement@e3.qa" className="text-primary font-mono hover:underline">
            procurement@e3.qa
          </a>{" "}
          to request a fresh 7-day link.
        </p>
      </div>
    </div>
  );
}

export function VendorPortalRevokedScreen() {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">
          Invitation Link Inactive
        </h2>

        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          This onboarding link has been replaced or revoked by an E3 administrator.
        </p>

        <p className="text-xs text-slate-400 mt-6 leading-relaxed">
          Please check your inbox for a newer invitation link, or reach out to your E3 representative.
        </p>
      </div>
    </div>
  );
}
