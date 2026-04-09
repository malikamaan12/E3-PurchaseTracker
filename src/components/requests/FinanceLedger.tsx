"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Wallet, Calendar, CheckCircle2, Calculator,
  Upload, FileCheck2, X, AlertCircle, Loader2,
  SplitSquareVertical, Lock, TrendingDown, TrendingUp, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePerformance } from "@/context/PerformanceContext";

interface FinanceLedgerProps {
  request: any;
}

// ── Status rendering config ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string; border: string;
  rowBg?: string; icon?: React.ReactNode; locked?: boolean;
}> = {
  paid: {
    label: "Paid", bg: "bg-[#2FB7B2]/10", text: "text-[#2FB7B2]", border: "border-[#2FB7B2]/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  partial: {
    label: "Partial", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20",
    icon: <SplitSquareVertical className="w-3 h-3" />,
  },
  pending: {
    label: "Pending", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20",
  },
  rescheduled: {
    label: "Rescheduled", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20",
  },
  settled_savings: {
    label: "Savings",
    bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25",
    rowBg: "bg-emerald-500/5",
    icon: <TrendingDown className="w-3 h-3" />,
    locked: true,
  },
  pending_approval: {
    label: "Pending Approval",
    bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20",
    rowBg: "bg-orange-500/5",
    icon: <Lock className="w-3 h-3" />,
    locked: true,
  },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.pending;
}

// ── Ledger summary footer ────────────────────────────────────────────────────
function LedgerSummary({ payments, currency }: { payments: any[]; currency: string }) {
  const totalEstimated = payments.reduce((s: number, p: any) => s + (p.calculatedAmount || 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0);
  const totalSavings = payments.reduce((s: number, p: any) => 
    s + (p.savingsAmount || 0) + (p.status === "settled_savings" ? (p.calculatedAmount || 0) : 0), 0);
  const totalPendingApproval = payments
    .filter((p: any) => p.status === "pending_approval")
    .reduce((s: number, p: any) => s + (p.calculatedAmount || 0), 0);

  return (
    <div className="px-6 py-4 border-t border-border bg-secondary/20 grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "Total Budgeted", value: totalEstimated, color: "text-foreground" },
        { label: "Total Disbursed", value: totalPaid, color: "text-[#2FB7B2]" },
        { label: "Confirmed Savings", value: totalSavings, color: "text-emerald-400", icon: <TrendingDown className="w-3 h-3" /> },
        { label: "Pending Approval", value: totalPendingApproval, color: "text-orange-400", icon: <TrendingUp className="w-3 h-3" /> },
      ].map(({ label, value, color, icon }) => (
        <div key={label} className="space-y-0.5">
          <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1">
            {icon}{label}
          </p>
          <p className={`text-base font-mono font-bold ${color}`}>
            {value.toLocaleString()} <span className="text-[10px] font-normal opacity-60">{currency}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function FinanceLedger({ request }: FinanceLedgerProps) {
  const queryClient = useQueryClient();
  const { highPerformanceMode } = usePerformance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFinalSettlement, setIsFinalSettlement] = useState(false);

  const [variationAmount, setVariationAmount] = useState<string>("");
  const [showVariationConfirm, setShowVariationConfirm] = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updatePaymentMutation = useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: number; data: any }) =>
      apiClient.requests.updatePayment(request.id, paymentId, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      toast.success(res.message || "Payment updated.", { duration: 5000 });
      setEditingPayment(null);
      setUploadedFileUrl(null);
      setUploadedFileName(null);
      setIsFinalSettlement(false);
    },
    onError: (err: any) => {
      if (err.error === "BUDGET_EXCEEDED") {
        toast.error(err.message || "Budget exceeded. Variation protocol required.", { 
          icon: <Calculator className="w-4 h-4" />,
          duration: 8000 
        });
        // Scroll to variation panel
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(err.message || "Failed to update payment");
      }
    },
  });

  const variationMutation = useMutation({
    mutationFn: (newTotal: number) =>
      apiClient.requests.update(request.id, { revisedTotalCost: newTotal }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      toast.success(res.message || "Budget variation initiated.", { duration: 6000 });
      setShowVariationConfirm(false);
      setVariationAmount("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to trigger variation"),
  });

  // ── File Upload ───────────────────────────────────────────────────────────
  async function handleFileUpload(file: File) {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Only PDF, JPG, PNG, WEBP accepted."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB."); return; }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/attachments/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const [record] = await res.json();
      setUploadedFileUrl(record.fileUrl);
      setUploadedFileName(file.name);
      toast.success("Receipt uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDropEvent(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  // ── Edit Controls ─────────────────────────────────────────────────────────
  function handleEditClick(payment: any) {
    setEditingPayment(payment.id);
    setIsFinalSettlement(false);
    setUploadedFileUrl(payment.attachmentUrl || null);
    setUploadedFileName(payment.attachmentUrl ? "Existing receipt" : null);
    setFormData({
      status: payment.status || "pending",
      paidAmount: payment.paidAmount ?? payment.calculatedAmount ?? "",
      financeNotes: payment.financeNotes || "",
      actualPaymentDate: payment.actualPaymentDate
        ? new Date(payment.actualPaymentDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      rescheduledDate: payment.rescheduledDate
        ? new Date(payment.rescheduledDate).toISOString().slice(0, 10)
        : "",
      transactionReference: payment.transactionReference || "",
    });
  }

  function handleSave(paymentId: number) {
    if (formData.status === "partial" && !formData.rescheduledDate && !isFinalSettlement) {
      toast.error("A rescheduled date is required for partial payments."); return;
    }
    updatePaymentMutation.mutate({
      paymentId,
      data: { ...formData, attachmentUrl: uploadedFileUrl ?? undefined, isFinalSettlement },
    });
  }

  function handleVariationSubmit() {
    const num = Math.round(Number(variationAmount));
    const currentBudget = request.revisedTotalCost ?? request.totalEstimatedCost;
    if (isNaN(num) || num <= currentBudget) {
      toast.error("Revised cost must be greater than the current budget."); return;
    }
    variationMutation.mutate(num);
  }

  const payments: any[] = request.paymentInstallments || [];
  
  // ── Status & Locking Logic ──────────────────────────────────────────────
  const isLockedByStatus = request.status !== "approved";
  const statusMessage = isLockedByStatus 
    ? `Schedule locked while status is '${request.status.replace(/_/g, ' ')}'.` 
    : "Financial schedule active.";

  // ── Calculation Engine ──────────────────────────────────────────────────
  const globalTarget = Number(request.revisedTotalCost ?? request.totalEstimatedCost ?? 0);
  const globalPaid = payments.reduce((sum: number, p: any) => sum + (p.paidAmount ?? 0), 0);
  const globalRemaining = Math.max(0, globalTarget - globalPaid);

  const installmentTarget = payments.find((p: any) => p.id === editingPayment)?.calculatedAmount ?? 0;
  const currentEntryValue = Number(formData.paidAmount || 0);
  const currentItemPaid = payments.find((p: any) => p.id === editingPayment)?.paidAmount ?? 0;
  
  // Calculate what the global paid would be if this edit is saved
  const newGlobalPaid = globalPaid - currentItemPaid + currentEntryValue;
  const newGlobalRemaining = globalTarget - newGlobalPaid;
  const isOverpaid = newGlobalPaid > globalTarget;

  // Animation variants controlled by highPerformanceMode
  const motionProps = highPerformanceMode ? { initial: false, animate: false } : {};
  const glassClass = highPerformanceMode ? "bg-secondary border border-border" : "glass-card";

  const isPartial = formData.status === "partial";
  const showSavingsCheckbox =
    editingPayment !== null &&
    formData.paidAmount !== "" &&
    Number(formData.paidAmount) < installmentTarget;

  return (
    <div className="flex flex-col gap-8">

      {/* ── Financial Health Dashboard ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { 
            label: "Allocated Budget", 
            value: globalTarget, 
            sub: "Total Authorized",
            icon: <Wallet className="w-5 h-5 text-[#5B4B8A]" />, // Brand Purple
            border: "border-[#5B4B8A]/20",
            bg: "bg-[#5B4B8A]/5",
            accent: "#5B4B8A"
          },
          { 
            label: "Total Disbursed", 
            value: globalPaid, 
            sub: `${((globalPaid / globalTarget) * 100).toFixed(1)}% Utilization`,
            icon: <CheckCircle2 className="w-5 h-5 text-[#2FB7B2]" />, // Brand Teal
            border: "border-[#2FB7B2]/20",
            bg: "bg-[#2FB7B2]/5",
            accent: "#2FB7B2"
          },
          { 
            label: "Pending Payables", 
            value: globalRemaining, 
            sub: globalRemaining <= 0 ? "Account Fully Settled" : "Remaining Commitment",
            icon: <TrendingDown className="w-5 h-5 text-amber-500" />,
            border: "border-amber-500/20",
            bg: "bg-amber-500/5",
            accent: "#F59E0B"
          },
        ].map((stat, i) => (
          <motion.div key={i} 
            {...(!highPerformanceMode ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.1 } } : {})}
            className={`${glassClass} p-5 relative overflow-hidden group border-l-4 transition-all hover:translate-y-[-2px]`}
            style={{ borderLeftColor: stat.accent }}
          >
            <div className="flex justify-between items-start relative z-10">
               <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                  <p className="text-2xl font-mono font-bold text-foreground">
                    {stat.value.toLocaleString()} <span className="text-xs font-normal opacity-40">{request.currency}</span>
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">{stat.sub}</p>
               </div>
               <div className="p-3 bg-background/50 rounded-xl border border-white/5 shadow-inner backdrop-blur-sm">
                 {stat.icon}
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {isLockedByStatus && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
             <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-400">Financial Schedule Locked</h4>
            <p className="text-xs text-muted-foreground">{statusMessage} No disbursements can be logged until management gives final sign-off.</p>
          </div>
        </motion.div>
      )}

      {/* ── Budget Variation Panel ─────────────────────────────────────── */}
      <motion.div 
        {...(!highPerformanceMode ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } } : {})}
        className={`${glassClass} p-6 border-dashed border-2 transition-all ${isOverpaid ? "border-rose-500 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.1)]" : "border-rose-500/20 bg-rose-500/5"}`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-4 items-center">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isOverpaid ? "bg-rose-500 text-white animate-bounce" : "bg-rose-500/10 text-rose-500"}`}>
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-foreground font-bold font-serif text-lg leading-none">Budget Variation Protocol</h3>
                {isOverpaid && <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded uppercase tracking-widest animate-pulse">Requires Budget Variation</span>}
              </div>
              <p className="text-muted-foreground text-xs font-medium mt-1.5">
                Baseline: <span className="font-mono font-bold text-foreground">{(request.totalEstimatedCost || 0).toLocaleString()} {request.currency}</span>
                {request.revisedTotalCost && (
                  <span className="ml-3 text-rose-400 font-mono font-bold">
                    → Revised: {request.revisedTotalCost.toLocaleString()} {request.currency}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!showVariationConfirm ? (
              <button onClick={() => {
                if (isOverpaid) setVariationAmount(newGlobalPaid.toString());
                setShowVariationConfirm(true);
              }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${isOverpaid ? "bg-rose-500 text-white border-rose-400 hover:bg-rose-600" : "bg-background border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white"}`}
              >
                {isOverpaid ? "Initate Variation for Overpayment" : "Trigger Manual Overrun"}
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" placeholder="New Total (QAR)" value={variationAmount}
                  onChange={(e) => setVariationAmount(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-background border border-border outline-none focus:border-rose-500 font-mono w-44"
                />
                <button onClick={handleVariationSubmit} disabled={variationMutation.isPending}
                  className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {variationMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Confirm
                </button>
                <button onClick={() => setShowVariationConfirm(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >Cancel</button>
              </div>
            )}
          </div>
        </div>
        {(showVariationConfirm || isOverpaid) && (
          <p className="text-[10px] uppercase font-bold text-rose-500 mt-4 tracking-wider flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {isOverpaid 
              ? `Compliance Alert: Current payment of ${currentEntryValue.toLocaleString()} QAR exceeds remaining budget by ${(newGlobalPaid - globalTarget).toLocaleString()} QAR. A Variation is MANDATORY.`
              : "⚠ Variation will reset Gatekeeper approvals & auto-generate a delta installment row."}
          </p>
        )}
      </motion.div>

      {/* ── Installments Ledger Table ─────────────────────────────────── */}
      <div className={glassClass + " overflow-hidden"}>
        <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center gap-3">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground tracking-tight uppercase">Disbursement Schedule</h3>
          <div className="ml-auto flex items-center gap-2">
            {payments.some((p: any) => p.status === "settled_savings") && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <TrendingDown className="w-2.5 h-2.5" /> savings detected
              </span>
            )}
            {payments.some((p: any) => p.status === "pending_approval") && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full animate-pulse">
                <Lock className="w-2.5 h-2.5" /> variation pending
              </span>
            )}
            <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
              {payments.length} records
            </span>
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="bg-secondary/10 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Installment</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Amounts</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Receipt</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {payments.map((p: any) => {
              const cfg = getStatusCfg(p.status);
              const isEditing = editingPayment === p.id;
              const editingInstallment = payments.find((x: any) => x.id === editingPayment);
              const calcAmount = editingInstallment?.calculatedAmount ?? 0;

              return (
                <tr key={p.id} className={`transition-colors hover:bg-secondary/10 ${cfg.rowBg ?? ""}`}>
                  {isEditing ? (
                    <td colSpan={4} className="p-0">
                      <AnimatePresence>
                        <motion.div
                          {...(!highPerformanceMode ? { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, exit: { opacity: 0, height: 0 } } : {})}
                          className="p-6 bg-secondary/30 border-b border-border"
                        >
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                            {/* Status */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</label>
                              <select value={formData.status}
                                onChange={(e) => { setFormData({ ...formData, status: e.target.value }); setIsFinalSettlement(false); }}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#5B4B8A] transition-colors"
                              >
                                <option value="pending">Pending</option>
                                <option value="partial">Partial</option>
                                <option value="paid">Paid</option>
                                <option value="rescheduled">Rescheduled</option>
                              </select>
                            </div>

                             {/* Paid Amount */}
                             <div className="space-y-1.5 relative">
                               <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex justify-between">
                                  <span>Paid Amount (QAR)</span>
                                  {isOverpaid && <span className="text-rose-500 animate-pulse">Over Budget!</span>}
                               </label>
                               <div className="relative">
                                  <input type="number" value={formData.paidAmount}
                                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                                    className={`w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none font-mono transition-all ${isOverpaid ? "border-rose-500 focus:ring-2 focus:ring-rose-500/20" : "border-border focus:border-[#5B4B8A]"}`}
                                  />
                                  <div className="absolute right-2 top-1.2 flex gap-1">
                                    <button 
                                      onClick={() => setFormData({...formData, paidAmount: installmentTarget, status: 'paid'})}
                                      className="px-2 py-0.5 bg-secondary hover:bg-brand-primary/10 text-[9px] font-bold rounded border border-border transition-colors uppercase"
                                    >Full</button>
                                    <button 
                                      onClick={() => {
                                        const globalLeft = globalTarget - (globalPaid - currentItemPaid);
                                        setFormData({...formData, paidAmount: globalLeft, status: 'paid'});
                                      }}
                                      className="px-2 py-0.5 bg-secondary hover:bg-amber-500/10 text-[9px] font-bold rounded border border-border transition-colors uppercase"
                                    >Balance</button>
                                  </div>
                               </div>

                               {/* Preview messages */}
                               <div className="space-y-1 mt-1.5">
                                  {isPartial && !isFinalSettlement && currentEntryValue !== 0 && currentEntryValue < installmentTarget && (
                                    <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                                      <SplitSquareVertical className="w-3 h-3" />
                                      Inst. Remainder: {(installmentTarget - currentEntryValue).toLocaleString()} QAR → Split
                                    </p>
                                  )}
                                  {isFinalSettlement && currentEntryValue !== 0 && currentEntryValue < installmentTarget && (
                                    <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                      <TrendingDown className="w-3 h-3" />
                                      Savings: {(installmentTarget - currentEntryValue).toLocaleString()} QAR → INLINE SAVINGS
                                    </p>
                                  )}
                                  <div className={`p-2 rounded-lg border text-[10px] font-bold font-mono flex items-center justify-between ${isOverpaid ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500"}`}>
                                      <span>NEW REQ. BALANCE:</span>
                                      <span>{newGlobalRemaining.toLocaleString()} QAR</span>
                                  </div>
                               </div>
                             </div>

                            {/* Actual Date */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Actual Date</label>
                              <input type="date" value={formData.actualPaymentDate}
                                onChange={(e) => setFormData({ ...formData, actualPaymentDate: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#5B4B8A] transition-colors"
                              />
                            </div>

                            {/* Rescheduled Date — mandatory for PARTIAL */}
                            <div className="space-y-1.5">
                              <label className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 ${isPartial && !isFinalSettlement ? "text-amber-400" : "text-muted-foreground"}`}>
                                Rescheduled Date {isPartial && !isFinalSettlement && <span className="text-rose-400">*</span>}
                              </label>
                              <input type="date" value={formData.rescheduledDate}
                                onChange={(e) => setFormData({ ...formData, rescheduledDate: e.target.value })}
                                required={isPartial && !isFinalSettlement}
                                className={`w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${isPartial && !isFinalSettlement ? "border-amber-500/50 focus:border-amber-400" : "border-border focus:border-[#5B4B8A]"}`}
                              />
                              {isPartial && !isFinalSettlement && !formData.rescheduledDate && (
                                <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Required for partial
                                </p>
                              )}
                            </div>

                            {/* Tx Reference */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tx Reference</label>
                              <input type="text" value={formData.transactionReference}
                                onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
                                placeholder="e.g. TRF-20240408"
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#5B4B8A] font-mono transition-colors"
                              />
                            </div>

                            {/* Finance Notes */}
                            <div className="col-span-2 lg:col-span-3 space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Finance Notes</label>
                              <input type="text" value={formData.financeNotes}
                                onChange={(e) => setFormData({ ...formData, financeNotes: e.target.value })}
                                placeholder="e.g. Wire fee deducted, awaiting confirmation..."
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#5B4B8A] transition-colors"
                              />
                            </div>

                            {/* ── Final Settlement Checkbox ──────────────── */}
                            {showSavingsCheckbox && (
                              <div className="col-span-2 lg:col-span-4">
                                <label
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    isFinalSettlement
                                      ? "bg-emerald-500/10 border-emerald-500/30"
                                      : "bg-background border-border hover:border-emerald-500/30"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isFinalSettlement}
                                    onChange={(e) => {
                                      setIsFinalSettlement(e.target.checked);
                                      if (e.target.checked) setFormData({ ...formData, status: "paid" });
                                    }}
                                    className="w-4 h-4 rounded accent-emerald-500"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-emerald-400" />
                                      <span className="text-sm font-bold text-foreground">Mark as Fully Settled (with Savings)</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      Log this payment as the final closure for this installment, recording a <span className="text-emerald-400 font-bold">SAVINGS</span> of ({(calcAmount - Number(formData.paidAmount || 0)).toLocaleString()} QAR) on this record.
                                    </p>
                                  </div>
                                </label>
                              </div>
                            )}

                            {/* ── Receipt Upload Dropzone ───────────────── */}
                            <div className="col-span-2 lg:col-span-4 space-y-2">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Receipt / Invoice</label>
                              {uploadedFileUrl ? (
                                <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2FB7B2]/30 bg-[#2FB7B2]/5">
                                  <FileCheck2 className="w-5 h-5 text-[#2FB7B2] shrink-0" />
                                  <p className="text-sm text-foreground font-medium flex-1 truncate">{uploadedFileName}</p>
                                  <button onClick={() => { setUploadedFileUrl(null); setUploadedFileName(null); }}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                                  ><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <div
                                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                  onDragLeave={() => setIsDragging(false)}
                                  onDrop={handleDropEvent}
                                  onClick={() => fileInputRef.current?.click()}
                                  className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-5 text-center ${
                                    isDragging ? "border-[#5B4B8A] bg-[#5B4B8A]/10" : "border-border hover:border-[#5B4B8A]/50 hover:bg-[#5B4B8A]/5"
                                  }`}
                                >
                                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                                  />
                                  {isUploading ? (
                                    <div className="flex flex-col items-center gap-2">
                                      <Loader2 className="w-7 h-7 text-[#5B4B8A] animate-spin" />
                                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Uploading…</p>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1.5">
                                      <Upload className={`w-7 h-7 ${isDragging ? "text-[#5B4B8A]" : "text-muted-foreground"}`} />
                                      <p className="text-sm font-bold text-foreground">Drop receipt or click to browse</p>
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">PDF, JPG, PNG, WEBP — max 10 MB</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                          </div>

                          {/* Actions */}
                          <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-border">
                            <button onClick={() => { setEditingPayment(null); setUploadedFileUrl(null); setUploadedFileName(null); setIsFinalSettlement(false); }}
                              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
                            >Cancel</button>

                            {isOverpaid ? (
                               <button onClick={() => {
                                 setVariationAmount(newGlobalPaid.toString());
                                 setShowVariationConfirm(true);
                                 window.scrollTo({ top: 0, behavior: 'smooth' });
                               }}
                               className="px-6 py-2 rounded-lg text-xs font-extrabold shadow-lg uppercase tracking-wider transition-all bg-rose-500 text-white hover:bg-rose-600 flex items-center gap-1.5"
                               >
                                 <AlertCircle className="w-3.5 h-3.5" />
                                 Adjust Budget Variation
                               </button>
                            ) : (
                              <button onClick={() => handleSave(p.id)}
                                disabled={updatePaymentMutation.isPending || isUploading}
                                className={`px-6 py-2 rounded-lg text-xs font-extrabold shadow-lg uppercase tracking-wider transition-all disabled:opacity-60 flex items-center gap-1.5 text-black ${
                                  isFinalSettlement ? "bg-emerald-400 hover:brightness-110" : "bg-[#2FB7B2] hover:brightness-110"
                                }`}
                              >
                                {updatePaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {isFinalSettlement ? "Settle & Record Savings" : isPartial ? "Log Partial & Consolidate" : "Save Changes"}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </td>
                  ) : (
                    <>
                      {/* Installment info */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground">{p.installmentName}</h4>
                            <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                              {cfg.icon}{cfg.label}
                            </span>
                            {p.attachmentUrl && (
                              <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[9px] font-black uppercase tracking-wider text-[#2FB7B2] flex items-center gap-0.5 hover:underline"
                              ><FileCheck2 className="w-3 h-3" /> Receipt</a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex-wrap">
                            <Calendar className="w-3 h-3" /> Due: {new Date(p.dueDate).toLocaleDateString()}
                            {p.actualPaymentDate && (
                              <span className="text-[#2FB7B2] border-l border-border pl-2 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Paid: {new Date(p.actualPaymentDate).toLocaleDateString()}
                              </span>
                            )}
                            {p.rescheduledDate && (
                              <span className="text-purple-400 border-l border-border pl-2">↻ {new Date(p.rescheduledDate).toLocaleDateString()}</span>
                            )}
                          </div>
                          {/* Locked notice for special statuses */}
                          {cfg.locked && (
                            <p className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${cfg.text}`}>
                              <Lock className="w-3 h-3" />
                              {p.status === "pending_approval" ? "Locked — awaiting gatekeeper re-approval" : "Company savings — no further payment required"}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Amounts */}
                      <td className="px-6 py-4 space-y-1">
                        <p className="text-xs font-mono text-muted-foreground">Est: {p.calculatedAmount.toLocaleString()} QAR</p>
                        {p.paidAmount !== null && p.paidAmount !== undefined && (
                          <p className={`text-sm font-mono font-bold ${
                            p.savingsAmount > 0 ? "text-emerald-400" :
                            p.paidAmount < p.calculatedAmount ? "text-amber-400" :
                            p.paidAmount > p.calculatedAmount ? "text-rose-400" : "text-[#2FB7B2]"
                          }`}>
                            {p.savingsAmount > 0 ? "Saved:" : "Act:"} {p.paidAmount.toLocaleString()} QAR
                          </p>
                        )}
                        {p.savingsAmount > 0 && (
                           <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-tight">+ {p.savingsAmount.toLocaleString()} QAR discount</p>
                        )}
                        {p.financeNotes && (
                          <p className="text-[10px] text-muted-foreground max-w-[220px] truncate">{p.financeNotes}</p>
                        )}
                      </td>

                      {/* Receipt */}
                      <td className="px-6 py-4">
                        {p.attachmentUrl ? (
                          <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2FB7B2]/10 border border-[#2FB7B2]/20 text-[#2FB7B2] rounded-lg text-[10px] font-bold uppercase hover:bg-[#2FB7B2]/20 transition-colors"
                          ><FileCheck2 className="w-3 h-3" /> View</a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {cfg.locked || isLockedByStatus ? (
                          <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center justify-end gap-1 ${isLockedByStatus ? "text-amber-500" : cfg.text} opacity-60`}>
                            <Lock className="w-3 h-3" /> {isLockedByStatus ? "Schedule Locked" : p.status === "pending_approval" ? "Locked" : "Settled"}
                          </span>
                        ) : (
                          <button onClick={() => handleEditClick(p)}
                            className="px-3 py-1.5 bg-secondary/50 hover:bg-[#5B4B8A]/20 hover:border-[#5B4B8A]/30 border border-transparent text-foreground rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                          >Update Schedule</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {payments.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-muted-foreground text-xs uppercase tracking-[0.3em] font-bold">
                  No Installments Defined
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Summary footer */}
        {payments.length > 0 && (
          <LedgerSummary payments={payments} currency={request.currency || "QAR"} />
        )}
      </div>
    </div>
  );
}
