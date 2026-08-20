"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  Landmark,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { maskAccountNumber, maskIban } from "@/lib/utils/masking";

interface VendorChangeRequestDiffModalProps {
  changeRequest: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function VendorChangeRequestDiffModal({
  changeRequest,
  isOpen,
  onClose,
  onRefresh,
}: VendorChangeRequestDiffModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showSensitiveBanking, setShowSensitiveBanking] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen || !changeRequest) return null;

  const current = changeRequest.currentDataSnapshot || {};
  const proposed = changeRequest.proposedData || {};

  const fields = [
    { key: "companyName", label: "Legal Company Name", icon: Building2 },
    { key: "contactPerson", label: "Contact Person" },
    { key: "email", label: "Email Address" },
    { key: "contactNumber", label: "Contact Phone" },
    { key: "address", label: "Headquarters Address" },
    { key: "registrationNumber", label: "CR Number" },
    { key: "taxNumber", label: "Tax Number (TIN)" },
    { key: "bankName", label: "Bank Name", icon: Landmark },
    { key: "branchName", label: "Branch Name" },
    { key: "accountNumber", label: "Account Number", isBanking: true },
    { key: "ibanNumber", label: "IBAN Number", isBanking: true },
    { key: "payment_currency", label: "Payment Currency" },
  ];

  const handleAction = async (action: "approve" | "reject") => {
    if (!window.confirm(`Are you sure you want to ${action} this vendor change request?`)) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await fetch(
        `/api/vendors/${changeRequest.vendorId}/change-requests/${changeRequest.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reviewNotes: reviewNotes || undefined }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to ${action} change request`);

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to ${action} changes.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Vendor Change Request Diff</h2>
              <p className="text-xs text-muted-foreground">
                Audit side-by-side modifications before applying updates to the live vendor record
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Masking Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-secondary/40 rounded-2xl border border-border text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Sensitive Banking Data Protection</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSensitiveBanking((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-secondary text-foreground text-xs font-medium transition-colors border border-border shadow-sm"
            >
              {showSensitiveBanking ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Mask Banking Credentials</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Reveal Banking for Audit</span>
                </>
              )}
            </button>
          </div>

          {/* Comparison Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden text-xs shadow-sm">
            <div className="grid grid-cols-12 bg-secondary/40 p-3.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border">
              <div className="col-span-4">Field Attribute</div>
              <div className="col-span-4">Current Approved Value</div>
              <div className="col-span-4">Proposed Value</div>
            </div>

            <div className="divide-y divide-border/60">
              {fields.map((f) => {
                const currentVal = current[f.key];
                const proposedVal = proposed[f.key];
                const isChanged = proposedVal !== undefined && proposedVal !== currentVal;

                // Format values (banking masking if applicable)
                let displayCurrent = currentVal || "—";
                let displayProposed = proposedVal !== undefined ? proposedVal || "—" : "—";

                if (f.isBanking && !showSensitiveBanking) {
                  if (f.key === "accountNumber") {
                    displayCurrent = maskAccountNumber(currentVal);
                    displayProposed = maskAccountNumber(proposedVal);
                  } else if (f.key === "ibanNumber") {
                    displayCurrent = maskIban(currentVal);
                    displayProposed = maskIban(proposedVal);
                  }
                }

                return (
                  <div
                    key={f.key}
                    className={`grid grid-cols-12 p-3.5 items-center transition-colors ${
                      isChanged ? "bg-amber-500/10" : "hover:bg-secondary/30"
                    }`}
                  >
                    <div className="col-span-4 font-medium text-foreground flex items-center gap-1.5">
                      <span>{f.label}</span>
                      {isChanged && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                          MODIFIED
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 text-muted-foreground font-mono break-all pr-2">
                      {displayCurrent}
                    </div>
                    <div
                      className={`col-span-4 font-mono break-all ${
                        isChanged ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {displayProposed}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Admin Review Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Review Decision Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={2}
              placeholder="Provide reason for approval or rejection..."
              className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Close
            </button>

            {changeRequest.status === "pending" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction("reject")}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Changes (Leave Record Untouched)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("approve")}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Approve & Apply to Live Vendor</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
