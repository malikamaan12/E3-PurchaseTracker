"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { toast } from "sonner";
import {
  Building2,
  User,
  Copy,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VendorQuickCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorCreated?: (vendor: any) => void;
}

export function VendorQuickCreateModal({
  open,
  onOpenChange,
  onVendorCreated,
}: VendorQuickCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdVendorResult, setCreatedVendorResult] = useState<{
    vendor: any;
    completionLink: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [vendorType, setVendorType] = useState<"company" | "freelancer">("company");
  const [engagementType, setEngagementType] = useState<"permanent" | "temporary">("permanent");
  const [deadlineOption, setDeadlineOption] = useState<"7" | "14" | "30" | "custom">("30");
  const [customDeadline, setCustomDeadline] = useState("");

  const resetForm = () => {
    setCompanyName("");
    setContactPerson("");
    setContactNumber("");
    setEmail("");
    setAddress("");
    setVendorType("company");
    setEngagementType("permanent");
    setDeadlineOption("30");
    setCustomDeadline("");
    setCreatedVendorResult(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim() || !contactNumber.trim() || !email.trim() || !address.trim()) {
      toast.error("Please fill in all required contact fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vendors/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactPerson,
          contactNumber,
          email,
          address,
          vendorType,
          engagementType,
          deadlineOption,
          customDeadline: deadlineOption === "custom" ? customDeadline : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create vendor");
      }

      setCreatedVendorResult({
        vendor: data.vendor,
        completionLink: data.completionLink,
      });

      toast.success(`${data.vendor.companyName} is live and selectable in Purchase Requests.`);

      if (onVendorCreated) {
        onVendorCreated(data.vendor);
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!createdVendorResult) return;
    try {
      await navigator.clipboard.writeText(createdVendorResult.completionLink);
      setCopied(true);
      toast.success("Vendor completion link copied to clipboard.");

      fetch(`/api/vendors/${createdVendorResult.vendor.id}/completion-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log_event", eventType: "LINK_COPIED" }),
      }).catch((logErr) => {
        console.warn("Failed to log LINK_COPIED event:", logErr);
      });

      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Failed to copy link to clipboard.");
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200] animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[201] flex flex-col w-[calc(100%-1.5rem)] max-w-[540px] max-h-[92dvh] translate-x-[-50%] translate-y-[-50%] p-0 overflow-hidden rounded-2xl sm:rounded-3xl border bg-card shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b bg-secondary/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base sm:text-lg font-bold text-foreground">
                  {createdVendorResult ? "Vendor Created & Ready" : "Quick-Create Vendor"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                  {createdVendorResult
                    ? "Vendor is live in directory. Share the link for remaining compliance documents."
                    : "Add minimal vendor details to immediately select in Purchase Requests."}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close dialog"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all touch-target"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {createdVendorResult ? (
            /* Success View */
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      {createdVendorResult.vendor.companyName} is Active
                    </p>
                    <p className="text-xs text-emerald-700/90 dark:text-emerald-400 mt-1 leading-relaxed">
                      You can immediately select this vendor in any Purchase Request. Compliance documentation can be completed later.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="vendor-completion-link" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Vendor Self-Service Completion Link (7-Day Token)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="vendor-completion-link"
                      readOnly
                      value={createdVendorResult.completionLink}
                      className="text-xs font-mono bg-muted/50 select-all h-10"
                    />
                    <Button
                      onClick={copyLink}
                      variant={copied ? "default" : "outline"}
                      className="shrink-0 gap-1.5 h-10 px-4"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Send this link to the vendor to upload Commercial Registration, QID, and banking details directly.
                  </p>
                </div>
              </div>

              {/* Pinned Success Footer */}
              <div className="p-3.5 sm:p-4 border-t border-border bg-secondary/30 flex items-center justify-end shrink-0">
                <Button
                  variant="default"
                  className="rounded-xl px-5 font-semibold text-xs touch-target"
                  onClick={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  Select Vendor & Return
                </Button>
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Company / Freelancer Name */}
                  <div className="space-y-1 col-span-full">
                    <label htmlFor="quick-vendor-name" className="text-xs font-semibold block text-foreground">
                      Company / Freelancer Name <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="quick-vendor-name"
                      name="companyName"
                      required
                      autoComplete="organization"
                      placeholder="e.g. Al-Rawabi Logistics W.L.L."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="rounded-xl h-10 text-xs sm:text-sm"
                    />
                  </div>

                  {/* Entity Type */}
                  <div className="space-y-1">
                    <label id="quick-vendor-type-label" className="text-xs font-semibold block text-foreground">
                      Entity Type <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={vendorType}
                      onValueChange={(val: "company" | "freelancer") => setVendorType(val)}
                    >
                      <SelectTrigger aria-labelledby="quick-vendor-type-label" className="rounded-xl h-10 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">
                          <span className="flex items-center gap-1.5 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-primary" /> Company (CR)
                          </span>
                        </SelectItem>
                        <SelectItem value="freelancer">
                          <span className="flex items-center gap-1.5 text-xs">
                            <User className="w-3.5 h-3.5 text-indigo-500" /> Freelancer (QID)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Engagement Type */}
                  <div className="space-y-1">
                    <label id="quick-engagement-type-label" className="text-xs font-semibold block text-foreground">
                      Engagement Type
                    </label>
                    <Select
                      value={engagementType}
                      onValueChange={(val: "permanent" | "temporary") => setEngagementType(val)}
                    >
                      <SelectTrigger aria-labelledby="quick-engagement-type-label" className="rounded-xl h-10 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent" className="text-xs">Permanent Vendor</SelectItem>
                        <SelectItem value="temporary" className="text-xs">Temporary / One-Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contact Person */}
                  <div className="space-y-1">
                    <label htmlFor="quick-contact-person" className="text-xs font-semibold block text-foreground">
                      Contact Person <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="quick-contact-person"
                      name="contactPerson"
                      required
                      autoComplete="name"
                      placeholder="e.g. Ahmed Al-Mansoori"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="rounded-xl h-10 text-xs sm:text-sm"
                    />
                  </div>

                  {/* Contact Mobile */}
                  <div className="space-y-1">
                    <label htmlFor="quick-contact-number" className="text-xs font-semibold block text-foreground">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="quick-contact-number"
                      name="contactNumber"
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="+974 5500 1234"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="rounded-xl h-10 text-xs sm:text-sm"
                    />
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1 col-span-full">
                    <label htmlFor="quick-vendor-email" className="text-xs font-semibold block text-foreground">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="quick-vendor-email"
                      name="email"
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="billing@vendor.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl h-10 text-xs sm:text-sm"
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-1 col-span-full">
                    <label htmlFor="quick-vendor-address" className="text-xs font-semibold block text-foreground">
                      Address <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="quick-vendor-address"
                      name="address"
                      required
                      autoComplete="street-address"
                      placeholder="e.g. Zone 56, Street 340, Doha, Qatar"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="rounded-xl h-10 text-xs sm:text-sm"
                    />
                  </div>

                  {/* Compliance Deadline (Compact Selector) */}
                  <div className="space-y-1.5 col-span-full">
                    <label className="text-xs font-semibold block text-foreground">
                      Compliance Deadline
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 p-1 bg-secondary/50 rounded-xl border border-border/80">
                      {[
                        { label: "7 Days", val: "7" },
                        { label: "14 Days", val: "14" },
                        { label: "30 Days", val: "30" },
                        { label: "Custom", val: "custom" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setDeadlineOption(opt.val as any)}
                          className={cn(
                            "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all touch-target text-center",
                            deadlineOption === opt.val
                              ? "bg-primary text-primary-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {deadlineOption === "custom" && (
                      <Input
                        aria-label="Custom compliance deadline"
                        type="date"
                        required
                        value={customDeadline}
                        onChange={(e) => setCustomDeadline(e.target.value)}
                        className="mt-2 rounded-xl text-xs h-9"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Pinned Sticky Footer - ALWAYS VISIBLE! */}
              <div className="p-3.5 sm:p-4 border-t border-border bg-secondary/30 flex items-center justify-end gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="rounded-xl text-xs font-semibold touch-target"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2 px-5 rounded-xl shadow-md shadow-primary/20 font-bold text-xs touch-target"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create & Get Link</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
