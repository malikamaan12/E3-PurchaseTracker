"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Loader2,
} from "lucide-react";

interface VendorVerificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: number | null;
  vendorName: string;
  assignedRequirement: any | null;
  onVerificationComplete?: () => void;
}

export function VendorVerificationDrawer({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  assignedRequirement,
  onVerificationComplete,
}: VendorVerificationDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [actionNotes, setActionNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSubmissions = async () => {
    if (!vendorId || !assignedRequirement) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/submissions`);
      const data = await res.json();
      if (data.success) {
        const match = data.requirements.find((r: any) => r.id === assignedRequirement.id);
        setSubmissions(match?.submissions || []);
      }
    } catch (err: any) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && vendorId && assignedRequirement) {
      fetchSubmissions();
      setActionNotes("");
    }
  }, [open, vendorId, assignedRequirement]);

  const handleDecision = async (decision: "verify" | "reject") => {
    if (!vendorId || submissions.length === 0) return;
    const latestSubmission = submissions[0];

    if (decision === "reject" && !actionNotes.trim()) {
      toast.error("Please specify why this requirement response was rejected so the vendor can rectify it.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/submissions/${latestSubmission.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: actionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Verification action failed");
      }

      toast.success(
        `${assignedRequirement.name} has been ${decision === "verify" ? "approved" : "rejected"} and score updated.`
      );

      if (onVerificationComplete) {
        onVerificationComplete();
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const latestSubmission = submissions[0] || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] p-0 flex flex-col h-full bg-background">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-md border text-[10px] uppercase font-mono tracking-wider font-semibold">
              {assignedRequirement?.section || "Legal"} Requirement
            </span>
            {assignedRequirement?.isMandatory && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] font-bold">
                Mandatory
              </span>
            )}
          </div>
          <SheetTitle className="text-lg font-bold text-foreground mt-2">
            {assignedRequirement?.name || "Requirement Verification"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Vendor: <span className="font-semibold text-foreground">{vendorName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Requirement Instructions */}
          {assignedRequirement?.instructions && (
            <div className="p-3.5 rounded-xl bg-muted/40 border text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Requirement Instructions:</p>
              <p>{assignedRequirement.instructions}</p>
            </div>
          )}

          {/* Current Status Card */}
          <div className="p-4 rounded-xl border bg-card space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Submission State
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Submission Status:</span>
                <p className="font-semibold capitalize text-foreground mt-0.5">
                  {assignedRequirement?.submissionStatus?.replace(/_/g, " ") || "Missing"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Deadline Status:</span>
                <p className="font-semibold capitalize text-foreground mt-0.5">
                  {assignedRequirement?.deadlineStatus?.replace(/_/g, " ") || "Due"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Validity Status:</span>
                <p className="font-semibold capitalize text-foreground mt-0.5">
                  {assignedRequirement?.validityStatus?.replace(/_/g, " ") || "N/A"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Score Weight:</span>
                <p className="font-bold text-primary mt-0.5">
                  {assignedRequirement?.scoreWeight || 10} pts
                </p>
              </div>
            </div>
          </div>

          {/* Latest Submission Data */}
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Loading submission history...</p>
            </div>
          ) : latestSubmission ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Latest Response (Version {latestSubmission.versionNumber})
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(latestSubmission.submittedAt).toLocaleString()}
                </span>
              </div>

              {latestSubmission.fieldValue && (
                <div className="p-3.5 rounded-xl border bg-muted/20">
                  <p className="text-[11px] text-muted-foreground font-semibold">Submitted Text / Number Value:</p>
                  <p className="text-sm font-mono font-bold text-foreground mt-1 select-all">
                    {latestSubmission.fieldValue}
                  </p>
                </div>
              )}

              {latestSubmission.expiryDate && (
                <div className="flex items-center gap-2 text-xs p-3 rounded-xl border bg-card">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Expiry Date:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(latestSubmission.expiryDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              {latestSubmission.submissionNotes && (
                <div className="p-3 rounded-xl border bg-muted/10 text-xs">
                  <p className="text-muted-foreground font-semibold">Vendor Notes:</p>
                  <p className="mt-1">{latestSubmission.submissionNotes}</p>
                </div>
              )}

              {/* Review Actions Form */}
              <div className="pt-4 border-t space-y-3">
                <label className="text-xs font-semibold text-foreground block">
                  Reviewer Notes / Rejection Rationale
                </label>
                <Textarea
                  placeholder="Enter verification notes or required corrections..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="rounded-xl text-xs min-h-[80px]"
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 rounded-xl gap-1.5"
                    disabled={isProcessing}
                    onClick={() => handleDecision("reject")}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </Button>

                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 font-semibold"
                    disabled={isProcessing}
                    onClick={() => handleDecision("verify")}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Verify & Approve</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed text-center text-muted-foreground space-y-2">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground/50" />
              <p className="text-xs font-semibold">No Submissions Yet</p>
              <p className="text-[11px]">
                The vendor has not yet submitted responses for this requirement.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
