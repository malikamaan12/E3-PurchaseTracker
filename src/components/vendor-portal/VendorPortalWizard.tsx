"use client";

import { useState } from "react";
import {
  Building2,
  Landmark,
  FileCheck,
  Check,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Mail,
  Phone,
  User,
  Globe,
  Hash,
} from "lucide-react";
import { VendorPortalDocumentGateway } from "./VendorPortalDocumentGateway";

interface VendorPortalWizardProps {
  initialDraft: any;
  requiredDocumentTypes: any[];
  initialDocuments: any[];
  onboardingStatus: string;
  onboardingNotes?: string | null;
  isReadOnly: boolean;
  onSubmitSuccess: () => void;
}

export function VendorPortalWizard({
  initialDraft,
  requiredDocumentTypes,
  initialDocuments,
  onboardingStatus,
  onboardingNotes,
  isReadOnly,
  onSubmitSuccess,
}: VendorPortalWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState({
    companyName: initialDraft?.companyName || "",
    contactPerson: initialDraft?.contactPerson || "",
    email: initialDraft?.email || "",
    contactNumber: initialDraft?.contactNumber || "",
    address: initialDraft?.address || "",
    taxNumber: initialDraft?.taxNumber || "",
    registrationNumber: initialDraft?.registrationNumber || "",
    bankName: initialDraft?.bankName || "",
    branchName: initialDraft?.branchName || "",
    accountNumber: initialDraft?.accountNumber || "",
    ibanNumber: initialDraft?.ibanNumber || "",
    payment_currency: initialDraft?.payment_currency || "QAR",
  });
  const [documents, setDocuments] = useState<any[]>(initialDocuments);
  const [version, setVersion] = useState<number>(initialDraft?.version || 1);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState<boolean>(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveMessage(null);
  };

  const handleSaveProgress = async () => {
    if (isReadOnly) return;
    try {
      setIsSaving(true);
      setSaveMessage(null);

      const res = await fetch("/api/vendor-onboarding/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          version,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save draft progress.");
      }

      setVersion(data.data.version);
      setSaveMessage({ text: "Progress saved successfully. You can resume at any time.", type: "success" });
    } catch (err: any) {
      setSaveMessage({ text: err.message || "Failed to save progress.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;
    if (!declarationAccepted) {
      setSubmitError("Please confirm the declaration certifying that all provided details and documents are authentic.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const res = await fetch("/api/vendor-onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          version,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit profile.");
      }

      onSubmitSuccess();
    } catch (err: any) {
      setSubmitError(err.message || "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: "Organization Profile", icon: Building2 },
    { num: 2, label: "Banking & Financials", icon: Landmark },
    { num: 3, label: "Compliance Documents", icon: FileCheck },
    { num: 4, label: "Review & Submit", icon: Check },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Correction Notice Banner */}
      {onboardingStatus === "changes_requested" && onboardingNotes && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-5 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-white">Corrections Requested by E3 Procurement</h3>
              <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">{onboardingNotes}</p>
              <p className="text-[11px] text-amber-400/80 mt-2">
                Please update the requested information or upload the missing documents below and resubmit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step Indicators */}
      <nav aria-label="Onboarding Progress" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all min-h-[44px] ${
                  isCurrent
                    ? "bg-primary/20 border border-primary/40 text-white"
                    : isCompleted
                    ? "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                    : "bg-transparent text-slate-500 hover:text-slate-400"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCurrent
                      ? "bg-primary text-white"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-mono tracking-wider opacity-60">Step 0{s.num}</p>
                  <p className="text-xs font-semibold truncate">{s.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Save Notification */}
      {saveMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            saveMessage.type === "success"
              ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-300"
              : "bg-rose-950/40 border border-rose-800/80 text-rose-300"
          }`}
        >
          {saveMessage.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* Step 1: Organization Profile */}
      {step === 1 && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Organization Profile</h2>
            <p className="text-xs text-slate-400 mt-1">
              Verify your official legal business name and primary contact details.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>Legal Company Name*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. Acme Contracting W.L.L."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Primary Contact Person*</span>
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => handleInputChange("contactPerson", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>Official Business Email*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="accounts@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>Contact Phone Number*</span>
              </label>
              <input
                type="text"
                value={formData.contactNumber}
                onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="+974 4400 0000"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span>Headquarters / Office Address*</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="Street Address, Building, City, Country"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span>Commercial Registration (CR) Number</span>
              </label>
              <input
                type="text"
                value={formData.registrationNumber}
                onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. 123456"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span>Tax Identification Number (TIN / VAT)</span>
              </label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={(e) => handleInputChange("taxNumber", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. QA-TAX-987654"
              />
            </div>
          </div>
        </section>
      )}

      {/* Step 2: Banking & Financials */}
      {step === 2 && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Banking & Payment Details</h2>
            <p className="text-xs text-slate-400 mt-1">
              Provide the official bank account credentials for electronic payment transfers and settlements.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-primary" />
                <span>Bank Name*</span>
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => handleInputChange("bankName", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. Qatar National Bank (QNB)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-primary" />
                <span>Branch Name*</span>
              </label>
              <input
                type="text"
                value={formData.branchName}
                onChange={(e) => handleInputChange("branchName", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. Main Branch, Doha"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>Account Number*</span>
              </label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. 0013-123456-001"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>IBAN Number*</span>
              </label>
              <input
                type="text"
                value={formData.ibanNumber}
                onChange={(e) => handleInputChange("ibanNumber", e.target.value.toUpperCase())}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                placeholder="e.g. QA58QNBA00000000123456"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Payment Currency*</label>
              <select
                value={formData.payment_currency}
                onChange={(e) => handleInputChange("payment_currency", e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
              >
                <option value="QAR">QAR - Qatari Riyal</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="CNY">CNY - Chinese Yuan</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Step 3: Compliance Documents */}
      {step === 3 && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Compliance Documents</h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload required legal certifications and establishment records. Direct encrypted upload to cloud storage.
            </p>
          </div>

          <VendorPortalDocumentGateway
            requiredDocumentTypes={requiredDocumentTypes}
            documents={documents}
            isReadOnly={isReadOnly}
            onDocumentAdded={(newDoc) => setDocuments((prev) => [newDoc, ...prev])}
            onDocumentRemoved={(docId) => setDocuments((prev) => prev.filter((d) => d.id !== docId))}
          />
        </section>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Review & Final Submission</h2>
            <p className="text-xs text-slate-400 mt-1">
              Carefully review all details before submitting. Once submitted, your profile will be locked for administrative verification.
            </p>
          </div>

          {submitError && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Profile Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Company Name</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formData.companyName || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Contact Person</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formData.contactPerson || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Email Address</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formData.email || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Phone Number</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formData.contactNumber || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Headquarters Address</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formData.address || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Bank Name & Branch</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                {formData.bankName} {formData.branchName ? `(${formData.branchName})` : ""}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">IBAN Number</p>
              <p className="text-sm font-mono font-semibold text-white mt-0.5">{formData.ibanNumber || "—"}</p>
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-slate-800">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">
                Uploaded Compliance Files ({documents.length})
              </p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {documents.map((d) => (
                  <span
                    key={d.id}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700"
                  >
                    {d.documentName} ({d.documentType})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Declaration Checkbox */}
          {!isReadOnly && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-700 text-primary focus:ring-primary bg-slate-900"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  I hereby declare that all submitted company information, banking credentials, and uploaded compliance documentation are accurate, current, and authorized for electronic payment and business registration with E3.
                </span>
              </label>
            </div>
          )}
        </section>
      )}

      {/* Navigation & Action Bar */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((prev) => prev - 1)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          )}

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveProgress}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-primary" />}
              <span>Save Progress</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => prev + 1)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 transition-all min-h-[44px]"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            !isReadOnly && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !declarationAccepted}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all min-h-[44px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Submit Profile for Verification</span>
              </button>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
