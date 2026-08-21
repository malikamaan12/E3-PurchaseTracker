"use client";

import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toast } from "sonner";
import {
  Lock,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  X,
} from "lucide-react";

interface VendorRuleMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorRuleMatrixModal({ open, onOpenChange }: VendorRuleMatrixModalProps) {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const [rules, setRules] = useState<any[]>([]);
  const [activeRuleset, setActiveRuleset] = useState<any>(null);
  const [allVersions, setAllVersions] = useState<any[]>([]);

  const [previewResult, setPreviewResult] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [applyToExisting, setApplyToExisting] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rules");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
        setActiveRuleset(data.activeRuleset);
        setAllVersions(data.allVersions || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load rule definitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRules();
    }
  }, [open]);

  const handleToggle = async (ruleId: number, field: string, value: boolean) => {
    const targetRule = rules.find((r) => r.id === ruleId);
    if (!targetRule) return;

    if (targetRule.isLocked && (field === "companyMandatory" || field === "freelancerMandatory" || field === "isActive")) {
      toast.error("This core requirement is mandatory by institutional policy and cannot be altered.");
      return;
    }

    const updated = { ...targetRule, [field]: value };

    // Apply cascades
    if (field === "companyApplicable" && !value) {
      updated.companyMandatory = false;
      updated.companyAffectsScore = false;
    }
    if (field === "freelancerApplicable" && !value) {
      updated.freelancerMandatory = false;
      updated.freelancerAffectsScore = false;
    }
    if (field === "companyMandatory" && value) {
      updated.companyAffectsScore = true;
    }
    if (field === "freelancerMandatory" && value) {
      updated.freelancerAffectsScore = true;
    }

    // Optimistic UI update
    setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));

    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save rule change");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update rule");
      fetchRules(); // Revert on failure
    }
  };

  const handleSimulateImpact = async () => {
    setSimulating(true);
    try {
      const res = await fetch("/api/admin/rules/preview-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetVersionId: activeRuleset?.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewResult(data.preview);
        setShowPreviewModal(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/rules/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeSummary: changeSummary || "Admin ruleset update",
          applyToExistingVendors: applyToExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to publish ruleset");
      }

      toast.success(`Version ${data.publishedRuleset.versionNumber} is now the active institutional compliance standard.`);
      setShowPreviewModal(false);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || "Publishing error");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 animate-in fade-in-0 duration-200" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[95vw] lg:max-w-6xl translate-x-[-50%] translate-y-[-50%] p-0 overflow-hidden rounded-2xl border bg-background shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95">
            <div className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className="text-xl font-bold text-foreground">
                    Vendor Rule Matrix (Spreadsheet Settings)
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                    Configure mandatory legal & financial requirements. Changes do not block Purchase Requests.
                  </Dialog.Description>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateImpact}
                  disabled={simulating || loading}
                  className="gap-1.5 text-xs rounded-xl"
                >
                  {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  Simulate Impact
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowPreviewModal(true)}
                  className="gap-1.5 text-xs rounded-xl shadow-md font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish Ruleset
                </Button>
                <Dialog.Close asChild>
                  <button className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs">Loading rule definitions...</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/60 border-b text-muted-foreground font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Requirement</th>
                        <th className="py-3 px-3">Section</th>
                        <th className="py-3 px-3">Input Type</th>
                        <th className="py-3 px-3 text-center">Active</th>
                        <th className="py-3 px-3 text-center bg-blue-500/5">Company App</th>
                        <th className="py-3 px-3 text-center bg-blue-500/5">Co. Mandatory</th>
                        <th className="py-3 px-3 text-center bg-blue-500/5">Co. Score</th>
                        <th className="py-3 px-3 text-center bg-purple-500/5">Freelancer App</th>
                        <th className="py-3 px-3 text-center bg-purple-500/5">Free. Mandatory</th>
                        <th className="py-3 px-3 text-center bg-purple-500/5">Free. Score</th>
                        <th className="py-3 px-3 text-center">Expiry Req</th>
                        <th className="py-3 px-3 text-center">Score Wt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rules.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              {r.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              <span>{r.name}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-normal mt-0.5">{r.description}</p>
                          </td>
                          <td className="py-3 px-3 capitalize">{r.section}</td>
                          <td className="py-3 px-3 capitalize font-mono text-[11px]">{r.inputType.replace(/_/g, " ")}</td>
                          <td className="py-3 px-3 text-center">
                            <Switch
                              checked={r.isActive}
                              disabled={r.isLocked}
                              onCheckedChange={(val) => handleToggle(r.id, "isActive", val)}
                            />
                          </td>

                          {/* Company Settings */}
                          <td className="py-3 px-3 text-center bg-blue-500/5">
                            <Switch
                              checked={r.companyApplicable}
                              disabled={r.isLocked}
                              onCheckedChange={(val) => handleToggle(r.id, "companyApplicable", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-blue-500/5">
                            <Switch
                              checked={r.companyMandatory}
                              disabled={r.isLocked || !r.companyApplicable}
                              onCheckedChange={(val) => handleToggle(r.id, "companyMandatory", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-blue-500/5">
                            <Switch
                              checked={r.companyAffectsScore}
                              disabled={r.isLocked || !r.companyApplicable || r.companyMandatory}
                              onCheckedChange={(val) => handleToggle(r.id, "companyAffectsScore", val)}
                            />
                          </td>

                          {/* Freelancer Settings */}
                          <td className="py-3 px-3 text-center bg-purple-500/5">
                            <Switch
                              checked={r.freelancerApplicable}
                              disabled={r.isLocked}
                              onCheckedChange={(val) => handleToggle(r.id, "freelancerApplicable", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-purple-500/5">
                            <Switch
                              checked={r.freelancerMandatory}
                              disabled={r.isLocked || !r.freelancerApplicable}
                              onCheckedChange={(val) => handleToggle(r.id, "freelancerMandatory", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-purple-500/5">
                            <Switch
                              checked={r.freelancerAffectsScore}
                              disabled={r.isLocked || !r.freelancerApplicable || r.freelancerMandatory}
                              onCheckedChange={(val) => handleToggle(r.id, "freelancerAffectsScore", val)}
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            <Switch
                              checked={r.expiryRequired}
                              onCheckedChange={(val) => handleToggle(r.id, "expiryRequired", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-primary">{r.scoreWeight || 10}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Publish & Impact Preview Modal */}
      <Dialog.Root open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 animate-in fade-in-0 duration-200" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[560px] translate-x-[-50%] translate-y-[-50%] p-6 rounded-2xl border bg-background shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-lg font-bold">Publish Ruleset Version</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                  Publishing will freeze the current configuration into an immutable ruleset version.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="text-muted-foreground hover:text-foreground p-1 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            {previewResult && (
              <div className="my-4 p-4 rounded-xl bg-muted/50 border space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Active Vendors Analyzed:</span>
                  <span className="font-bold text-foreground">{previewResult.totalActiveVendors}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-[10px] text-emerald-600 font-semibold">Score Increased</p>
                    <p className="text-sm font-bold text-emerald-700">+{previewResult.scoreChanges.increasedCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <p className="text-[10px] text-rose-600 font-semibold">Score Decreased</p>
                    <p className="text-sm font-bold text-rose-700">-{previewResult.scoreChanges.decreasedCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-[10px] text-blue-600 font-semibold">To Compliant</p>
                    <p className="text-sm font-bold text-blue-700">+{previewResult.statusTransitions.toCompliant}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 my-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">Change Summary</label>
                <Input
                  placeholder="e.g. Updated tax card requirement weight and grace periods"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="p-3 rounded-xl border flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Apply to Existing Vendors</p>
                  <p className="text-[11px] text-muted-foreground">
                    Update requirement snapshots and recalculate compliance for active vendors.
                  </p>
                </div>
                <Switch checked={applyToExisting} onCheckedChange={setApplyToExisting} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t mt-4">
              <Button variant="ghost" onClick={() => setShowPreviewModal(false)} disabled={publishing}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={publishing} className="gap-2 rounded-xl font-semibold">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Confirm & Publish</span>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
