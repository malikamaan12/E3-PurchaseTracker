"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import {
  X, ShieldCheck, ShieldAlert, Clock, Plus, ExternalLink,
  Copy, CheckCircle2, AlertCircle, FileText, Send, Calendar,
  Loader2, Check
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/utils";

interface VendorComplianceCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: number;
  vendorName: string;
  vendorType?: string;
  isSuperAdmin?: boolean;
}

export function VendorComplianceCasesModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  vendorType = "company",
  isSuperAdmin,
}: VendorComplianceCasesModalProps) {
  const queryClient = useQueryClient();
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [reason, setReason] = useState("annual_review");
  const [deadlineDays, setDeadlineDays] = useState(15);
  const [instructions, setInstructions] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>(
    vendorType === "freelancer" ? [] : ["CR", "TAX_CARD", "ESTABLISHMENT_ID"]
  );
  const [generatedPortalLink, setGeneratedPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: casesData, isLoading } = useQuery({
    queryKey: ["vendor_compliance_cases", vendorId],
    queryFn: () => apiClient.vendors.listComplianceCases(vendorId),
    enabled: isOpen && !!vendorId,
  });

  const createCaseMutation = useMutation({
    mutationFn: (payload: any) => apiClient.vendors.createComplianceCase(vendorId, payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["vendor_compliance_cases", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      toast.success(res.message || "Compliance case opened successfully.");
      if (res.portalUrl) {
        setGeneratedPortalLink(res.portalUrl);
      } else {
        setIsCreatingCase(false);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to open compliance case.");
    },
  });

  if (!isOpen) return null;

  const cases = casesData?.cases || [];
  const activeCase = cases.find((c: any) => c.status === "open" || c.status === "under_review");

  const docOptions = vendorType === "freelancer"
    ? [
        { id: "QID", label: "Qatar ID (QID) / Passport Copy" },
        { id: "FREELANCE_PERMIT", label: "Freelance Permit / Tax Card" },
        { id: "BANK_CONFIRMATION", label: "Bank Account Letter (Individual Legal Name)" },
        { id: "WORK_CONTRACT", label: "Signed Engagement / Work Contract" },
      ]
    : [
        { id: "CR", label: "Commercial Registration (CR)" },
        { id: "TAX_CARD", label: "Tax Identification Card" },
        { id: "ESTABLISHMENT_ID", label: "Computer Card / Establishment ID" },
        { id: "TRADE_LICENSE", label: "Baladiya Trade License" },
        { id: "BANK_LETTER", label: "Official Bank Account Confirmation Letter" },
      ];

  const handleToggleDoc = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const handleCopyLink = () => {
    if (!generatedPortalLink) return;
    navigator.clipboard.writeText(generatedPortalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Compliance Review Cases</h3>
              <p className="text-xs text-muted-foreground">{vendorName} ({vendorType === "freelancer" ? "Freelancer" : "Company"})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {generatedPortalLink ? (
            /* Success Link Box */
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">Case-Scoped Portal Link Generated</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Provide this secure link to the vendor to upload the requested compliance documents:
                </p>
              </div>

              <div className="bg-background border border-border rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedPortalLink}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setGeneratedPortalLink(null);
                  setIsCreatingCase(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs"
              >
                Done
              </button>
            </div>
          ) : isCreatingCase ? (
            /* Create Case Form */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-foreground">Open Compliance Review Cycle</h4>
                <button
                  type="button"
                  onClick={() => setIsCreatingCase(false)}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Audit Reason*
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="annual_review">Annual Compliance Review</option>
                    <option value="document_expiry">Document Expiry Renewal</option>
                    <option value="manual_audit">Targeted Risk / Quality Audit</option>
                    <option value="banking_update">Banking & Payment Re-Verification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Submission Deadline (Days)*
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Required Compliance Documents*
                  </label>
                  <div className="space-y-2">
                    {docOptions.map((doc) => (
                      <label
                        key={doc.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedDocs.includes(doc.id)
                            ? "bg-primary/5 border-primary text-foreground font-medium"
                            : "bg-background border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.id)}
                          onChange={() => handleToggleDoc(doc.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="text-xs">{doc.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Please provide attested copy of renewed Commercial Registration..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCase(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createCaseMutation.isPending || selectedDocs.length === 0}
                  onClick={() =>
                    createCaseMutation.mutate({
                      reason,
                      deadlineDays,
                      requiredDocuments: selectedDocs,
                      instructions: instructions.trim() || undefined,
                    })
                  }
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {createCaseMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Open Case & Generate Link</span>
                </button>
              </div>
            </div>
          ) : (
            /* Cases List */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-foreground">Compliance Lifecycle History</h4>
                {!activeCase && (
                  <button
                    onClick={() => setIsCreatingCase(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Open New Case</span>
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-xs font-medium">Loading compliance cases...</p>
                </div>
              ) : cases.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <ShieldAlert className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-xs font-bold text-foreground">No Compliance Cases Recorded</p>
                  <p className="text-[11px] mt-1 max-w-sm">
                    Open a compliance review case to request updated documentation and issue a single-use portal submission token.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cases.map((c: any) => {
                    const isOpen = c.status === "open" || c.status === "under_review";
                    const isCompliant = c.status === "resolved_compliant";
                    const isExpired = c.status === "expired_non_compliant";

                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isOpen
                            ? "bg-primary/5 border-primary/30 shadow-sm"
                            : isCompliant
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : isExpired
                            ? "bg-destructive/5 border-destructive/20"
                            : "bg-muted/20 border-border/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-foreground">
                                {c.caseNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isOpen
                                    ? "bg-primary/10 text-primary"
                                    : isCompliant
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : isExpired
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {c.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-xs font-semibold capitalize mt-1 text-foreground/90">
                              {c.reason?.replace(/_/g, " ")}
                            </p>
                          </div>

                          <div className="text-right text-[11px] text-muted-foreground">
                            <span className="font-mono flex items-center gap-1 justify-end">
                              <Calendar className="w-3 h-3" />
                              Deadline: {safeFormatDate(c.deadline, "MMM dd, yyyy")}
                            </span>
                          </div>
                        </div>

                        {c.instructions && (
                          <p className="text-xs text-muted-foreground mt-2 bg-background/60 p-2.5 rounded-xl border border-border/40">
                            {c.instructions}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                          <span>
                            Opened: {safeFormatDate(c.openedAt, "MMM dd, yyyy")}
                          </span>
                          <span>
                            Required: {Array.isArray(c.requiredDocuments) ? c.requiredDocuments.length : 0} Document(s)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
