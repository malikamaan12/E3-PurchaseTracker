"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import {
  X,
  Send,
  ShieldCheck,
  Building2,
  User,
  Clock,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ExternalLink,
  Plus,
  Trash2,
  Loader2,
  Check,
  RotateCcw,
  Ban,
  FileCheck,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";

interface VendorRequestUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: {
    id: number;
    companyName: string;
    contactPerson?: string | null;
    email?: string | null;
    contactNumber?: string | null;
    vendorType?: string | null;
    complianceStatus?: string | null;
  } | null;
}

const FIELD_OPTIONS = [
  { id: "companyName", label: "Company / Trade Name" },
  { id: "contactPerson", label: "Contact Person / Reference" },
  { id: "email", label: "Email Address" },
  { id: "contactNumber", label: "Contact Phone Number" },
  { id: "address", label: "Address / Headquarters" },
  { id: "bankName", label: "Bank Name" },
  { id: "branchName", label: "Branch Name" },
  { id: "accountNumber", label: "Bank Account Number" },
  { id: "ibanNumber", label: "IBAN" },
  { id: "taxNumber", label: "Tax / VAT ID" },
  { id: "registrationNumber", label: "CR / Registration Number" },
];

export function VendorRequestUpdateModal({
  isOpen,
  onClose,
  vendor,
}: VendorRequestUpdateModalProps) {
  const queryClient = useQueryClient();
  const isFreelancer = vendor?.vendorType === "freelancer";

  const [allowedFields, setAllowedFields] = useState<string[]>([
    "contactPerson",
    "email",
    "contactNumber",
    "bankName",
    "branchName",
    "accountNumber",
    "ibanNumber",
  ]);

  const defaultDocs = isFreelancer
    ? [
        { type: "Qatar ID (QID) / Passport", mandatory: false, description: "Personal ID copy" },
        { type: "Freelance Permit / Tax Card", mandatory: false, description: "Freelance license or tax card" },
      ]
    : [
        { type: "Commercial Registration", mandatory: true, description: "Official CR with valid expiry" },
        { type: "Tax Certificate", mandatory: true, description: "Tax identification card" },
        { type: "Establishment Card", mandatory: false, description: "Computer card" },
      ];

  const [documentChecklist, setDocumentChecklist] = useState<Array<{ type: string; mandatory: boolean; description?: string }>>(defaultDocs);
  const [customDocName, setCustomDocName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(1); // Default 24h
  const [reason, setReason] = useState("annual_review");

  const [generatedResult, setGeneratedResult] = useState<{
    portalUrl: string;
    mailtoUrl: string;
    expiresAt: string;
    caseNumber?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [countdownText, setCountdownText] = useState("");

  // Sync default documents if vendor changes
  useEffect(() => {
    if (vendor) {
      const docs = vendor.vendorType === "freelancer"
        ? [
            { type: "Qatar ID (QID) / Passport", mandatory: false, description: "Personal ID copy" },
            { type: "Freelance Permit / Tax Card", mandatory: false, description: "Freelance license or tax card" },
          ]
        : [
            { type: "Commercial Registration", mandatory: true, description: "Official CR with valid expiry" },
            { type: "Tax Certificate", mandatory: true, description: "Tax identification card" },
            { type: "Establishment Card", mandatory: false, description: "Computer card" },
          ];
      setDocumentChecklist(docs);
      setGeneratedResult(null);
      setInstructions("");
    }
  }, [vendor]);

  // Live countdown timer for generated link
  useEffect(() => {
    if (!generatedResult?.expiresAt) return;

    const updateTimer = () => {
      const diffMs = new Date(generatedResult.expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdownText("Expired");
        return;
      }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      setCountdownText(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [generatedResult?.expiresAt]);

  const generateMutation = useMutation({
    mutationFn: (payload: any) => apiClient.vendors.createComplianceCase(vendor!.id, payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendor?.id] });
      queryClient.invalidateQueries({ queryKey: ["vendor_compliance_cases", vendor?.id] });
      toast.success(res.message || "24-hour update link generated successfully.");
      setGeneratedResult({
        portalUrl: res.portalUrl,
        mailtoUrl: res.mailtoUrl,
        expiresAt: res.expiresAt,
        caseNumber: res.case?.caseNumber,
      });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate update link.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => apiClient.vendors.revokeComplianceCase(vendor!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendor?.id] });
      queryClient.invalidateQueries({ queryKey: ["vendor_compliance_cases", vendor?.id] });
      toast.success("Active update link has been revoked.");
      setGeneratedResult(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke update link.");
    },
  });

  if (!isOpen || !vendor) return null;

  const handleToggleField = (fieldId: string) => {
    setAllowedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((f) => f !== fieldId) : [...prev, fieldId]
    );
  };

  const handleSelectAllFields = () => {
    setAllowedFields(FIELD_OPTIONS.map((f) => f.id));
  };

  const handleDeselectAllFields = () => {
    setAllowedFields([]);
  };

  const handleToggleMandatoryDoc = (idx: number) => {
    setDocumentChecklist((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, mandatory: !d.mandatory } : d))
    );
  };

  const handleRemoveDoc = (idx: number) => {
    setDocumentChecklist((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddCustomDoc = () => {
    if (!customDocName.trim()) return;
    setDocumentChecklist((prev) => [
      ...prev,
      { type: customDocName.trim(), mandatory: false, description: "Custom compliance requirement" },
    ]);
    setCustomDocName("");
  };

  const handleGenerate = (forceNew = false) => {
    generateMutation.mutate({
      reason,
      deadlineDays,
      requiredDocuments: documentChecklist,
      allowedFields,
      instructions: instructions.trim() || undefined,
      forceNew,
    });
  };

  const handleCopyLink = () => {
    if (!generatedResult?.portalUrl) return;
    navigator.clipboard.writeText(generatedResult.portalUrl);
    setCopied(true);
    toast.success("Update link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Request Vendor Update</h3>
              <p className="text-xs text-muted-foreground">
                Issue a secure 24-hour scoped portal link for <span className="font-semibold text-foreground">{vendor.companyName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {generatedResult ? (
            /* Post-generation screen */
            <div className="space-y-6 py-2">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-foreground">Secure 24-Hour Update Link Ready</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {vendor.companyName} can now access their scoped self-service portal to update selected fields and upload compliance documents.
                </p>
              </div>

              {/* Link Box */}
              <div className="bg-secondary/40 border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Encrypted Scoped Link</span>
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires in {countdownText || "24 Hours"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedResult.portalUrl}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-sm min-h-[42px]"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied!" : "Copy Link"}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span>Target: {vendor.email || "No email registered"}</span>
                  {generatedResult.caseNumber && (
                    <span className="font-mono font-semibold">Ref: #{generatedResult.caseNumber}</span>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate()}
                    disabled={revokeMutation.isPending}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                  >
                    {revokeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    <span>Revoke Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={generateMutation.isPending}
                    className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                  >
                    {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Generate New Link</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={generatedResult.mailtoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 border border-border shadow-sm min-h-[44px]"
                  >
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Share by Email</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all min-h-[44px] shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Scoped Update Configuration Form */
            <div className="space-y-6">
              {/* Reason & Grace Period Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Update Purpose / Context*
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary min-h-[44px]"
                  >
                    <option value="annual_review">Annual Compliance Refresh</option>
                    <option value="information_update">Profile & Information Update</option>
                    <option value="document_renewal">Expired Document Replacement</option>
                    <option value="banking_update">Banking & IBAN Change</option>
                    <option value="audit_rectification">Audit Finding Rectification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Link Validity Period*
                  </label>
                  <select
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary min-h-[44px]"
                  >
                    <option value={1}>24 Hours (Standard Fast-Track)</option>
                    <option value={7}>7 Days (1 Week)</option>
                    <option value={15}>15 Days (Standard Compliance Grace)</option>
                    <option value={30}>30 Days (Extended Review)</option>
                  </select>
                </div>
              </div>

              {/* Editable Fields Selection */}
              <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-foreground block">
                      1. Editable Fields Authorization ({allowedFields.length} selected)
                    </label>
                    <p className="text-[11px] text-muted-foreground">Select which profile fields the vendor is permitted to edit</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFields}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllFields}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {FIELD_OPTIONS.map((field) => {
                    const isChecked = allowedFields.includes(field.id);
                    return (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => handleToggleField(field.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs text-left transition-all ${
                          isChecked
                            ? "bg-card border-primary/40 text-foreground font-medium shadow-sm"
                            : "bg-background/50 border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{field.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Required Documents Selection */}
              <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-primary" />
                      <span>2. Required Compliance Documents ({documentChecklist.length})</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">Specify mandatory vs optional file uploads</p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {documentChecklist.map((doc, idx) => (
                    <div
                      key={idx}
                      className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs shadow-sm"
                    >
                      <span className="font-medium text-foreground truncate">{doc.type}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={doc.mandatory}
                            onChange={() => handleToggleMandatoryDoc(idx)}
                            className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary bg-background"
                          />
                          <span className={doc.mandatory ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}>
                            {doc.mandatory ? "Mandatory" : "Optional"}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(idx)}
                          className="text-muted-foreground hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                    placeholder="Add custom certificate or license requirement..."
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDoc}
                    className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1 shrink-0 border border-border shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Instructions to Vendor */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Instructions for Vendor (Visible in Portal)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please update your expired Commercial Registration and confirm your IBAN."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerate(false)}
                  disabled={generateMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20 transition-all min-h-[44px]"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Generate Secure 24-Hour Link</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
