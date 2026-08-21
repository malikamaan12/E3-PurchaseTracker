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
  Plus,
} from "lucide-react";

interface VendorRuleMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createEmptyRule = () => ({
  name: "",
  description: "",
  section: "document",
  inputType: "document",
  companyApplicable: true,
  companyMandatory: false,
  companyAffectsScore: true,
  freelancerApplicable: false,
  freelancerMandatory: false,
  freelancerAffectsScore: false,
  documentRequired: true,
  expiryRequired: false,
  scoreWeight: 10,
});

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
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [savingNewRule, setSavingNewRule] = useState(false);
  const [newRule, setNewRule] = useState(createEmptyRule);

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

  const handleCreateRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newRule.name.trim()) {
      toast.error("Requirement name is required.");
      return;
    }

    setSavingNewRule(true);
    try {
      const normalizedName = newRule.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "requirement";
      const isDocumentInput = newRule.inputType === "document" || newRule.inputType === "field_and_document";
      const isInformationInput = newRule.inputType !== "document";
      const documentRequired = isDocumentInput || newRule.documentRequired;

      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleKey: `custom_${normalizedName}_${Date.now().toString(36)}`,
          name: newRule.name.trim(),
          description: newRule.description.trim() || null,
          section: newRule.section,
          inputType: newRule.inputType,
          isActive: true,
          companyApplicable: newRule.companyApplicable,
          companyMandatory: newRule.companyApplicable && newRule.companyMandatory,
          companyAffectsScore: newRule.companyApplicable && newRule.companyAffectsScore,
          companyInfoRequired: newRule.companyApplicable && isInformationInput,
          companyDocRequired: newRule.companyApplicable && documentRequired,
          freelancerApplicable: newRule.freelancerApplicable,
          freelancerMandatory: newRule.freelancerApplicable && newRule.freelancerMandatory,
          freelancerAffectsScore: newRule.freelancerApplicable && newRule.freelancerAffectsScore,
          freelancerInfoRequired: newRule.freelancerApplicable && isInformationInput,
          freelancerDocRequired: newRule.freelancerApplicable && documentRequired,
          expiryRequired: documentRequired && newRule.expiryRequired,
          scoreWeight: newRule.scoreWeight,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create requirement");
      }

      toast.success(`${data.rule.name} added to the draft rule matrix.`);
      setNewRule(createEmptyRule());
      setShowAddRuleModal(false);
      await fetchRules();
    } catch (err: any) {
      toast.error(err.message || "Failed to create requirement");
    } finally {
      setSavingNewRule(false);
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 animate-in fade-in-0 duration-200" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-6xl max-h-[94vh] translate-x-[-50%] translate-y-[-50%] p-0 overflow-hidden rounded-2xl border bg-background shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95">
            <div className="p-4 sm:p-6 pb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddRuleModal(true)}
                  className="gap-1.5 text-xs rounded-xl flex-1 sm:flex-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Requirement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateImpact}
                  disabled={simulating || loading}
                  className="gap-1.5 text-xs rounded-xl flex-1 sm:flex-none"
                >
                  {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  Simulate Impact
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowPreviewModal(true)}
                  className="gap-1.5 text-xs rounded-xl shadow-md font-semibold flex-1 sm:flex-none"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish Ruleset
                </Button>
                <Dialog.Close asChild>
                  <button aria-label="Close vendor rule matrix" className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors sm:ml-2 touch-target">
                    <X className="w-4 h-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="p-3 sm:p-6 overflow-y-auto">
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
                              aria-label={`${r.name}: active`}
                              checked={r.isActive}
                              disabled={r.isLocked}
                              onCheckedChange={(val) => handleToggle(r.id, "isActive", val)}
                            />
                          </td>

                          {/* Company Settings */}
                          <td className="py-3 px-3 text-center bg-blue-500/5">
                            <Switch
                              aria-label={`${r.name}: applicable to companies`}
                              checked={r.companyApplicable}
                              disabled={r.isLocked}
                              onCheckedChange={(val) => handleToggle(r.id, "companyApplicable", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-blue-500/5">
                            <Switch
                              aria-label={`${r.name}: mandatory for companies`}
                              checked={r.companyMandatory}
                              disabled={r.isLocked || !r.companyApplicable}
                              onCheckedChange={(val) => handleToggle(r.id, "companyMandatory", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-blue-500/5">
                            <Switch
                              aria-label={`${r.name}: affects company compliance score`}
                              checked={r.companyAffectsScore}
                              disabled={r.isLocked || !r.companyApplicable || r.companyMandatory}
                              onCheckedChange={(val) => handleToggle(r.id, "companyAffectsScore", val)}
                            />
                          </td>

                          {/* Freelancer Settings */}
                          <td className="py-3 px-3 text-center bg-purple-500/5">
                            <Switch
                              aria-label={`${r.name}: applicable to freelancers`}
                              checked={r.freelancerApplicable}
                              disabled={r.isLocked}
                              onCheckedChange={(val) => handleToggle(r.id, "freelancerApplicable", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-purple-500/5">
                            <Switch
                              aria-label={`${r.name}: mandatory for freelancers`}
                              checked={r.freelancerMandatory}
                              disabled={r.isLocked || !r.freelancerApplicable}
                              onCheckedChange={(val) => handleToggle(r.id, "freelancerMandatory", val)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center bg-purple-500/5">
                            <Switch
                              aria-label={`${r.name}: affects freelancer compliance score`}
                              checked={r.freelancerAffectsScore}
                              disabled={r.isLocked || !r.freelancerApplicable || r.freelancerMandatory}
                              onCheckedChange={(val) => handleToggle(r.id, "freelancerAffectsScore", val)}
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            <Switch
                              aria-label={`${r.name}: expiry date required`}
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

      <Dialog.Root open={showAddRuleModal} onOpenChange={setShowAddRuleModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-xs z-[60] animate-in fade-in-0 duration-200" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] p-4 sm:p-6 rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <Dialog.Title className="text-lg font-bold">Add Compliance Requirement</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-1">
                  Create a reusable finance, document, legal, or profile rule. It remains a draft until the ruleset is published.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close add requirement dialog" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted touch-target">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="new-rule-name" className="text-xs font-semibold">Requirement Name</label>
                  <Input
                    id="new-rule-name"
                    required
                    value={newRule.name}
                    onChange={(e) => setNewRule((current) => ({ ...current, name: e.target.value }))}
                    placeholder="e.g. Bank Confirmation Letter"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="new-rule-description" className="text-xs font-semibold">Instructions / Description</label>
                  <Input
                    id="new-rule-description"
                    value={newRule.description}
                    onChange={(e) => setNewRule((current) => ({ ...current, description: e.target.value }))}
                    placeholder="Explain what the vendor should provide"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-rule-section" className="text-xs font-semibold">Section</label>
                  <select
                    id="new-rule-section"
                    value={newRule.section}
                    onChange={(e) => setNewRule((current) => ({ ...current, section: e.target.value }))}
                    className="glass-select min-h-10"
                  >
                    <option value="basic">Basic Details</option>
                    <option value="legal">Legal</option>
                    <option value="finance">Finance</option>
                    <option value="document">Documents</option>
                    <option value="contract">Contract</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-rule-input-type" className="text-xs font-semibold">Response Type</label>
                  <select
                    id="new-rule-input-type"
                    value={newRule.inputType}
                    onChange={(e) => {
                      const inputType = e.target.value;
                      setNewRule((current) => ({
                        ...current,
                        inputType,
                        documentRequired: inputType === "document" || inputType === "field_and_document" ? true : current.documentRequired,
                      }));
                    }}
                    className="glass-select min-h-10"
                  >
                    <option value="document">Document Upload</option>
                    <option value="field_and_document">Field + Document</option>
                    <option value="short_text">Short Text</option>
                    <option value="long_text">Long Text</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="mobile">Mobile Number</option>
                    <option value="checkbox">Yes / No</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RuleAudienceCard
                  title="Companies"
                  applicable={newRule.companyApplicable}
                  mandatory={newRule.companyMandatory}
                  affectsScore={newRule.companyAffectsScore}
                  onChange={(updates) => setNewRule((current) => ({ ...current, ...updates }))}
                  prefix="company"
                />
                <RuleAudienceCard
                  title="Freelancers"
                  applicable={newRule.freelancerApplicable}
                  mandatory={newRule.freelancerMandatory}
                  affectsScore={newRule.freelancerAffectsScore}
                  onChange={(updates) => setNewRule((current) => ({ ...current, ...updates }))}
                  prefix="freelancer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border bg-muted/20">
                <ToggleSetting
                  label="Document Required"
                  checked={newRule.documentRequired}
                  disabled={newRule.inputType === "document" || newRule.inputType === "field_and_document"}
                  onCheckedChange={(checked) => setNewRule((current) => ({ ...current, documentRequired: checked, expiryRequired: checked ? current.expiryRequired : false }))}
                />
                <ToggleSetting
                  label="Expiry Date Required"
                  checked={newRule.expiryRequired}
                  disabled={!newRule.documentRequired}
                  onCheckedChange={(checked) => setNewRule((current) => ({ ...current, expiryRequired: checked }))}
                />
                <div className="space-y-1.5">
                  <label htmlFor="new-rule-score-weight" className="text-xs font-semibold">Score Weight (1–100)</label>
                  <Input
                    id="new-rule-score-weight"
                    type="number"
                    min={1}
                    max={100}
                    value={newRule.scoreWeight}
                    onChange={(e) => setNewRule((current) => ({ ...current, scoreWeight: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setShowAddRuleModal(false)} disabled={savingNewRule}>Cancel</Button>
                <Button type="submit" disabled={savingNewRule} className="gap-2">
                  {savingNewRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to Draft Matrix
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Publish & Impact Preview Modal */}
      <Dialog.Root open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 animate-in fade-in-0 duration-200" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-[560px] max-h-[90vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] p-4 sm:p-6 rounded-2xl border bg-background shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-lg font-bold">Publish Ruleset Version</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                  Publishing will freeze the current configuration into an immutable ruleset version.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button aria-label="Close publish ruleset dialog" className="text-muted-foreground hover:text-foreground p-2 rounded-lg touch-target">
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
                <label htmlFor="ruleset-change-summary" className="text-xs font-semibold block">Change Summary</label>
                <Input
                  id="ruleset-change-summary"
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
                <Switch aria-label="Apply ruleset to existing vendors" checked={applyToExisting} onCheckedChange={setApplyToExisting} />
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

function RuleAudienceCard({
  title,
  applicable,
  mandatory,
  affectsScore,
  onChange,
  prefix,
}: {
  title: string;
  applicable: boolean;
  mandatory: boolean;
  affectsScore: boolean;
  onChange: (updates: Record<string, boolean>) => void;
  prefix: "company" | "freelancer";
}) {
  const field = (suffix: string) => `${prefix}${suffix}`;
  return (
    <fieldset className="rounded-xl border p-4 space-y-3">
      <legend className="px-1 text-sm font-bold">{title}</legend>
      <ToggleSetting
        label="Applicable"
        checked={applicable}
        onCheckedChange={(checked) => onChange({
          [field("Applicable")]: checked,
          ...(!checked ? { [field("Mandatory")]: false, [field("AffectsScore")]: false } : {}),
        })}
      />
      <ToggleSetting
        label="Mandatory"
        checked={mandatory}
        disabled={!applicable}
        onCheckedChange={(checked) => onChange({
          [field("Mandatory")]: checked,
          ...(checked ? { [field("AffectsScore")]: true } : {}),
        })}
      />
      <ToggleSetting
        label="Affects Compliance Score"
        checked={affectsScore}
        disabled={!applicable || mandatory}
        onCheckedChange={(checked) => onChange({ [field("AffectsScore")]: checked })}
      />
    </fieldset>
  );
}

function ToggleSetting({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-9">
      <span className="text-xs font-medium">{label}</span>
      <Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
