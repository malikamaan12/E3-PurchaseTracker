"use client";

import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "sonner";
import {
  ShieldCheck,
  CreditCard,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";

interface VendorBankingReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: number | null;
  vendorName: string;
  userRole?: string;
  onSuccess?: () => void;
}

export function VendorBankingReviewModal({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  userRole = "finance",
  onSuccess,
}: VendorBankingReviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [bankingData, setBankingData] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBanking = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/banking-staging`);
      const data = await res.json();
      if (data.success) {
        setBankingData(data);
      }
    } catch (err: any) {
      console.error("Failed to load banking details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && vendorId) {
      fetchBanking();
      setReviewNotes("");
    }
  }, [open, vendorId]);

  const handleReviewAction = async (stage: "stage1" | "stage2", isApproved: boolean) => {
    if (!bankingData?.latestStaged) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/banking-staging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: stage === "stage1" ? "review_stage1" : "review_stage2",
          submissionId: bankingData.latestStaged.id,
          isApproved,
          notes: reviewNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to process banking review");
      }

      toast.success(
        stage === "stage1"
          ? "Stage 1 Finance review complete. Handed off to Super Admin for Stage 2 confirmation."
          : "Stage 2 Super Admin confirmation complete. Details promoted to payable record."
      );

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const latestStaged = bankingData?.latestStaged;
  const canonical = bankingData?.canonicalBanking;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[560px] translate-x-[-50%] translate-y-[-50%] p-0 overflow-hidden rounded-2xl border bg-background shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95">
          <div className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-bold text-foreground">
                  Staged Banking Review (Dual Control)
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                  Vendor: <span className="font-semibold text-foreground">{vendorName}</span>
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">Loading banking records...</p>
              </div>
            ) : (
              <>
                {/* Staged Quarantine Details */}
                {latestStaged && (latestStaged.status === "pending_stage1" || latestStaged.status === "pending_stage2") ? (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> Staged Quarantine (Pending Approval)
                      </span>
                      <span className="px-2 py-0.5 rounded-md border text-[10px] capitalize border-amber-500/40 text-amber-600 font-semibold">
                        {latestStaged.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Bank Name:</span>
                        <p className="font-semibold text-foreground">{latestStaged.bankName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Branch:</span>
                        <p className="font-semibold text-foreground">{latestStaged.branchName}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Account Number:</span>
                        <p className="font-mono font-bold text-foreground mt-0.5">{latestStaged.accountNumber}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">IBAN:</span>
                        <p className="font-mono font-bold text-foreground mt-0.5">{latestStaged.ibanNumber}</p>
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div className="pt-3 border-t border-amber-500/20 space-y-3">
                      <label className="text-xs font-semibold text-foreground block">Reviewer Notes</label>
                      <Textarea
                        placeholder="Notes on verification or reasons for rejection..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="rounded-xl text-xs min-h-[70px]"
                      />

                      {latestStaged.status === "pending_stage1" && (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => handleReviewAction("stage1", false)}
                            className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 rounded-xl gap-1.5"
                          >
                            <XCircle className="w-4 h-4" /> Reject Stage 1
                          </Button>
                          <Button
                            disabled={isProcessing}
                            onClick={() => handleReviewAction("stage1", true)}
                            className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-1.5 font-semibold"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Pass Stage 1 Review
                          </Button>
                        </div>
                      )}

                      {latestStaged.status === "pending_stage2" && (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => handleReviewAction("stage2", false)}
                            className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 rounded-xl gap-1.5"
                          >
                            <XCircle className="w-4 h-4" /> Reject Stage 2
                          </Button>
                          <Button
                            disabled={isProcessing}
                            onClick={() => handleReviewAction("stage2", true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 font-semibold"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            Confirm & Promote to Payables
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed text-center text-muted-foreground text-xs">
                    No staged banking submissions awaiting review.
                  </div>
                )}

                {/* Canonical Active Payable Details */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-primary" /> Active Canonical Payables Record
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Bank Name:</span>
                      <p className="font-semibold text-foreground">{canonical?.bankName || "Not Provided"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Verification Status:</span>
                      <p className="font-semibold capitalize text-foreground">
                        {canonical?.bankingVerificationStatus || "Unverified"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Account Number:</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">
                        {canonical?.accountNumber || "•••• •••• ••••"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">IBAN:</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">
                        {canonical?.ibanNumber || "QA•• •••• •••• ••••"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
