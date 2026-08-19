"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface RequestComplianceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  requestNumber: string;
  vendor: {
    id: number;
    companyName: string;
    complianceStatus?: string;
  };
}

export function RequestComplianceOverrideModal({
  isOpen,
  onClose,
  requestId,
  requestNumber,
  vendor,
}: RequestComplianceOverrideModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === "super_admin";

  const [justification, setJustification] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: overrideData, isLoading } = useQuery({
    queryKey: ["request-override", requestId],
    queryFn: async () => {
      const res = await fetch(`/api/requests/${requestId}/compliance-override`);
      if (!res.ok) return { success: false, override: null };
      return res.json();
    },
    enabled: isOpen && !!requestId,
  });

  const override = overrideData?.override;

  const requestOverrideMutation = useMutation({
    mutationFn: async () => {
      if (justification.trim().length < 10) {
        throw new Error("Justification must be at least 10 characters.");
      }
      const res = await fetch(`/api/requests/${requestId}/compliance-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justification }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to request override");
      return data;
    },
    onSuccess: () => {
      toast.success("Compliance override request submitted for Super Admin review.");
      queryClient.invalidateQueries({ queryKey: ["request-override", requestId] });
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      setJustification("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit override request");
    },
  });

  const reviewOverrideMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      const res = await fetch(`/api/requests/${requestId}/compliance-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: action === "reject" ? reviewNotes : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${action} override`);
      return data;
    },
    onSuccess: (_, action) => {
      toast.success(`Compliance override ${action}d successfully.`);
      queryClient.invalidateQueries({ queryKey: ["request-override", requestId] });
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to review override");
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">Compliance Policy Override</h2>
              <p className="text-xs text-muted-foreground font-mono">
                PR {requestNumber} • Vendor: {vendor.companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Vendor Status Alert */}
          <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Vendor Compliance Status: <span className="uppercase font-bold">{vendor.complianceStatus?.replace(/_/g, " ") || "UNKNOWN"}</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Procurement policy blocks purchase requests with non-compliant vendors unless an explicit PR-bound override is granted by a Super Admin.
              </p>
            </div>
          </div>

          {/* Active Override Status if any */}
          {override && (
            <div className="p-4 rounded-2xl border border-border/50 bg-secondary/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Override Status</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    override.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : override.status === "rejected"
                      ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                      : override.status === "consumed"
                      ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {override.status.toUpperCase()}
                </span>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground"><span className="font-semibold text-foreground">Justification:</span> {override.justification}</p>
                {override.rejectionReason && (
                  <p className="text-rose-600"><span className="font-semibold">Rejection Note:</span> {override.rejectionReason}</p>
                )}
                {override.consumedAt && (
                  <p className="text-blue-600 font-mono"><span className="font-semibold text-foreground">Consumed At:</span> {new Date(override.consumedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}

          {/* Request New Override Form */}
          {(!override || override.status === "rejected") && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Emergency Justification <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Explain the critical operational necessity requiring procurement prior to compliance resolution (min 10 chars)..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => requestOverrideMutation.mutate()}
                disabled={requestOverrideMutation.isPending || justification.trim().length < 10}
                className="w-full mt-2"
              >
                {requestOverrideMutation.isPending ? "Submitting..." : "Submit Override Request"}
              </Button>
            </div>
          )}

          {/* Super Admin Review Controls */}
          {isSuperAdmin && override && override.status === "pending" && (
            <div className="space-y-3 pt-3 border-t border-border/50">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Super Admin Review Notes</label>
              <Textarea
                placeholder="Review notes or rejection reason..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => reviewOverrideMutation.mutate("reject")}
                  disabled={reviewOverrideMutation.isPending}
                  className="flex-1 border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject Override
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => reviewOverrideMutation.mutate("approve")}
                  disabled={reviewOverrideMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve Override
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 flex justify-end bg-muted/10">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
