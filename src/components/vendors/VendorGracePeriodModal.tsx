"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { X, ShieldAlert, Clock, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/utils";

interface VendorGracePeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: number;
  vendorName: string;
  currentDeadline?: string | null;
}

export function VendorGracePeriodModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  currentDeadline,
}: VendorGracePeriodModalProps) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(15);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const extendMutation = useMutation({
    mutationFn: (payload: { days: number; reason: string }) =>
      apiClient.vendors.extendGracePeriod(vendorId, payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      toast.success(res.message || "Grace period extended successfully.");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to extend grace period.");
    },
  });

  if (!isOpen || !mounted) return null;

  const now = new Date();
  const baseDate = currentDeadline && new Date(currentDeadline).getTime() > now.getTime()
    ? new Date(currentDeadline)
    : now;
  const projectedDeadline = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 10) {
      toast.error("A detailed justification reason (minimum 10 characters) is required.");
      return;
    }
    extendMutation.mutate({ days, reason: reason.trim() });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-gradient-to-r from-amber-500/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Extend Compliance Grace Period</h3>
              <p className="text-xs text-muted-foreground">{vendorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 space-y-1 text-xs">
            <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px]">
              Super Admin Authorization Notice
            </span>
            <p className="text-muted-foreground leading-relaxed">
              Extending the grace period allows temporary purchase request submissions for this supplier while compliance documentation is pending. All extensions are permanently recorded in the system audit log.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Extension Duration (Days)*
            </label>
            <input
              type="number"
              min={1}
              max={365}
              required
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3" />
              New Projected Deadline: <strong>{safeFormatDate(projectedDeadline, "MMM dd, yyyy")}</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Mandatory Justification Reason* (min 10 chars)
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Supplier CR renewal in progress at Ministry of Commerce; expected receipt by end of month..."
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={extendMutation.isPending || reason.trim().length < 10}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {extendMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Authorize Extension</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
