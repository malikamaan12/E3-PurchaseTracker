"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Building2,
  User,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmailActionContext {
  valid: boolean;
  isAlreadyProcessed?: boolean;
  currentStatus?: string;
  requestId: number;
  requestNumber: string;
  title: string;
  description: string;
  department: string;
  requesterName: string;
  requesterEmail: string;
  vendorName?: string;
  currency: string;
  totalEstimatedCost: number;
  paymentStructure: string;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
    remarks?: string;
  }>;
  approver: {
    id: number;
    username: string;
    email: string;
    department: string;
    role: string;
  };
  approvalSlot?: {
    id: number;
    department: string;
    status: string;
    isMandatory: boolean;
    comments?: string | null;
  };
}

export default function EmailActionLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const requestId = params.id as string;
  const token = searchParams.get("token") || "";
  const initialAction = searchParams.get("action") as
    | "approved"
    | "rejected"
    | "changes_requested"
    | null;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<EmailActionContext | null>(null);

  const [selectedAction, setSelectedAction] = useState<"approved" | "rejected" | "changes_requested">(
    initialAction === "rejected" || initialAction === "changes_requested" ? initialAction : "approved"
  );
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    requestStatus?: string;
  } | null>(null);

  // Fetch read-only context safely on load
  useEffect(() => {
    if (!token) {
      setError("Missing action verification token. Please open the link directly from your notification email.");
      setIsLoading(false);
      return;
    }

    async function loadContext() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/requests/${requestId}/email-action?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(data.error || "This action link is expired or invalid.");
          return;
        }

        setContext(data.context);
      } catch (err: any) {
        setError(err?.message || "Failed to load request details. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    }

    loadContext();
  }, [requestId, token]);

  const handleSubmitAction = async () => {
    if (!token) return;

    // High value rationale check (> 50,000 QAR)
    const totalCost = context?.totalEstimatedCost || 0;
    if (selectedAction === "approved" && totalCost >= 50000 && (!comments || comments.trim().length < 5)) {
      alert("High-Value Request: Please provide a brief approval note (at least 5 characters) for sign-off.");
      return;
    }

    if ((selectedAction === "rejected" || selectedAction === "changes_requested") && (!comments || comments.trim().length < 3)) {
      alert(`Please provide feedback notes explaining why this request is ${selectedAction === "rejected" ? "rejected" : "returned for modifications"}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/requests/${requestId}/email-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: selectedAction,
          comments: comments.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process decision");
      }

      setSubmitResult({
        success: true,
        message: data.message,
        requestStatus: data.requestStatus,
      });
    } catch (err: any) {
      alert(err?.message || "Failed to submit decision. Please try again or log in directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-card border border-border shadow-xl flex flex-col items-center text-center max-w-md w-full space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <h2 className="text-lg font-bold text-foreground">Verifying Action Link...</h2>
          <p className="text-xs text-muted-foreground">
            Authenticating your cryptographic token with PurchaseTracker...
          </p>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-card border border-rose-500/20 shadow-xl flex flex-col items-center text-center max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Invalid or Expired Link</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error || "This action link could not be verified. It may have expired or already been completed."}
          </p>
          <div className="pt-2 w-full">
            <Link
              href={`/dashboard/requests/${requestId}`}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
            >
              <span>Open in PurchaseTracker</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Already processed state
  if (context.isAlreadyProcessed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-card border border-border shadow-xl flex flex-col items-center text-center max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Action Already Recorded</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This approval stage for request <strong className="font-mono text-foreground">{context.requestNumber}</strong> has already been completed with status:{" "}
            <span className="font-bold capitalize text-primary">{context.currentStatus?.replace(/_/g, " ")}</span>.
          </p>
          <div className="pt-2 w-full">
            <Link
              href={`/dashboard/requests/${requestId}`}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
            >
              <span>View Full Request Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success result state
  if (submitResult) {
    const isApproved = selectedAction === "approved";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 animate-fade-in">
        <div className="p-8 sm:p-10 rounded-3xl bg-card border border-border shadow-2xl flex flex-col items-center text-center max-w-lg w-full space-y-5">
          <div
            className={cn(
              "w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg",
              isApproved
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-emerald-500/10"
                : "bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-rose-500/10"
            )}
          >
            {isApproved ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>

          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">
              {isApproved ? "Approval Confirmed!" : selectedAction === "rejected" ? "Request Rejected" : "Revisions Requested"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {submitResult.message} The requester (<strong className="text-foreground">{context.requesterName}</strong>) has been notified.
            </p>
          </div>

          <div className="w-full p-4 rounded-2xl bg-secondary/30 border border-border/60 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Request Number:</span>
              <span className="font-mono font-bold text-foreground">{context.requestNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Decision By:</span>
              <span className="font-bold text-foreground">{context.approver.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department:</span>
              <span className="text-foreground">{context.approver.department}</span>
            </div>
            {submitResult.requestStatus && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated PR Status:</span>
                <span className="font-bold capitalize text-primary">{submitResult.requestStatus.replace(/_/g, " ")}</span>
              </div>
            )}
          </div>

          <div className="pt-2 w-full flex flex-col sm:flex-row gap-3">
            <Link
              href={`/dashboard/requests/${requestId}`}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              <span>View in Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active decision view
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/10 to-background flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col my-4">
        {/* Top Navy Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 sm:p-6 text-white border-b-2 border-primary">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black tracking-widest text-sky-400 uppercase">
                PURCHASE<span className="text-white">TRACKER</span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
                1-Click Decision Portal
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-full border border-white/15">
                {context.requestNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Security & Authentication Bar */}
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold truncate">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">
              Authenticated as <strong className="font-bold">{context.approver.username}</strong> ({context.approver.department})
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
            Cryptographically Verified
          </span>
        </div>

        {/* Main Body */}
        <div className="p-5 sm:p-7 space-y-6 flex-1 overflow-y-auto">
          {/* Request Header Summary */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Action Required
              </span>
              <span className="text-xs text-muted-foreground">• Submitted by {context.requesterName}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {context.title}
            </h2>
            {context.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {context.description}
              </p>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Total Amount
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {context.currency} {context.totalEstimatedCost.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Department
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5 block truncate">
                {context.department}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Vendor
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5 block truncate">
                {context.vendorName || "Not assigned"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Payment Terms
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5 block capitalize truncate">
                {context.paymentStructure.replace(/_/g, " ").toLowerCase()}
              </span>
            </div>
          </div>

          {/* Line Items Breakdown */}
          {context.items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Line Items ({context.items.length})
                </h3>
                <Link
                  href={`/dashboard/requests/${requestId}#line-items`}
                  target="_blank"
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>View in full app</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40 bg-card">
                {context.items.map((item, idx) => (
                  <div key={idx} className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
                        <p className="font-bold text-foreground truncate">{item.name || "Item"}</p>
                      </div>
                      {item.remarks || item.description ? (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {item.remarks || item.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <div className="font-bold text-foreground">
                        {((item.quantity || 1) * (item.estimatedCost || 0)).toLocaleString()} {context.currency}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.quantity || 1} × {(item.estimatedCost || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Selector Tabs */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Your Decision
            </h3>

            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-secondary/40 border border-border/60">
              <button
                type="button"
                onClick={() => setSelectedAction("approved")}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                  selectedAction === "approved"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction("rejected")}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                  selectedAction === "rejected"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction("changes_requested")}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                  selectedAction === "changes_requested"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Modifications</span>
              </button>
            </div>
          </div>

          {/* Decision Rationale / Comments */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                {selectedAction === "approved"
                  ? "Approval Comments (Optional)"
                  : selectedAction === "rejected"
                  ? "Rejection Reason (Required)"
                  : "Modification Details (Required)"}
              </label>
              {context.totalEstimatedCost >= 50000 && selectedAction === "approved" && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Required for requests ≥ 50,000 QAR
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                selectedAction === "approved"
                  ? "Add optional sign-off remarks or operational instructions..."
                  : selectedAction === "rejected"
                  ? "Explain why this request is being rejected..."
                  : "Detail what specific changes or attachments are requested..."
              }
              className="w-full px-3.5 py-2.5 rounded-2xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Final Submit Button */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSubmitAction}
              disabled={isSubmitting}
              className={cn(
                "flex-1 py-3 px-6 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 text-white shadow-lg transition-all active-scale disabled:opacity-50",
                selectedAction === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                  : selectedAction === "rejected"
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/25"
                  : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/25"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Decision...</span>
                </>
              ) : (
                <>
                  {selectedAction === "approved" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : selectedAction === "rejected" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    Confirm {selectedAction === "approved" ? "Approval" : selectedAction === "rejected" ? "Rejection" : "Modifications"}
                  </span>
                </>
              )}
            </button>

            <Link
              href={`/dashboard/requests/${requestId}`}
              className="px-5 py-3 rounded-2xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center gap-2 border border-border/60 transition-all shrink-0"
            >
              <span>Full Details</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
