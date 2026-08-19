"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toast } from "sonner";
import { Settings2, X, Plus, Trash2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ComplianceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComplianceSettingsModal({ isOpen, onClose }: ComplianceSettingsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === "super_admin";

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["compliance-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/compliance/settings");
      if (!res.ok) throw new Error("Failed to load compliance settings");
      return res.json();
    },
    enabled: isOpen,
  });

  const [defaultGraceDays, setDefaultGraceDays] = useState(15);
  const [expirationWarningDays, setExpirationWarningDays] = useState(30);
  const [allowCashExemption, setAllowCashExemption] = useState(true);
  const [companyChecklist, setCompanyChecklist] = useState<string[]>(["CR", "TAX_CARD", "ESTABLISHMENT_ID"]);
  const [freelancerChecklist, setFreelancerChecklist] = useState<string[]>([]);
  const [newCompanyDoc, setNewCompanyDoc] = useState("");
  const [newFreelancerDoc, setNewFreelancerDoc] = useState("");

  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setDefaultGraceDays(s.defaultGraceDays ?? 15);
      setExpirationWarningDays(s.expirationWarningDays ?? 30);
      setAllowCashExemption(s.allowFreelancerCashExemption ?? true);
      setCompanyChecklist(s.companyChecklist ?? ["CR", "TAX_CARD", "ESTABLISHMENT_ID"]);
      setFreelancerChecklist(s.freelancerChecklist ?? []);
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/compliance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultGraceDays,
          expirationWarningDays,
          allowFreelancerCashExemption: allowCashExemption,
          companyChecklist,
          freelancerChecklist,
          reminderThresholdDays: [expirationWarningDays, defaultGraceDays, 7, 1],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update settings");
      return data;
    },
    onSuccess: () => {
      toast.success("Compliance policy settings updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["compliance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-status"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save compliance settings.");
    },
  });

  const addDoc = (type: "company" | "freelancer") => {
    if (type === "company" && newCompanyDoc.trim()) {
      if (!companyChecklist.includes(newCompanyDoc.trim().toUpperCase())) {
        setCompanyChecklist([...companyChecklist, newCompanyDoc.trim().toUpperCase()]);
      }
      setNewCompanyDoc("");
    } else if (type === "freelancer" && newFreelancerDoc.trim()) {
      if (!freelancerChecklist.includes(newFreelancerDoc.trim().toUpperCase())) {
        setFreelancerChecklist([...freelancerChecklist, newFreelancerDoc.trim().toUpperCase()]);
      }
      setNewFreelancerDoc("");
    }
  };

  const removeDoc = (type: "company" | "freelancer", item: string) => {
    if (type === "company") {
      setCompanyChecklist(companyChecklist.filter((x) => x !== item));
    } else {
      setFreelancerChecklist(freelancerChecklist.filter((x) => x !== item));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/60 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">Global Compliance Policy Settings</h2>
              <p className="text-xs text-muted-foreground">Configure system-wide thresholds and checklists.</p>
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading compliance settings...
            </div>
          ) : (
            <>
              {/* Numeric Thresholds */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-secondary/20">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Default Grace (Days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={defaultGraceDays}
                    onChange={(e) => setDefaultGraceDays(Number(e.target.value))}
                    disabled={!isSuperAdmin}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Standard duration for new compliance cases (1–365).</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-secondary/20">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Warning Horizon (Days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={expirationWarningDays}
                    onChange={(e) => setExpirationWarningDays(Number(e.target.value))}
                    disabled={!isSuperAdmin}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Threshold to flag documents as Expiring Soon.</p>
                </div>
              </div>

              {/* Freelancer Cash Exemption Switch */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-secondary/20">
                <div className="space-y-0.5 pr-4">
                  <span className="text-sm font-semibold text-foreground">Freelancer Cash/Cheque Exemption</span>
                  <p className="text-xs text-muted-foreground">
                    When enabled, freelancers receiving cash/cheque do not require a Bank Confirmation Letter.
                  </p>
                </div>
                <Switch
                  checked={allowCashExemption}
                  onCheckedChange={setAllowCashExemption}
                  disabled={!isSuperAdmin}
                />
              </div>

              {/* Company Mandatory Checklist */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Corporate Vendor Mandatory Checklist
                </label>
                <div className="flex flex-wrap gap-2 min-h-[38px] p-2.5 rounded-2xl border border-border/50 bg-background">
                  {companyChecklist.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-secondary text-foreground font-mono text-xs font-semibold">
                      {item}
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => removeDoc("company", item)}
                          className="hover:text-rose-500 transition-colors ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. ISO_CERTIFICATE"
                      value={newCompanyDoc}
                      onChange={(e) => setNewCompanyDoc(e.target.value)}
                      className="text-xs"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDoc("company"))}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => addDoc("company")}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Freelancer Mandatory Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Freelancer Mandatory Checklist
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    (Default: empty. Only requested items are mandatory)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[38px] p-2.5 rounded-2xl border border-border/50 bg-background">
                  {freelancerChecklist.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic px-2 py-1">
                      No documents mandatory by default for freelancers.
                    </span>
                  ) : (
                    freelancerChecklist.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-secondary text-foreground font-mono text-xs font-semibold">
                        {item}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => removeDoc("freelancer", item)}
                            className="hover:text-rose-500 transition-colors ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. QID, FREELANCE_PERMIT"
                      value={newFreelancerDoc}
                      onChange={(e) => setNewFreelancerDoc(e.target.value)}
                      className="text-xs"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDoc("freelancer"))}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => addDoc("freelancer")}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 flex justify-end gap-3 bg-muted/10">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {isSuperAdmin && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saveMutation.isPending ? "Saving..." : "Save Policy"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
