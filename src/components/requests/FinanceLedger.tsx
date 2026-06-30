"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Calendar, CheckCircle2, Calculator, SplitSquareVertical, 
  Lock, TrendingDown, ShieldAlert, Landmark, Coins, Loader2, AlertCircle, Save, X, Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface FinanceLedgerProps {
  request: any;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; icon?: React.ReactNode; locked?: boolean }> = {
  paid: { label: "Fully Paid", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  partial: { label: "Partial", bg: "bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm", icon: <SplitSquareVertical className="w-3.5 h-3.5" /> },
  pending: { label: "Pending", bg: "bg-muted text-muted-foreground border-border/50 shadow-sm" },
  rescheduled: { label: "Rescheduled", bg: "bg-purple-500/10 text-purple-600 border-purple-500/20 shadow-sm" },
  settled_savings: { label: "Savings Realized", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm", icon: <TrendingDown className="w-3.5 h-3.5" />, locked: true },
  pending_approval: { label: "Variation Pending", bg: "bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-sm", icon: <Lock className="w-3.5 h-3.5" />, locked: true },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.pending;
}

function FinancialHealthSummary({ totalBudget, totalPaid, currency }: { totalBudget: number; totalPaid: number; currency: string }) {
  const remaining = Math.max(0, totalBudget - totalPaid);
  const utilization = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;
  
  return (
    <div className="bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden mb-8">
      <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <div className="bg-primary/10 p-1.5 rounded-lg">
            <Landmark className="w-4 h-4 text-primary" />
          </div>
          Financial Health Journal
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Disbursed</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-muted border border-border" /> Remaining</span>
        </div>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {/* Progress Bar inside */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted/50 overflow-hidden">
           <div className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-1000 ease-out" style={{ width: `${utilization}%` }} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Target Budget</p>
          <p className="text-3xl font-mono font-bold tracking-tight">{totalBudget.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{currency}</span></p>
        </div>
        <div className="space-y-2 md:border-l border-border/50 md:pl-8">
          <p className="text-xs font-bold text-primary uppercase tracking-widest">Fully Disbursed</p>
          <p className="text-3xl font-mono font-bold text-primary tracking-tight">{totalPaid.toLocaleString()} <span className="text-sm font-semibold text-primary/60 uppercase tracking-wider">{currency}</span></p>
        </div>
        <div className="space-y-2 md:border-l border-border/50 md:pl-8">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Current Balance</p>
          <p className="text-3xl font-mono font-bold tracking-tight">{remaining.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{currency}</span></p>
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
  
  const installmentTargetRaw = payments.find((p: any) => p.id === editingPayment)?.calculatedAmount ?? 0;
  const currentItemPaidRaw = payments.find((p: any) => p.id === editingPayment)?.paidAmount ?? 0;
  const currentEntryValueRaw = Number(formData.paidAmount || 0);
  const newGlobalPaidQar = globalPaidQar - (currentItemPaidRaw * activeExchangeRate) + (currentEntryValueRaw * activeExchangeRate);
  const isOverpaid = newGlobalPaidQar > globalTargetQar;

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
      <FinancialHealthSummary totalBudget={globalTargetQar} totalPaid={globalPaidQar} currency={request.currency || "QAR"} />

      {isLockedByStatus && (
        <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="bg-background border border-border shadow-sm p-2 rounded-full">
            <ShieldAlert className="w-6 h-6 text-muted-foreground shrink-0" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold tracking-tight">Awaiting Executive Sign-off</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Disbursement schedule is strictly locked until final procurement approval is granted.</p>
          </div>
          <Lock className="w-5 h-5 text-muted-foreground/50" />
        </div>
      )}

      {/* Variation Panel */}
      <div className={cn("rounded-2xl p-6 border shadow-sm transition-all duration-300", isOverpaid ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-card hover:shadow-md")}>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={cn("p-2 rounded-xl", isOverpaid ? "bg-destructive/10" : "bg-muted")}>
              <Calculator className={cn("w-5 h-5", isOverpaid ? "text-destructive" : "text-muted-foreground")} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Budget Variation Protocol</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Authorized Baseline: <span className="font-mono font-bold text-foreground">{(request.totalEstimatedCost || 0).toLocaleString()} {request.currency}</span>
                {request.revisedTotalCost && <span className="ml-3 text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">Revised: {request.revisedTotalCost.toLocaleString()} {request.currency}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!showVariationConfirm ? (
              <Button size="sm" variant={isOverpaid ? "destructive" : "outline"} onClick={() => {
                if (isOverpaid) setVariationAmount((newGlobalPaidQar / activeExchangeRate).toString());
                setShowVariationConfirm(true);
              }} disabled={isLockedByStatus} className="rounded-full px-5">
                {isOverpaid ? "Initiate Variation" : "Request Overrun"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-background p-1.5 rounded-full border border-border/50 shadow-sm">
                <input type="number" placeholder="New Total" value={variationAmount} onChange={(e) => setVariationAmount(e.target.value)}
                  className="px-4 py-1.5 text-sm rounded-full bg-transparent outline-none w-32 font-mono font-bold" />
                <Button size="sm" className="rounded-full px-4" onClick={() => variationMutation.mutate(Number(variationAmount))} disabled={variationMutation.isPending}>
                  {variationMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />} Finalize
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 text-muted-foreground" onClick={() => setShowVariationConfirm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        {isOverpaid && (
          <div className="mt-4 bg-destructive/10 border border-destructive/20 p-3 rounded-xl flex items-center gap-2 text-destructive text-sm font-bold">
            <AlertCircle className="w-4 h-4" /> 
            <span>Variation protocol is mandatory due to overpayment on scheduled disbursements.</span>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex justify-between items-center">
           <div className="flex items-center gap-2">
             <div className="bg-primary/10 p-1.5 rounded-lg">
               <Coins className="w-4 h-4 text-primary" />
             </div>
             <h3 className="text-sm font-bold tracking-tight">Active Disbursement Schedule</h3>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b border-border/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">Milestone Phase</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">Clearance Status</th>
                <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">Financial Value</th>
                <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {payments.map((p: any) => {
                const cfg = getStatusCfg(p.status);
                const isEditing = editingPayment === p.id;
                
                return (
                  <tr key={p.id} className={cn("transition-colors", isEditing ? "bg-muted/10" : "hover:bg-muted/5")}>
                    {isEditing ? (
                      <td colSpan={4} className="p-6">
                        <div className="bg-background border border-border/50 rounded-xl p-5 shadow-inner">
                          <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-primary">
                            <Edit3 className="w-4 h-4" /> Editing {p.installmentName}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Clearance Status</label>
                              <select value={formData.status} onChange={(e) => { setFormData({ ...formData, status: e.target.value }); setIsFinalSettlement(false); }}
                                className="w-full bg-background border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                              >
                                <option value="pending">Pending</option>
                                <option value="partial">Partial</option>
                                <option value="paid">Fully Paid</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Paid Amount ({request.currency || 'QAR'})</label>
                              <input type="number" value={formData.paidAmount} onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                                className={cn("w-full bg-background border rounded-lg px-4 py-2.5 text-sm font-mono font-bold focus:ring-2 outline-none transition-all", isOverpaid ? "border-destructive focus:ring-destructive/20 text-destructive" : "border-border/50 focus:ring-primary/20")}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Execution Date</label>
                              <input type="date" value={formData.actualPaymentDate} onChange={(e) => setFormData({ ...formData, actualPaymentDate: e.target.value })}
                                className="w-full bg-background border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Transaction Ref</label>
                              <input type="text" value={formData.transactionReference} onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })} placeholder="e.g. TRF-10293"
                                className="w-full bg-background border border-border/50 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                              />
                            </div>
                          </div>
                          
                          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border/50">
                             <Button variant="ghost" size="sm" className="rounded-full px-6" onClick={() => setEditingPayment(null)}>Cancel</Button>
                             <Button size="sm" className="rounded-full px-6 shadow-sm" variant={isOverpaid ? "destructive" : "default"} 
                               onClick={() => updatePaymentMutation.mutate({ paymentId: p.id, data: { ...formData, isFinalSettlement } })} disabled={updatePaymentMutation.isPending || isOverpaid}>
                               {updatePaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                               {updatePaymentMutation.isPending ? "Saving..." : "Commit Journal Entry"}
                             </Button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                           <div className="font-bold text-foreground">{p.installmentName}</div>
                           <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                             <Calendar className="w-3 h-3" /> Due: {new Date(p.dueDate).toLocaleDateString()}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn("px-3 py-1 rounded-full text-xs font-bold border flex w-max items-center gap-1.5 tracking-wide", cfg.bg)}>
                             {cfg.icon} {cfg.label}
                           </span>
                           {p.actualPaymentDate && <div className="text-[11px] text-muted-foreground mt-1.5 font-mono bg-muted/50 w-max px-2 py-0.5 rounded">Archived: {new Date(p.actualPaymentDate).toLocaleDateString()}</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="text-xs font-bold text-muted-foreground font-mono">Auth: {Number(p.calculatedAmount || 0).toLocaleString()}</div>
                           {p.paidAmount !== null && <div className="text-sm font-bold font-mono text-primary mt-1 bg-primary/5 inline-block px-2 py-0.5 rounded">Paid: {Number(p.paidAmount || 0).toLocaleString()}</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                           {isLockedByStatus ? (
                              <div className="bg-muted inline-flex p-2 rounded-full border border-border/50" title="Locked">
                                <Lock className="w-4 h-4 text-muted-foreground/50" />
                              </div>
                           ) : cfg.locked ? (
                              <div className="bg-emerald-500/10 inline-flex p-2 rounded-full border border-emerald-500/20" title="Completed">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              </div>
                           ) : (
                              <Button variant="outline" size="sm" className="rounded-full px-5 border-border/50 hover:bg-muted shadow-sm transition-all" onClick={() => handleEditClick(p)}>
                                Edit Entry
                              </Button>
                           )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    No disbursement milestones found for this request.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
