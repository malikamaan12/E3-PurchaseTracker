"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Calendar, CheckCircle2, Calculator, SplitSquareVertical, 
  Lock, TrendingDown, ShieldAlert, Landmark, Coins, Loader2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface FinanceLedgerProps {
  request: any;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; icon?: React.ReactNode; locked?: boolean }> = {
  paid: { label: "Paid", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  partial: { label: "Partial", bg: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <SplitSquareVertical className="w-3.5 h-3.5" /> },
  pending: { label: "Pending", bg: "bg-muted text-muted-foreground border-border" },
  rescheduled: { label: "Rescheduled", bg: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  settled_savings: { label: "Savings", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <TrendingDown className="w-3.5 h-3.5" />, locked: true },
  pending_approval: { label: "Variation Pending", bg: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: <Lock className="w-3.5 h-3.5" />, locked: true },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.pending;
}

function FinancialHealthSummary({ totalBudget, totalPaid, currency }: { totalBudget: number; totalPaid: number; currency: string }) {
  const remaining = Math.max(0, totalBudget - totalPaid);
  const utilization = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;
  
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Landmark className="w-4 h-4 text-primary" /> Financial Health
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Disbursed</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Remaining</span>
        </div>
      </div>
      
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
           <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${utilization}%` }} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Target Budget</p>
          <p className="text-2xl font-mono font-bold">{totalBudget.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{currency}</span></p>
        </div>
        <div className="space-y-1 md:border-l border-border md:pl-6">
          <p className="text-xs text-primary">Fully Disbursed</p>
          <p className="text-2xl font-mono font-bold text-primary">{totalPaid.toLocaleString()} <span className="text-sm font-normal text-primary/60">{currency}</span></p>
        </div>
        <div className="space-y-1 md:border-l border-border md:pl-6">
          <p className="text-xs text-amber-600">Current Balance</p>
          <p className="text-2xl font-mono font-bold">{remaining.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{currency}</span></p>
        </div>
      </div>
    </div>
  );
}

export function FinanceLedger({ request }: FinanceLedgerProps) {
  const queryClient = useQueryClient();
  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isFinalSettlement, setIsFinalSettlement] = useState(false);
  const [variationAmount, setVariationAmount] = useState<string>("");
  const [showVariationConfirm, setShowVariationConfirm] = useState(false);

  const isLockedByStatus = request.status !== "approved";

  const updatePaymentMutation = useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: number; data: any }) => apiClient.requests.updatePayment(request.id, paymentId, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      toast.success(res.message || "Financial record updated.");
      setEditingPayment(null);
      setIsFinalSettlement(false);
    },
    onError: (err: any) => {
      if (err.error === "BUDGET_EXCEEDED") {
        toast.error("Requires Budget Variation protocol.", { duration: 5000 });
      } else {
        toast.error(err.message || "Failed to finalize disbursement");
      }
    },
  });

  const variationMutation = useMutation({
    mutationFn: (newTotal: number) => apiClient.requests.update(request.id, { revisedTotalCost: newTotal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      toast.success("Budget variation initiated.");
      setShowVariationConfirm(false);
      setVariationAmount("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to trigger variation"),
  });

  function handleEditClick(payment: any) {
    if (isLockedByStatus) return;
    setEditingPayment(payment.id);
    setIsFinalSettlement(false);
    setFormData({
      status: payment.status || "pending",
      paidAmount: payment.paidAmount ?? payment.calculatedAmount ?? "",
      financeNotes: payment.financeNotes || "",
      actualPaymentDate: payment.actualPaymentDate ? new Date(payment.actualPaymentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      transactionReference: payment.transactionReference || "",
    });
  }

  const payments: any[] = Array.isArray(request.paymentInstallments) ? request.paymentInstallments : [];
  const activeExchangeRate = Number(request.exchangeRate || 1.0);
  const globalTargetRaw = Number(request.revisedTotalCost ?? request.totalEstimatedCost ?? 0);
  const globalTargetQar = request.baseAmountQar ?? (globalTargetRaw * activeExchangeRate);
  
  const globalPaidQar = payments.reduce((sum: number, p: any) => sum + ((Number(p.paidAmount) || 0) * activeExchangeRate), 0);
  const globalTotalQar = payments.reduce((sum: number, p: any) => sum + (Number(p.calculatedAmountQar) || ((Number(p.calculatedAmount) || 0) * activeExchangeRate)), 0);
  
  const installmentTargetRaw = payments.find((p: any) => p.id === editingPayment)?.calculatedAmount ?? 0;
  const currentItemPaidRaw = payments.find((p: any) => p.id === editingPayment)?.paidAmount ?? 0;
  const currentEntryValueRaw = Number(formData.paidAmount || 0);
  const newGlobalPaidQar = globalPaidQar - (currentItemPaidRaw * activeExchangeRate) + (currentEntryValueRaw * activeExchangeRate);
  const isOverpaid = newGlobalPaidQar > globalTargetQar;

  return (
    <div className="flex flex-col gap-6">
      <FinancialHealthSummary totalBudget={globalTargetQar} totalPaid={globalPaidQar} currency="QAR" />

      {isLockedByStatus && (
        <div className="bg-muted border border-border rounded-xl p-4 flex items-center gap-4">
          <ShieldAlert className="w-6 h-6 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Awaiting Executive Sign-off</h4>
            <p className="text-xs text-muted-foreground">Disbursement schedule is locked until final procurement approval.</p>
          </div>
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      {/* Variation Panel */}
      <div className={cn("rounded-xl p-5 border", isOverpaid ? "border-destructive bg-destructive/5" : "border-border bg-card shadow-sm")}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Calculator className={cn("w-5 h-5", isOverpaid ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <h3 className="font-semibold text-sm">Budget Variation Protocol</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authorized Baseline: <span className="font-mono font-medium">{(request.totalEstimatedCost || 0).toLocaleString()} {request.currency}</span>
                {request.revisedTotalCost && <span className="ml-2 text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">Revised: {request.revisedTotalCost.toLocaleString()} {request.currency}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!showVariationConfirm ? (
              <Button size="sm" variant={isOverpaid ? "destructive" : "outline"} onClick={() => {
                if (isOverpaid) setVariationAmount((newGlobalPaidQar / activeExchangeRate).toString());
                setShowVariationConfirm(true);
              }} disabled={isLockedByStatus}>
                {isOverpaid ? "Initiate Variation" : "Request Overrun"}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" placeholder="New Total" value={variationAmount} onChange={(e) => setVariationAmount(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-md bg-background border border-border outline-none w-32 font-mono" />
                <Button size="sm" onClick={() => variationMutation.mutate(Number(variationAmount))} disabled={variationMutation.isPending}>
                  {variationMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />} Finalize
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowVariationConfirm(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
        {isOverpaid && (
          <p className="text-xs text-destructive mt-3 flex items-center gap-1.5 font-medium"><AlertCircle className="w-3.5 h-3.5" /> Variation is mandatory due to overpayment.</p>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex justify-between items-center">
           <h3 className="text-sm font-semibold text-foreground">Disbursement Schedule</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/10 border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Milestone</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p: any) => {
                const cfg = getStatusCfg(p.status);
                const isEditing = editingPayment === p.id;
                
                return (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    {isEditing ? (
                      <td colSpan={4} className="p-4 bg-muted/20">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Phase</label>
                            <select value={formData.status} onChange={(e) => { setFormData({ ...formData, status: e.target.value }); setIsFinalSettlement(false); }}
                              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                            >
                              <option value="pending">Pending</option>
                              <option value="partial">Partial</option>
                              <option value="paid">Paid</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Paid (QAR)</label>
                            <input type="number" value={formData.paidAmount} onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                              className={cn("w-full bg-background border rounded-md px-3 py-1.5 text-sm font-mono", isOverpaid ? "border-destructive" : "border-border")}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Date</label>
                            <input type="date" value={formData.actualPaymentDate} onChange={(e) => setFormData({ ...formData, actualPaymentDate: e.target.value })}
                              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Ref</label>
                            <input type="text" value={formData.transactionReference} onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })} placeholder="TRF..."
                              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4 flex justify-end gap-2">
                           <Button variant="ghost" size="sm" onClick={() => setEditingPayment(null)}>Cancel</Button>
                           <Button size="sm" variant={isOverpaid ? "destructive" : "default"} 
                             onClick={() => updatePaymentMutation.mutate({ paymentId: p.id, data: { ...formData, isFinalSettlement } })} disabled={updatePaymentMutation.isPending || isOverpaid}>
                             {updatePaymentMutation.isPending ? "Saving..." : "Save Journal"}
                           </Button>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                           <div className="font-medium">{p.installmentName}</div>
                           <div className="text-xs text-muted-foreground mt-0.5">Due: {new Date(p.dueDate).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-3">
                           <span className={cn("px-2 py-0.5 rounded text-xs font-medium border flex w-max items-center gap-1.5", cfg.bg)}>
                             {cfg.icon} {cfg.label}
                           </span>
                           {p.actualPaymentDate && <div className="text-[10px] text-muted-foreground mt-1 font-mono">Archived: {new Date(p.actualPaymentDate).toLocaleDateString()}</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                           <div className="text-xs text-muted-foreground font-mono">Auth: {p.calculatedAmount.toLocaleString()}</div>
                           {p.paidAmount !== null && <div className="text-sm font-medium font-mono text-primary mt-0.5">Paid: {p.paidAmount.toLocaleString()}</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                           {isLockedByStatus ? (
                              <Lock className="w-4 h-4 text-muted-foreground inline-block opacity-50" />
                           ) : cfg.locked ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                           ) : (
                              <Button variant="outline" size="sm" onClick={() => handleEditClick(p)}>Edit</Button>
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
      </div>
    </div>
  );
}
