"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  Building2,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Copy,
  AlertTriangle,
  FileCheck,
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface VendorInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VendorInviteModal({ isOpen, onClose, onSuccess }: VendorInviteModalProps) {
  const [mounted, setMounted] = useState(false);
  const [vendorType, setVendorType] = useState<"company" | "freelancer">("company");

  useEffect(() => {
    setMounted(true);
  }, []);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [category, setCategory] = useState("general");
  const [currency, setCurrency] = useState("QAR");
  const [notes, setNotes] = useState("");

  const COMPANY_CHECKLIST = [
    { type: "Commercial Registration", mandatory: true, description: "Official CR with valid expiry" },
    { type: "Tax Certificate", mandatory: false, description: "Optional tax / VAT identification certificate" },
    { type: "Establishment Card", mandatory: false, description: "Computer card / Municipality license" },
  ];

  const FREELANCER_CHECKLIST = [
    { type: "Qatar ID (QID) / Passport", mandatory: true, description: "Valid personal identity document" },
    { type: "Freelance Permit / Tax Card", mandatory: false, description: "Optional freelance work license or tax ID" },
    { type: "Bank Account Confirmation", mandatory: false, description: "Optional bank confirmation (not required for cash/cheque payments)" },
  ];

  const [documentChecklist, setDocumentChecklist] = useState(COMPANY_CHECKLIST);
  const [customDocName, setCustomDocName] = useState("");

  const handleVendorTypeChange = (type: "company" | "freelancer") => {
    setVendorType(type);
    setDocumentChecklist(type === "freelancer" ? FREELANCER_CHECKLIST : COMPANY_CHECKLIST);
  };

  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Debounced duplicate check
  useEffect(() => {
    if (!companyName && !email && !contactNumber) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingDuplicates(true);
        const res = await fetch("/api/vendors/check-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName, email, contactNumber }),
        });
        const data = await res.json();
        if (data.hasDuplicate) {
          setDuplicateWarning(data);
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.error("Duplicate check failed:", err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [companyName, email, contactNumber]);

  const handleAddCustomDoc = () => {
    if (!customDocName.trim()) return;
    setDocumentChecklist((prev) => [
      ...prev,
      { type: customDocName.trim(), mandatory: false, description: "Custom compliance requirement" },
    ]);
    setCustomDocName("");
  };

  const handleRemoveDoc = (index: number) => {
    setDocumentChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleMandatory = (index: number) => {
    setDocumentChecklist((prev) =>
      prev.map((doc, i) => (i === index ? { ...doc, mandatory: !doc.mandatory } : doc))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateWarning?.hasDuplicate && !overrideDuplicate) {
      setErrorMessage("Please review the duplicate supplier warning or confirm the override exception.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await fetch("/api/vendors/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactPerson,
          email,
          contactNumber,
          vendorType,
          category,
          payment_currency: currency,
          requiredDocumentTypes: documentChecklist,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate onboarding invitation.");
      }

      setCreatedResult(data);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create vendor draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdResult?.invitationUrl) return;
    navigator.clipboard.writeText(createdResult.invitationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const resetModal = () => {
    setCompanyName("");
    setContactPerson("");
    setEmail("");
    setContactNumber("");
    setNotes("");
    setDuplicateWarning(null);
    setOverrideDuplicate(false);
    setCreatedResult(null);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Invite Vendor (Self-Service)</h2>
              <p className="text-xs text-muted-foreground">Generate a secure 7-day self-service onboarding link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetModal}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {createdResult ? (
            /* Success View with Copy Link */
            <div className="space-y-6 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">Invitation Link Ready</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  A secure 7-day self-service link has been created for{" "}
                  <strong className="text-foreground font-semibold">{companyName}</strong>.
                </p>
              </div>

              {/* Link Box */}
              <div className="bg-secondary/40 border border-border rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Encrypted Invitation URL
                  </span>
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                    <Clock className="w-3 h-3" /> Valid for 24 Hours
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdResult.invitationUrl}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors min-h-[38px] shadow-sm"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline mr-1" />
                  For security, the raw token is only displayed here and will not appear in server logs or database records.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={createdResult.mailtoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px] border border-border shadow-sm"
                >
                  <Mail className="w-4 h-4 text-primary" />
                  <span>Send via Email Client</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>

                <button
                  type="button"
                  onClick={resetModal}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors min-h-[44px] shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Duplicate Warning */}
              {duplicateWarning?.hasDuplicate && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300">Potential Duplicate Vendor Detected</h4>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 mt-0.5 leading-snug">
                        Matching records were found in the database. Please review before proceeding:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
                    {duplicateWarning.matches.map((m: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-card border border-amber-500/20 rounded-lg p-2 flex items-center justify-between text-[11px]"
                      >
                        <span className="font-medium text-foreground">{m.name}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-mono font-semibold">
                          Matched via {m.matchedField} ({m.type})
                        </span>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 pt-1 border-t border-amber-500/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideDuplicate}
                      onChange={(e) => setOverrideDuplicate(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border text-amber-600 focus:ring-amber-500 bg-background"
                    />
                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                      Authorized exception: Proceed with creating this invitation anyway.
                    </span>
                  </label>
                </div>
              )}

              {/* Vendor Classification Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Vendor Classification*
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleVendorTypeChange("company")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      vendorType === "company"
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>Company / Entity</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVendorTypeChange("freelancer")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      vendorType === "freelancer"
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <User className="w-4 h-4 text-primary" />
                    <span>Freelancer / Individual</span>
                  </button>
                </div>
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    {vendorType === "freelancer" ? <User className="w-3.5 h-3.5 text-primary" /> : <Building2 className="w-3.5 h-3.5 text-primary" />}
                    <span>{vendorType === "freelancer" ? "Freelancer Full Name / Trade Name*" : "Company Name*"}</span>
                    {isCheckingDuplicates && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={vendorType === "freelancer" ? "e.g. John Doe (Freelance Audio Engineer)" : "e.g. Al-Sulaiti Engineering Services"}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Contact Person*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Ahmed Al-Sulaiti"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>Contact Email*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. info@alsulaiti.qa"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>Contact Phone*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. +974 4400 1234"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Currency*</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  >
                    <option value="QAR">QAR - Qatari Riyal</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                  </select>
                </div>
              </div>

              {/* Required Documents Checklist */}
              <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-primary" />
                    <span>Required Compliance Checklist</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">Configure mandatory documents</span>
                </div>

                <div className="space-y-2">
                  {documentChecklist.map((doc, idx) => (
                    <div
                      key={idx}
                      className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-medium text-foreground">{doc.type}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={doc.mandatory}
                            onChange={() => handleToggleMandatory(idx)}
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
                    placeholder="Add custom document requirement..."
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDoc}
                    className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium flex items-center gap-1 shrink-0 border border-border shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Internal Notes / Instructions (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Special onboarding instructions or project context..."
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-2 shadow-md shadow-primary/20 transition-all min-h-[44px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Generate 7-Day Invitation Link</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
