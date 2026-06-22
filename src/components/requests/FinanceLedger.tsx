"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Wallet, Calendar, CheckCircle2, Calculator,
  Upload, FileCheck2, X, AlertCircle, Loader2,
  SplitSquareVertical, Lock, TrendingDown, TrendingUp, Sparkles,
  ShieldAlert, Landmark, Coins
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePerformance } from "@/context/PerformanceContext";
import { cn } from "@/lib/utils";

interface FinanceLedgerProps {
  request: any;
}

// ── Executive Status Config ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string; border: string;
  rowBg?: string; icon?: React.ReactNode; locked?: boolean;
}> = {
  paid: {
    label: "Fully Paid", bg: "bg-[#2FB7B2]/10", text: "text-[#2FB7B2]", border: "border-[#2FB7B2]/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  partial: {
    label: "Partial Payment", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20",
    icon: <SplitSquareVertical className="w-3 h-3" />,
  },
  pending: {
    label: "Awaiting Action", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20",
  },
  rescheduled: {
    label: "Rescheduled", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20",
  },
  settled_savings: {
    label: "Contractual Savings",
    bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25",
    rowBg: "bg-emerald-500/5",
    icon: <TrendingDown className="w-3 h-3" />,
    locked: true,
  },
  pending_approval: {
    label: "Variation Pending",
    bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20",
    rowBg: "bg-orange-500/5",
    icon: <Lock className="w-3 h-3" />,
    locked: true,
  },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.pending;
}

// ── Executive Financial Summary ──────────────────────────────────────────────
function FinancialHealthSummary({ 
  totalBudget, 
  totalPaid, 
  currency,
  highPerformanceMode 
}: { 
  totalBudget: number; 
  totalPaid: number; 
  currency: string;
  highPerformanceMode: boolean;
}) {
  const remaining = Math.max(0, totalBudget - totalPaid);
  const utilization = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;
  
  const glassClass = highPerformanceMode ? "bg-secondary border border-border" : "glass-card";

  return (
    <div className={`${glassClass} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-border/10 bg-[#2E2A5E]/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[#5B4B8A]" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5B4B8A]">Executive Financial Health</h3>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FB7B2]" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disbursed</span>
           </div>
           <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-border" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Remaining</span>
           </div>
        </div>
      </div>
      
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12 relative">
        {/* Background Visualizer bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary">
           <div 
            className="h-full bg-gradient-to-r from-[#5B4B8A] to-[#2FB7B2] transition-all duration-1000 ease-out"
            style={{ width: `${utilization}%` }}
           />
        </div>

        <div className="space-y-1">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Target Budget</p>
          <p className="text-3xl font-mono font-bold text-[#E2E8F0]">
            {totalBudget.toLocaleString()} <span className="text-sm font-normal opacity-40">{currency}</span>
          </p>
          <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
             <Coins className="w-3 h-3 text-[#5B4B8A]" /> Principal Commitment
          </p>
        </div>

        <div className="space-y-1 border-x border-border/10 px-12">
          <p className="text-[9px] font-black text-[#2FB7B2] uppercase tracking-widest">Fully Disbursed</p>
          <p className="text-3xl font-mono font-bold text-[#2FB7B2]">
            {totalPaid.toLocaleString()} <span className="text-sm font-normal opacity-40">{currency}</span>
          </p>
          <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
             <CheckCircle2 className="w-3 h-3 text-[#2FB7B2]" /> {utilization.toFixed(1)}% Fund Utilization
          </p>
        </div>

        <div className="space-y-1 text-right md:text-left">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Current Balance</p>
          <p className="text-3xl font-mono font-bold text-foreground">
            {remaining.toLocaleString()} <span className="text-sm font-normal opacity-40">{currency}</span>
          </p>
          <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 justify-end md:justify-start">
             <TrendingDown className="w-3 h-3 text-amber-500" /> Pending Accounts Payable
          </p>
        </div>
      </div>
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

  // ── Status & Locking Logic ──────────────────────────────────────────────
  const isLockedByStatus = request.status !== "approved";
  const statusMessage = isLockedByStatus 
    ? "Awaiting Executive Approval" 
    : "Financial Disbursement Schedule Active.";

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updatePaymentMutation = useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: number; data: any }) =>
      apiClient.requests.updatePayment(request.id, paymentId, data),
    onSuccess: (res: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      toast.success(res.message || "Financial record updated.", { duration: 5000 });
      
      // UX: Balance shift notification
      if (variables.data.status === 'partial' && !variables.data.isFinalSettlement) {
        toast.info("Remaining balance automatically shifted to final installment.", {
          icon: <SplitSquareVertical className="w-4 h-4" />,
          duration: 6000
        });
      }

      setEditingPayment(null);
      setUploadedFileUrl(null);
      setUploadedFileName(null);
      setIsFinalSettlement(false);
    },
    onError: (err: any) => {
      if (err.error === "BUDGET_EXCEEDED") {
        toast.error("Requires Budget Variation protocol.", { 
          icon: <Calculator className="w-4 h-4" />,
          duration: 8000 
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(err.message || "Failed to finalize disbursement");
      }
    },
  });

  const variationMutation = useMutation({
    mutationFn: (newTotal: number) =>
      apiClient.requests.update(request.id, { revisedTotalCost: newTotal }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      toast.success("Budget variation initiated for executive review.", { duration: 6000 });
      setShowVariationConfirm(false);
      setVariationAmount("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to trigger variation protocol"),
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
      toast.success("Receipt successfully archived.");
    } catch (e: any) {
      toast.error(e.message || "Vault upload failed");
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
    if (isLockedByStatus) return;
    setEditingPayment(payment.id);
    setIsFinalSettlement(false);
    setUploadedFileUrl(payment.attachmentUrl || null);
    setUploadedFileName(payment.attachmentUrl ? "Existing archival proof" : null);
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

  const payments: any[] = Array.isArray(request.paymentInstallments) ? request.paymentInstallments : [];
  
  // ── Calculation Engine (Strictly QAR) ───────────────────────────────────
  const activeExchangeRate = Number(request.exchangeRate || 1.0);
  const globalTargetRaw = Number(request.revisedTotalCost ?? request.totalEstimatedCost ?? 0);
  const globalTargetQar = request.baseAmountQar ?? Math.round(globalTargetRaw * activeExchangeRate);
  
  const globalPaidQar = payments.reduce((sum: number, p: any) => sum + Math.round((Number(p.paidAmount) || 0) * activeExchangeRate), 0);
  const globalTotalQar = payments.reduce((sum: number, p: any) => sum + (Number(p.calculatedAmountQar) || Math.round((Number(p.calculatedAmount) || 0) * activeExchangeRate)), 0);
  const globalPendingQar = globalTotalQar - globalPaidQar;
  const progressPercent = globalTotalQar > 0 ? Math.round((globalPaidQar / globalTotalQar) * 100) : 0;
  
  const installmentTargetRaw = payments.find((p: any) => p.id === editingPayment)?.calculatedAmount ?? 0;
  const currentItemPaidRaw = payments.find((p: any) => p.id === editingPayment)?.paidAmount ?? 0;
  const currentEntryValueRaw = Number(formData.paidAmount || 0);
  
  const newGlobalPaidQar = globalPaidQar - Math.round(currentItemPaidRaw * activeExchangeRate) + Math.round(currentEntryValueRaw * activeExchangeRate);
  const isOverpaid = newGlobalPaidQar > globalTargetQar;

  const glassClass = highPerformanceMode ? "bg-secondary border border-border" : "glass-card";

  return (
    <div className="flex flex-col gap-8">

      {/* ── Financial Health Dashboard ────────────────────────────────────── */}
      <FinancialHealthSummary 
        totalBudget={globalTargetQar} 
        totalPaid={globalPaidQar} 
        currency={"QAR"} 
        highPerformanceMode={highPerformanceMode}
      />

      {/* ── Strict Edit Lock Banner ───────────────────────────────────────── */}
      {isLockedByStatus && (
        <div className="bg-[#2E2A5E]/10 border border-[#5B4B8A]/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-[#5B4B8A]/20 flex items-center justify-center shrink-0 border border-[#5B4B8A]/30">
             <ShieldAlert className="w-7 h-7 text-[#5B4B8A]" />
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h4 className="text-sm font-black text-[#5B4B8A] uppercase tracking-widest">{statusMessage}</h4>
              <span className="px-2 py-0.5 bg-[#5B4B8A] text-white text-[8px] font-black rounded font-mono animate-pulse">HARD LOCK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              The disbursement schedule is in read-only mode while the request is in '{request.status.replace(/_/g, ' ')}' status. 
              Finance cannot disburse funds or modify the ledger until executive management provides final procurement sign-off.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg border border-border flex items-center gap-2">
              <Lock className="w-3 h-3" /> Security Protocol 16-Active
            </span>
          </div>
        </div>
      )}

      {/* ── Budget Variation Protocol ─────────────────────────────────────── */}
      <div className={`${glassClass} p-8 border-dashed border-2 relative overflow-hidden transition-all ${isOverpaid ? "border-rose-500 bg-rose-500/10" : "border-[#5B4B8A]/20 bg-[#5B4B8A]/5"}`}>
        {isOverpaid && (
          <div className="absolute top-0 right-0 p-4">
             <div className="bg-rose-500 text-white px-3 py-1 text-[9px] font-black rounded-bl-xl items-center flex gap-1 animate-pulse">
                <AlertCircle className="w-3 h-3" /> COMPLIANCE REQUIRED
             </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-8 flex-wrap relative z-10">
          <div className="flex gap-6 items-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner transition-all ${isOverpaid ? "bg-rose-500 text-white border-rose-400 rotate-12" : "bg-white/5 text-[#5B4B8A] border-[#5B4B8A]/30"}`}>
              <Calculator className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-foreground font-black text-xl uppercase tracking-tighter">Budget Variation Protocol</h3>
              </div>
              <p className="text-muted-foreground text-xs font-semibold mt-1">
                Authorized Baseline: <span className="font-mono font-bold text-[#5B4B8A]">{(request.totalEstimatedCost || 0).toLocaleString()} {request.currency}</span> <span className="opacity-60">({Math.round((request.totalEstimatedCost || 0) * activeExchangeRate).toLocaleString()} QAR)</span>
                {request.revisedTotalCost && (
                  <span className="ml-4 text-[#2FB7B2] font-mono font-bold bg-[#2FB7B2]/10 px-2 py-0.5 rounded">
                    → Revised Total: {request.revisedTotalCost.toLocaleString()} {request.currency} <span className="opacity-60">({globalTargetQar.toLocaleString()} QAR)</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!showVariationConfirm ? (
              <button 
                onClick={() => {
                  if (isOverpaid) setVariationAmount(Math.round(newGlobalPaidQar / activeExchangeRate).toString());
                  setShowVariationConfirm(true);
                }}
                disabled={isLockedByStatus}
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl border ${
                  isOverpaid 
                    ? "bg-rose-600 text-white border-rose-400 hover:bg-rose-700 active:scale-95" 
                    : "bg-secondary border-border text-foreground hover:bg-foreground hover:text-background active:scale-95 disabled:opacity-50"
                }`}
              >
                {isOverpaid ? "Initiate Variation for Overpayment" : "Request Manual Overrun"}
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-background p-2 rounded-xl border border-border shadow-2xl">
                <input type="number" placeholder="Enter New Total Cost" value={variationAmount}
                  onChange={(e) => setVariationAmount(e.target.value)}
                  className="px-4 py-2 text-[16px] md:text-sm rounded-lg bg-secondary border-none outline-none focus:ring-2 focus:ring-[#5B4B8A]/30 font-mono w-full sm:w-56 text-foreground"
                />
                <button onClick={() => {
                   const num = Math.round(Number(variationAmount));
                   const currentBudget = request.revisedTotalCost ?? request.totalEstimatedCost;
                   if (isNaN(num) || num <= currentBudget) {
                     toast.error("Revised cost must exceed authorized baseline."); return;
                   }
                   variationMutation.mutate(num);
                }} disabled={variationMutation.isPending}
                  className="px-6 py-2 bg-[#5B4B8A] text-white rounded-lg text-[10px] font-black uppercase hover:bg-[#4A3d72] transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {variationMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Finalize
                </button>
                <button onClick={() => setShowVariationConfirm(false)}
                  className="px-4 py-2 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest"
                >Cancel</button>
              </div>
            )}
          </div>
        </div>
        
        {isOverpaid && (
          <div className="mt-6 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
             <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
             <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest leading-relaxed">
               Compliance Alert: Disbursement exceeds remaining authorized funds. A formal Budget Variation is MANDATORY before این record can be settled.
             </p>
          </div>
        )}
      </div>

      {/* ── Disbursement Schedule Table ─────────────────────────────────── */}
      <div className={glassClass + " overflow-hidden border-border/50"}>
        <div className="px-8 py-5 border-b border-border/10 bg-[#2E2A5E]/10 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Landmark className="w-4 h-4 text-[#5B4B8A]" />
              <h3 className="text-[13px] font-black text-foreground tracking-[0.1em] uppercase">Disbursement Schedule</h3>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-[10px] font-bold text-muted-foreground bg-secondary/50 px-3 py-1 rounded-lg border border-border/50">
               {payments.length} Items Indexed
             </span>
           </div>
        </div>

        <div className="overflow-x-auto hidden lg:block">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/5 border-b border-border/10 uppercase font-black text-[9px] text-muted-foreground tracking-[0.25em]">
                <th className="px-8 py-5">Milestone</th>
                <th className="px-8 py-5">Ledger Status</th>
                <th className="px-8 py-5">Value Analysis</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {Array.isArray(payments) && payments.map((p: any) => {
                const cfg = getStatusCfg(p.status);
                const isEditing = editingPayment === p.id;
                
                return (
                  <tr 
                    key={p.id} 
                    className={`transition-all duration-300 hover:bg-[#5B4B8A]/5 ${cfg.rowBg ?? ""}`}
                  >
                    {isEditing ? (
                      <td colSpan={4} className="p-0">
                        <div className="p-10 bg-[#2E2A5E]/5 border-b border-[#5B4B8A]/20">
                           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                              {/* Status Select */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#5B4B8A] uppercase tracking-widest">Disbursement Phase</label>
                                <select 
                                  value={formData.status}
                                  onChange={(e) => { 
                                    setFormData({ ...formData, status: e.target.value }); 
                                    setIsFinalSettlement(false); 
                                  }}
                                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[16px] md:text-sm font-bold text-foreground outline-none focus:border-[#2FB7B2] transition-all h-11"
                                >
                                  <option value="pending">Awaiting Action</option>
                                  <option value="partial">Partial Payment</option>
                                  <option value="paid">Fully Paid</option>
                                  <option value="rescheduled">Rescheduled</option>
                                </select>
                              </div>

                              {/* Amount Input */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#5B4B8A] uppercase tracking-widest flex justify-between">
                                  <span>Paid Value (QAR)</span>
                                  {isOverpaid && <span className="text-rose-500">Exceeds Cap!</span>}
                                </label>
                                <div className="relative group">
                                  <input 
                                    type="number" 
                                    value={formData.paidAmount}
                                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                                    className={`w-full bg-background border rounded-xl px-4 py-3 text-[16px] md:text-sm font-mono font-bold transition-all h-11 ${
                                      isOverpaid ? "border-rose-500 ring-4 ring-rose-500/10" : "border-border focus:border-[#2FB7B2]"
                                    }`}
                                  />
                                  <div className="absolute right-3 top-2.5 flex gap-1 invisible group-hover:visible translate-y-[-2px] transition-all">
                                     <button onClick={() => setFormData({...formData, paidAmount: installmentTargetRaw, status: 'paid'})} className="px-2 py-0.5 bg-secondary border border-border text-[8px] font-black rounded hover:bg-[#2FB7B2]/10 hover:text-[#2FB7B2] uppercase">Fix</button>
                                  </div>
                                </div>
                              </div>

                              {/* Date Selection */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#5B4B8A] uppercase tracking-widest">Value Date</label>
                                <input 
                                  type="date" 
                                  value={formData.actualPaymentDate}
                                  onChange={(e) => setFormData({ ...formData, actualPaymentDate: e.target.value })}
                                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[16px] md:text-sm font-bold text-foreground outline-none focus:border-[#2FB7B2] transition-all h-11"
                                />
                              </div>

                              {/* Reference / Notes */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#5B4B8A] uppercase tracking-widest">Audit Reference</label>
                                <input 
                                  type="text" 
                                  value={formData.transactionReference}
                                  onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
                                  placeholder="TRF-..."
                                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[16px] md:text-sm font-mono text-foreground outline-none focus:border-[#2FB7B2] transition-all h-11"
                                />
                              </div>
                           </div>

                           {/* Savings Checkbox */}
                           {formData.status === 'paid' && Number(formData.paidAmount) < installmentTargetRaw && (
                              <div className="mt-8 p-4 rounded-2xl bg-[#2FB7B2]/5 border border-[#2FB7B2]/20 flex items-center gap-4 cursor-pointer"
                                   onClick={() => setIsFinalSettlement(!isFinalSettlement)}>
                                 <input type="checkbox" checked={isFinalSettlement} readOnly className="w-5 h-5 accent-[#2FB7B2]" />
                                 <div className="flex-1">
                                    <h4 className="text-sm font-black text-[#2FB7B2] uppercase tracking-tighter">Contractual Savings Protocol</h4>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                                      Flag this delta of ({(installmentTargetRaw - Number(formData.paidAmount)).toLocaleString()} {request.currency}) as realized savings for the organization.
                                    </p>
                                 </div>
                                 <Sparkles className="w-6 h-6 text-[#2FB7B2] animate-pulse" />
                              </div>
                           )}

                           <div className="mt-8 flex justify-end gap-3 pt-8 border-t border-border/10">
                              <button 
                                onClick={() => setEditingPayment(null)}
                                className="px-6 py-2 text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-widest h-11"
                              >Abort</button>
                              <button 
                                onClick={() => {
                                  if (formData.status === "partial" && !formData.rescheduledDate && !isFinalSettlement) {
                                    toast.error("Audit Protocol: Rescheduled date is required for partial payouts."); 
                                    return;
                                  }
                                  updatePaymentMutation.mutate({
                                    paymentId: p.id,
                                    data: { ...formData, isFinalSettlement }
                                  });
                                }}
                                disabled={updatePaymentMutation.isPending || isOverpaid}
                                className={`px-10 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all disabled:opacity-50 h-11 ${
                                  isOverpaid ? "bg-rose-500 text-white" : "bg-[#2FB7B2] text-black hover:brightness-110 active:scale-95"
                                }`}
                              >
                                {updatePaymentMutation.isPending ? "Journaling..." : isOverpaid ? "Over-Budget Locked" : "Finalize Disbursement"}
                              </button>
                           </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        {/* Milestone info */}
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 ${cfg.bg} ${cfg.border}`}>
                                 {cfg.icon || <Calendar className="w-5 h-5 opacity-40" />}
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-black text-foreground tracking-tight">{p.installmentName}</h4>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                                   <Calendar className="w-3 h-3" /> Due: {new Date(p.dueDate).toLocaleDateString()}
                                </div>
                              </div>
                           </div>
                        </td>

                        {/* Ledger Status */}
                        <td className="px-8 py-6">
                           <div className="flex flex-col gap-1.5 items-start">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                 {cfg.label}
                              </span>
                              {p.actualPaymentDate && (
                                <p className="text-[10px] font-mono font-bold text-[#2FB7B2] ml-1">
                                   ARCHIVED: {new Date(p.actualPaymentDate).toLocaleDateString()}
                                </p>
                              )}
                           </div>
                        </td>

                        {/* Value Analysis */}
                        <td className="px-8 py-6">
                           <div className="space-y-1">
                              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Authorized: {p.calculatedAmount.toLocaleString()} {request.currency}</p>
                              {p.paidAmount !== null && (
                                <p className={`text-sm font-mono font-bold ${
                                  p.savingsAmount > 0 ? "text-emerald-400" :
                                  p.paidAmount < p.calculatedAmount ? "text-amber-400" : "text-[#2FB7B2]"
                                }`}>
                                   Disbursed: {p.paidAmount.toLocaleString()} {request.currency}
                                </p>
                              )}
                              {p.savingsAmount > 0 && (
                                 <p className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter flex items-center gap-1">
                                    <TrendingDown className="w-2.5 h-2.5" /> org savings: {Math.round(p.savingsAmount * activeExchangeRate).toLocaleString()} QAR
                                 </p>
                              )}
                           </div>
                        </td>

                        {/* Actions */}
                        <td className="px-8 py-6 text-right">
                           {isLockedByStatus ? (
                              <div className="flex items-center justify-end gap-2 text-muted-foreground">
                                 <Lock className="w-3.5 h-3.5 opacity-40" />
                                 <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Awaiting Sign-off</span>
                              </div>
                           ) : cfg.locked ? (
                              <div className="flex items-center justify-end gap-2 text-[#2FB7B2]">
                                 <CheckCircle2 className="w-3.5 h-3.5" />
                                 <span className="text-[9px] font-black uppercase tracking-widest">Journal Locked</span>
                              </div>
                           ) : (
                              <button 
                                onClick={() => handleEditClick(p)}
                                className="px-5 py-2 hover:bg-[#5B4B8A] hover:text-white border border-border text-foreground rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 h-11"
                              >
                                Edit Journal
                              </button>
                           )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* MOBILE: Stacked Ledger Cards */}
        <div className="lg:hidden divide-y divide-border/10">
           {Array.isArray(payments) && payments.map((p: any) => {
             const cfg = getStatusCfg(p.status);
             const isEditing = editingPayment === p.id;
             
             return (
               <div key={p.id} className={cn("p-6 space-y-4", cfg.rowBg ?? "")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.border}`}>
                        {cfg.icon || <Calendar className="w-5 h-5 opacity-40" />}
                       </div>
                       <div>
                          <h4 className="text-sm font-black text-foreground">{p.installmentName}</h4>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Due: {new Date(p.dueDate).toLocaleDateString()}</span>
                       </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                       {cfg.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-secondary/20 p-4 rounded-xl border border-border/50">
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Authorized</p>
                        <p className="text-xs font-mono font-bold">{p.calculatedAmount.toLocaleString()} QAR</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Disbursed</p>
                        <p className={cn("text-xs font-mono font-bold", p.paidAmount ? "text-[#2FB7B2]" : "text-muted-foreground/40")}>
                          {p.paidAmount ? `${p.paidAmount.toLocaleString()} ${request.currency}` : "—"}
                        </p>
                     </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                     {isLockedByStatus ? (
                        <div className="flex items-center gap-2 text-muted-foreground opacity-40">
                           <Lock className="w-3 h-3" />
                           <span className="text-[8px] font-black uppercase tracking-widest">Sign-off Req.</span>
                        </div>
                     ) : cfg.locked ? (
                        <div className="flex items-center gap-2 text-[#2FB7B2]">
                           <CheckCircle2 className="w-3 h-3" />
                           <span className="text-[8px] font-black uppercase tracking-widest">Journal Locked</span>
                        </div>
                     ) : (
                        <button 
                          onClick={() => handleEditClick(p)}
                          className="w-full h-11 flex items-center justify-center bg-brand-primary/[0.08] hover:bg-brand-primary/20 border border-brand-primary/20 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all active-scale shadow-sm"
                        >
                          Refine Disbursement Journal
                        </button>
                     )}
                  </div>

                  {/* Mobile Edit Portal (Conditional) */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden pt-4"
                      >
                         <div className="space-y-4 p-4 rounded-2xl bg-secondary/30 border border-brand-primary/20">
                            <div className="space-y-4">
                               <div className="grid grid-cols-1 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black text-brand-primary uppercase tracking-widest">Phase</label>
                                    <select 
                                      value={formData.status}
                                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                      className="w-full h-11 bg-background border border-border rounded-lg px-4 text-[16px] md:text-xs font-bold"
                                    >
                                      <option value="pending">Awaiting Action</option>
                                      <option value="partial">Partial</option>
                                      <option value="paid">Paid</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black text-brand-primary uppercase tracking-widest">Amount (QAR)</label>
                                    <input 
                                      type="number" 
                                      value={formData.paidAmount}
                                      onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                                      className="w-full h-11 bg-background border border-border rounded-lg px-4 text-[16px] md:text-xs font-mono font-bold"
                                    />
                                  </div>
                               </div>
                               <div className="flex gap-2">
                                  <button onClick={() => setEditingPayment(null)} className="flex-1 h-11 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Abort</button>
                                  <button 
                                    onClick={() => updatePaymentMutation.mutate({ paymentId: p.id, data: formData })}
                                    disabled={updatePaymentMutation.isPending || isOverpaid}
                                    className="flex-[2] h-11 bg-brand-primary text-white rounded-lg text-[10px] font-black uppercase tracking-[0.1em] shadow-lg shadow-brand-primary/20"
                                  >
                                    {updatePaymentMutation.isPending ? "Journaling..." : "Finalize"}
                                  </button>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
             )
           })}
        </div>
      </div>
    </div>
  );
}
