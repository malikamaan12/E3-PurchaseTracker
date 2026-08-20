"use client";

import { useState, useEffect, useRef } from "react";
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
  CreditCard,
  Banknote,
  DollarSign,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";

interface VendorInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialVendorType?: "company" | "freelancer";
}

interface FieldErrors {
  companyName?: string;
  contactPerson?: string;
  email?: string;
  contactNumber?: string;
  currency?: string;
  paymentMethod?: string;
  qidPassport?: string;
}

export function VendorInviteModal({
  isOpen,
  onClose,
  onSuccess,
  initialVendorType = "company",
}: VendorInviteModalProps) {
  const [vendorType, setVendorType] = useState<"company" | "freelancer">(initialVendorType);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [category, setCategory] = useState("general");
  const [currency, setCurrency] = useState("QAR");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cheque" | "cash">("bank_transfer");
  const [qidPassport, setQidPassport] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Input element refs for smooth scroll & focus on validation failure
  const companyNameRef = useRef<HTMLInputElement>(null);
  const contactPersonRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const contactNumberRef = useRef<HTMLInputElement>(null);
  const currencyRef = useRef<HTMLSelectElement>(null);
  const paymentMethodRef = useRef<HTMLSelectElement>(null);
  const qidPassportRef = useRef<HTMLInputElement>(null);

  const COMPANY_CHECKLIST = [
    { type: "Commercial Registration", mandatory: true, description: "Official CR with valid expiry" },
    { type: "Tax Certificate", mandatory: true, description: "Tax / VAT identification certificate" },
    { type: "Establishment Card", mandatory: false, description: "Computer card / Municipality license" },
  ];

  const FREELANCER_CHECKLIST = [
    { type: "Qatar ID (QID) / Passport", mandatory: false, description: "Valid personal identity document (when requested)" },
    { type: "Freelance Permit / Tax Card", mandatory: false, description: "Freelance work license or tax ID (when requested)" },
  ];

  const [documentChecklist, setDocumentChecklist] = useState(
    initialVendorType === "freelancer" ? FREELANCER_CHECKLIST : COMPANY_CHECKLIST
  );
  const [customDocName, setCustomDocName] = useState("");

  // Sync initial type when opened
  useEffect(() => {
    if (isOpen) {
      setVendorType(initialVendorType);
      setDocumentChecklist(initialVendorType === "freelancer" ? FREELANCER_CHECKLIST : COMPANY_CHECKLIST);
      setPaymentMethod(initialVendorType === "freelancer" ? "cash" : "bank_transfer");
      setFieldErrors({});
    }
  }, [isOpen, initialVendorType]);

  const handleVendorTypeChange = (type: "company" | "freelancer") => {
    setVendorType(type);
    setDocumentChecklist(type === "freelancer" ? FREELANCER_CHECKLIST : COMPANY_CHECKLIST);
    if (type === "freelancer" && paymentMethod === "bank_transfer") {
      setPaymentMethod("cash");
    }
    setFieldErrors({});
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

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    let firstInvalidRef: React.RefObject<HTMLInputElement | HTMLSelectElement | null> | null = null;

    // Full name / Company name validation
    if (!companyName || companyName.trim().length < 2) {
      errors.companyName = vendorType === "freelancer" ? "Please enter the freelancer's full legal name." : "Please enter the registered company name.";
      if (!firstInvalidRef) firstInvalidRef = companyNameRef;
    }

    // Contact person / reference validation
    if (!contactPerson || contactPerson.trim().length < 2) {
      errors.contactPerson = vendorType === "freelancer" ? "Internal contact reference or sponsor is required." : "Contact person name is required.";
      if (!firstInvalidRef) firstInvalidRef = contactPersonRef;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      errors.email = "Please provide a valid email address (e.g. name@domain.qa).";
      if (!firstInvalidRef) firstInvalidRef = emailRef;
    }

    // Contact number validation (Qatar or international format)
    const phoneRegex = /^[+]?[\d\s-]{8,15}$/;
    if (!contactNumber || !phoneRegex.test(contactNumber.trim())) {
      errors.contactNumber = "Please provide a valid contact number (8 to 15 digits, e.g. +974 5500 1234).";
      if (!firstInvalidRef) firstInvalidRef = contactNumberRef;
    }

    // QID / Passport validation if supplied
    if (qidPassport && qidPassport.trim().length > 0) {
      if (qidPassport.trim().length < 6 || qidPassport.trim().length > 20) {
        errors.qidPassport = "QID or Passport number must be between 6 and 20 alphanumeric characters.";
        if (!firstInvalidRef) firstInvalidRef = qidPassportRef;
      }
    }

    // Currency
    if (!currency) {
      errors.currency = "Please select a transaction currency.";
      if (!firstInvalidRef) firstInvalidRef = currencyRef;
    }

    // Payment method
    if (!paymentMethod) {
      errors.paymentMethod = "Please select a payment method.";
      if (!firstInvalidRef) firstInvalidRef = paymentMethodRef;
    }

    setFieldErrors(errors);

    if (firstInvalidRef && firstInvalidRef.current) {
      firstInvalidRef.current.focus();
      firstInvalidRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (duplicateWarning?.hasDuplicate && !overrideDuplicate) {
      setErrorMessage("Please review the duplicate supplier warning or confirm the authorized exception.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Build internal notes including payment method and QID if freelancer
      const compiledNotes = [
        notes.trim(),
        paymentMethod ? `Preferred Payment Method: ${paymentMethod.toUpperCase()}` : null,
        qidPassport.trim() ? `QID / Passport: ${qidPassport.trim()}` : null,
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/vendors/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          email: email.trim(),
          contactNumber: contactNumber.trim(),
          vendorType,
          category,
          payment_currency: currency,
          requiredDocumentTypes: documentChecklist,
          notes: compiledNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate onboarding invitation.");
      }

      setCreatedResult(data);
      toast.success("Vendor onboarding invitation generated successfully.");
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
    toast.success("Invitation link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const resetModal = () => {
    setCompanyName("");
    setContactPerson("");
    setEmail("");
    setContactNumber("");
    setNotes("");
    setQidPassport("");
    setFieldErrors({});
    setDuplicateWarning(null);
    setOverrideDuplicate(false);
    setCreatedResult(null);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {vendorType === "freelancer" ? "Add Freelancer / Individual" : "Invite Company Vendor"}
              </h2>
              <p className="text-xs text-muted-foreground">Generate a secure 24-hour self-service onboarding link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetModal}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                  A secure 24-hour self-service link has been created for{" "}
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
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
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
                  Vendor Type:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleVendorTypeChange("company")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all min-h-[44px] ${
                      vendorType === "company"
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>Company</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVendorTypeChange("freelancer")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all min-h-[44px] ${
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
                    <span>{vendorType === "freelancer" ? "Full Name / Trade Name*" : "Company Name*"}</span>
                    {isCheckingDuplicates && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
                  </label>
                  <input
                    ref={companyNameRef}
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (fieldErrors.companyName) setFieldErrors(prev => ({ ...prev, companyName: undefined }));
                    }}
                    placeholder={vendorType === "freelancer" ? "e.g. John Doe (Audio Engineer)" : "e.g. Al-Sulaiti Engineering Services"}
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors min-h-[44px] ${
                      fieldErrors.companyName ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20" : "border-border focus:border-primary"
                    }`}
                  />
                  {fieldErrors.companyName && (
                    <p className="text-rose-500 text-[11px] font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.companyName}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>{vendorType === "freelancer" ? "Internal Reference / Sponsor*" : "Contact Person*"}</span>
                  </label>
                  <input
                    ref={contactPersonRef}
                    type="text"
                    value={contactPerson}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      if (fieldErrors.contactPerson) setFieldErrors(prev => ({ ...prev, contactPerson: undefined }));
                    }}
                    placeholder={vendorType === "freelancer" ? "e.g. Sara Al-Thani (Procurement Lead)" : "e.g. Ahmed Al-Sulaiti"}
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors min-h-[44px] ${
                      fieldErrors.contactPerson ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20" : "border-border focus:border-primary"
                    }`}
                  />
                  {fieldErrors.contactPerson && (
                    <p className="text-rose-500 text-[11px] font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.contactPerson}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>Email Address*</span>
                  </label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    placeholder="e.g. contact@example.qa"
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors min-h-[44px] ${
                      fieldErrors.email ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20" : "border-border focus:border-primary"
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="text-rose-500 text-[11px] font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>Contact Number*</span>
                  </label>
                  <input
                    ref={contactNumberRef}
                    type="text"
                    value={contactNumber}
                    onChange={(e) => {
                      setContactNumber(e.target.value);
                      if (fieldErrors.contactNumber) setFieldErrors(prev => ({ ...prev, contactNumber: undefined }));
                    }}
                    placeholder="e.g. +974 5500 1234"
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors min-h-[44px] ${
                      fieldErrors.contactNumber ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20" : "border-border focus:border-primary"
                    }`}
                  />
                  {fieldErrors.contactNumber && (
                    <p className="text-rose-500 text-[11px] font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.contactNumber}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <span>Currency*</span>
                  </label>
                  <select
                    ref={currencyRef}
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      if (fieldErrors.currency) setFieldErrors(prev => ({ ...prev, currency: undefined }));
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  >
                    <option value="QAR">QAR - Qatari Riyal</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    <span>Payment Method*</span>
                  </label>
                  <select
                    ref={paymentMethodRef}
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value as any);
                      if (fieldErrors.paymentMethod) setFieldErrors(prev => ({ ...prev, paymentMethod: undefined }));
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors min-h-[44px]"
                  >
                    <option value="cash">Cash (Direct Settlement)</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer (Direct / Wire)</option>
                  </select>
                </div>

                {vendorType === "freelancer" && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                      <IdCard className="w-3.5 h-3.5 text-primary" />
                      <span>QID or Passport Number (Optional / Policy-Configured)</span>
                    </label>
                    <input
                      ref={qidPassportRef}
                      type="text"
                      value={qidPassport}
                      onChange={(e) => {
                        setQidPassport(e.target.value);
                        if (fieldErrors.qidPassport) setFieldErrors(prev => ({ ...prev, qidPassport: undefined }));
                      }}
                      placeholder="e.g. 29400000000 or A01234567"
                      className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors min-h-[44px] ${
                        fieldErrors.qidPassport ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20" : "border-border focus:border-primary"
                      }`}
                    />
                    {fieldErrors.qidPassport && (
                      <p className="text-rose-500 text-[11px] font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{fieldErrors.qidPassport}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Required Documents Checklist */}
              <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-primary" />
                      <span>Required Compliance Checklist</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      {vendorType === "freelancer"
                        ? "Exempt freelancers do not require commercial documents or corporate banking."
                        : "Configure mandatory certificates for company onboarding."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {documentChecklist.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground bg-background/50 rounded-xl border border-dashed border-border">
                      No mandatory document requirements configured.
                    </div>
                  ) : (
                    documentChecklist.map((doc, idx) => (
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
                    ))
                  )}
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
                    className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium flex items-center gap-1 shrink-0 border border-border shadow-sm min-h-[38px]"
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
                  <span>Generate 24h Invitation Link</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
