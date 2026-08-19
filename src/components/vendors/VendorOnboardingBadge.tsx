"use client";

import { CheckCircle2, Clock, AlertTriangle, XCircle, Send, FileEdit, ShieldCheck } from "lucide-react";

export function VendorOnboardingBadge({ status }: { status: string }) {
  switch (status) {
    case "link_active":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Clock className="w-3 h-3 text-blue-400" />
          <span>Link Active</span>
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <FileEdit className="w-3 h-3 text-indigo-400" />
          <span>In Progress</span>
        </span>
      );
    case "submitted":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
          <Send className="w-3 h-3 text-amber-400" />
          <span>Submitted (Needs Review)</span>
        </span>
      );
    case "changes_requested":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <AlertTriangle className="w-3 h-3 text-orange-400" />
          <span>Changes Requested</span>
        </span>
      );
    case "approved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Approved</span>
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Link Expired</span>
        </span>
      );
    case "revoked":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3 h-3 text-rose-400" />
          <span>Revoked</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <span>{status || "Not Invited"}</span>
        </span>
      );
  }
}
