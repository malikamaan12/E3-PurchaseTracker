"use client";

import { useState, useEffect } from "react";
import {
  X,
  Building2,
  User,
  Mail,
  Phone,
  Landmark,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Send,
  Loader2,
  Download,
  ShieldCheck,
  Globe,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { VendorOnboardingBadge } from "./VendorOnboardingBadge";

interface VendorDraftReviewDrawerProps {
  draftId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function VendorDraftReviewDrawer({
  draftId,
  isOpen,
  onClose,
  onRefresh,
}: VendorDraftReviewDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [changeNotes, setChangeNotes] = useState("");
  const [newLinkResult, setNewLinkResult] = useState<any>(null);

  const fetchDraftDetails = async () => {
    if (!draftId) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/vendors/drafts/${draftId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load draft details");
      setData(json);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not fetch draft details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && draftId) {
      fetchDraftDetails();
    } else {
      setData(null);
      setIsRequestingChanges(false);
      setChangeNotes("");
      setNewLinkResult(null);
    }
  }, [isOpen, draftId]);

  const handleApprove = async () => {
    if (!draftId) return;
    if (!window.confirm("Are you sure you want to approve and activate this vendor in the operational system?")) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/vendors/drafts/${draftId}/approve`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval failed");

      setSuccessMessage(json.message || "Vendor successfully approved and activated.");
      onRefresh();
      fetchDraftDetails();
    } catch (err: any) {
      setErrorMessage(err.message || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!draftId || !changeNotes.trim()) return;
    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/vendors/drafts/${draftId}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: changeNotes.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to request changes");

      setNewLinkResult(json);
      setIsRequestingChanges(false);
      setChangeNotes("");
      onRefresh();
      fetchDraftDetails();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send change request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateLink = async () => {
    if (!draftId) return;
    if (!window.confirm("Generate a new 24-hour invitation link? This will immediately revoke any existing active link.")) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/vendors/drafts/${draftId}/invitations`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to regenerate link");

      setNewLinkResult(json);
      onRefresh();
      fetchDraftDetails();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to regenerate invitation link.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!draftId) return;
    if (!window.confirm("Are you sure you want to revoke the active invitation link?")) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/vendors/drafts/${draftId}/invitations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Revoked by admin from review drawer" }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to revoke link");

      setSuccessMessage("Invitation link revoked successfully.");
      onRefresh();
      fetchDraftDetails();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to revoke link.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDoc = async (docId: number, name: string) => {
    try {
      const res = await fetch(`/api/vendor-onboarding/documents/${docId}/preview`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to get download URL");

      const a = document.createElement("a");
      a.href = json.downloadUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(err.message || "Could not download document");
    }
  };

  if (!isOpen) return null;

  const draft = data?.draft;
  const documents = data?.documents || [];
  const tokens = data?.tokens || [];
  const activeToken = tokens.find((t: any) => t.status === "active" && new Date(t.expiresAt) > new Date());

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate max-w-xs">
                  {draft?.companyName || "Vendor Draft"}
                </h2>
                {draft && <VendorOnboardingBadge status={draft.onboardingStatus} />}
              </div>
              <p className="text-xs text-slate-400">Created on {draft ? new Date(draft.createdAt).toLocaleDateString() : ""}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-xs text-slate-400">Loading draft profile & documents...</p>
            </div>
          ) : draft ? (
            <>
              {errorMessage && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-900/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {newLinkResult && (
                <div className="p-4 bg-slate-950 border border-primary/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>New 24-Hour Link Created</span>
                    </span>
                    <span className="text-[11px] font-mono text-amber-400">
                      Expires in 24 Hours
                    </span>
                  </div>

                  <input
                    type="text"
                    readOnly
                    value={newLinkResult.invitationUrl}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newLinkResult.invitationUrl);
                        toast.success("Invitation link copied to clipboard!");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold"
                    >
                      Copy Link
                    </button>

                    <a
                      href={newLinkResult.mailtoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                    >
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      <span>Open Email Draft</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Correction Form */}
              {isRequestingChanges && (
                <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Request Corrections from Vendor</span>
                  </h4>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Specify what needs updating (e.g. invalid CR document, mismatched bank branch, expired license). This will issue a new 24-hour invitation link to the vendor.
                  </p>
                  <textarea
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter instructions for the vendor..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRequestingChanges(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestChanges}
                      disabled={actionLoading || changeNotes.trim().length < 5}
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Send Correction Request</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Company Information */}
              <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>Company Information</span>
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Contact Person:</span>
                    <span className="text-white font-medium">{draft.contactPerson}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email Address:</span>
                    <span className="text-white font-medium">{draft.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Contact Number:</span>
                    <span className="text-white font-medium">{draft.contactNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Category & Currency:</span>
                    <span className="text-white font-medium">{draft.category} ({draft.payment_currency})</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Headquarters Address:</span>
                    <span className="text-white font-medium">{draft.address || "Not provided yet"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">CR Number:</span>
                    <span className="text-white font-mono font-medium">{draft.registrationNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tax Number (TIN):</span>
                    <span className="text-white font-mono font-medium">{draft.taxNumber || "—"}</span>
                  </div>
                </div>
              </section>

              {/* Banking Information */}
              <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-primary" />
                  <span>Banking & Settlement Information</span>
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Bank Name:</span>
                    <span className="text-white font-medium">{draft.bankName || "Not provided yet"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Branch Name:</span>
                    <span className="text-white font-medium">{draft.branchName || "Not provided yet"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Account Number:</span>
                    <span className="text-white font-mono">{draft.accountNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">IBAN Number:</span>
                    <span className="text-white font-mono">{draft.ibanNumber || "—"}</span>
                  </div>
                </div>
              </section>

              {/* Uploaded Documents */}
              <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>Uploaded Documents ({documents.length})</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {draft.requiredDocumentTypes?.length || 0} required
                  </span>
                </h3>

                {documents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No documents uploaded by vendor yet.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{doc.documentName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="px-2 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                              {doc.documentType}
                            </span>
                            {doc.expiryDate && (
                              <span className="text-amber-400/90 font-mono">
                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc.id, doc.documentName)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors shrink-0"
                          title="Download document for verification"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Invitation Token Status */}
              <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Invitation Link Lifecycle</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {tokens.length} total generated
                  </span>
                </h3>

                <div className="flex items-center justify-between text-xs p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block">Current Link Status:</span>
                    <span className="text-white font-medium capitalize">
                      {activeToken ? "Active (Valid for 24h)" : draft.onboardingStatus}
                    </span>
                  </div>

                  {activeToken && (
                    <div className="text-right">
                      <span className="text-slate-400 block">Link Expiry:</span>
                      <span className="text-amber-400 font-mono">
                        {new Date(activeToken.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Link Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRegenerateLink}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-primary" />
                    <span>Regenerate 24h Link</span>
                  </button>

                  {activeToken && (
                    <button
                      type="button"
                      onClick={handleRevokeLink}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Revoke Link</span>
                    </button>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        {draft && draft.onboardingStatus !== "approved" && (
          <div className="p-5 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsRequestingChanges(true)}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Request Corrections</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={actionLoading || draft.onboardingStatus !== "submitted"}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all min-h-[44px]"
              title={
                draft.onboardingStatus !== "submitted"
                  ? "Vendor must submit their onboarding profile before it can be approved."
                  : "Approve and activate this vendor in the operational system"
              }
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>
                {draft.onboardingStatus === "submitted"
                  ? "Approve & Activate Vendor"
                  : draft.onboardingStatus === "invited"
                  ? "Awaiting Vendor Submission"
                  : draft.onboardingStatus === "in_progress"
                  ? "Vendor Is Editing Profile"
                  : draft.onboardingStatus === "changes_requested"
                  ? "Awaiting Corrections"
                  : "Approve & Activate Vendor"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
