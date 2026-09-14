"use client";

import { useState } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  Mail, 
  RefreshCw, 
  X, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  Clock,
  Eye,
  Download,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

interface SharePoModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: any;
  initialRawToken?: string;
  onTokenUpdated?: (newRawToken: string) => void;
}

export function SharePoModal({
  isOpen,
  onClose,
  purchaseOrder,
  initialRawToken,
  onTokenUpdated,
}: SharePoModalProps) {
  const [copied, setCopied] = useState(false);
  const [rawToken, setRawToken] = useState(initialRawToken || "");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  if (!isOpen || !purchaseOrder) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.e3.qa";
  const shareUrl = rawToken ? `${origin}/portal/po/${rawToken}` : "";

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Vendor portal link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/po/${purchaseOrder.id}/share-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate link");

      setRawToken(data.rawToken);
      if (onTokenUpdated) onTokenUpdated(data.rawToken);
      toast.success("New secure vendor link generated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate link");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!purchaseOrder.vendor?.email) {
      toast.error("Vendor does not have a registered email address.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const res = await fetch(`/api/po/${purchaseOrder.id}/share-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawToken,
          customMessage: customMessage.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");

      toast.success(`Official PO email sent to ${purchaseOrder.vendor.email}!`);
      setCustomMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send email to vendor");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const events = Array.isArray(purchaseOrder.events) ? purchaseOrder.events : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">Share Purchase Order</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {purchaseOrder.poNumber} • <span className="font-semibold">{purchaseOrder.vendor?.companyName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Public Link Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Secure Vendor Link</span>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin" : ""}`} />
                {rawToken ? "Regenerate Link" : "Generate Link"}
              </button>
            </label>

            {rawToken ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary/50 border border-border/80 rounded-xl px-3 py-2 text-xs font-mono text-muted-foreground truncate select-all">
                  {shareUrl}
                </div>
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="rounded-xl shrink-0 gap-1.5 text-xs font-bold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-xl border border-border hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Preview Vendor Portal"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">No active raw token loaded for this session.</p>
                <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={isRegenerating} className="rounded-xl text-xs font-bold">
                  {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                  Generate Public Access Link
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Vendors can view itemized totals, download the official signed PDF, and confirm order receipt without requiring an account.
            </p>
          </div>

          {/* Email Vendor Section */}
          <div className="border-t border-border/60 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" /> Send Official Email via Resend
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {purchaseOrder.vendor?.email || "No email on file"}
              </span>
            </div>

            <textarea
              rows={2}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Optional personal message or delivery instruction..."
              className="w-full bg-background border border-border/80 rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <Button
              onClick={handleSendEmail}
              disabled={isSendingEmail || !purchaseOrder.vendor?.email}
              className="w-full rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending via Resend...
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  Email PO to {purchaseOrder.vendor?.companyName || "Vendor"}
                </>
              )}
            </Button>
          </div>

          {/* Activity Timeline */}
          {events.length > 0 && (
            <div className="border-t border-border/60 pt-4 space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Access & Activity Log
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {events.map((ev: any, idx: number) => {
                  const isVendor = ev.actorType === "vendor";
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        {ev.eventType === "VIEWED" ? (
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                        ) : ev.eventType === "PDF_DOWNLOADED" ? (
                          <Download className="w-3.5 h-3.5 text-emerald-500" />
                        ) : ev.eventType === "ACKNOWLEDGED" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-foreground">
                          {ev.eventType.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({isVendor ? "Vendor" : "Staff"})
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-semibold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
