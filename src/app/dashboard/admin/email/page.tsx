"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Key,
  Shield,
  Sparkles,
  Server,
  Lock,
  Globe,
  Loader2,
  FileText,
  Check,
  Power
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function AdminEmailManagementPage() {
  usePageTitle("Admin Email Management");
  const queryClient = useQueryClient();

  // Gateway Config Query
  const { data: config, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin_email_config"],
    queryFn: () => apiClient.admin.email.getConfig(),
  });

  // Credentials form state
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [fromEmailInput, setFromEmailInput] = useState("");
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);

  // Test dispatcher state
  const [testRecipient, setTestRecipient] = useState("e3qatech@gmail.com");
  const [testSubject, setTestSubject] = useState("E3 Procurement • Transactional Email Verification");
  const [testTemplate, setTestTemplate] = useState("test_verification");
  const [testCustomMessage, setTestCustomMessage] = useState("");
  const [lastDispatchedInfo, setLastDispatchedInfo] = useState<any>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const isConnected = Boolean(config?.connected);
  const isSandbox = Boolean(config?.fromEmail?.toLowerCase().includes("onboarding@resend.dev"));

  // Automatically ensure test recipient is set appropriately based on gateway mode
  React.useEffect(() => {
    if (isSandbox && (!testRecipient || testRecipient === "amaanmalik12@gmail.com")) {
      setTestRecipient("e3qatech@gmail.com");
    }
  }, [isSandbox]);

  // Save Config Mutation
  const saveConfigMutation = useMutation({
    mutationFn: (payload: any) => apiClient.admin.email.updateConfig(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin_email_config"] });
      queryClient.invalidateQueries({ queryKey: ["resend-status"] });
      toast.success(data?.message || "Email gateway configuration saved successfully");
      setIsEditingCredentials(false);
      setApiKeyInput("");
      setSandboxError(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update email gateway configuration");
    },
  });

  // Send Test Mutation
  const sendTestMutation = useMutation({
    mutationFn: (payload: any) => apiClient.admin.email.sendTest(payload),
    onSuccess: (data) => {
      setLastDispatchedInfo(data);
      setSandboxError(null);
      toast.success(`Test email successfully sent to ${data?.dispatchedTo || testRecipient}`);
    },
    onError: (err: any) => {
      const msg = err?.message || "Test email delivery failed";
      if (
        msg.toLowerCase().includes("only send testing emails to your own email address") ||
        msg.toLowerCase().includes("verify a domain")
      ) {
        setSandboxError(msg);
      }
      toast.error(msg);
    },
  });

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim() && !fromEmailInput.trim()) {
      toast.error("Please enter an API key or sender address to update");
      return;
    }

    saveConfigMutation.mutate({
      apiKey: apiKeyInput.trim() || undefined,
      fromEmail: fromEmailInput.trim() || undefined,
    });
  };

  const handleToggleMaster = (enabled: boolean) => {
    saveConfigMutation.mutate({
      masterEmailEnabled: enabled,
    });
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testRecipient.includes("@")) {
      toast.error("Please provide a valid recipient email address");
      return;
    }

    sendTestMutation.mutate({
      to: testRecipient.trim(),
      subject: testSubject.trim(),
      templateType: testTemplate,
      customMessage: testCustomMessage.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground tracking-tight">
                Email Management
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                Transactional gateway health, live test dispatcher, and delivery policies
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary/60 hover:bg-secondary text-foreground border border-border flex items-center gap-2 transition-all active-scale"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-primary")} />
            <span>Sync Status</span>
          </button>
        </div>
      </div>

      {/* Grid: Status & Master Killswitch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Gateway Connection Status */}
        <div className="md:col-span-2 glass-card p-6 rounded-3xl border border-border relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0",
                !isConnected
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : isSandbox
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              )}>
                {!isConnected ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : isSandbox ? (
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    Transactional Gateway
                  </h3>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    !isConnected
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : isSandbox
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  )}>
                    {!isConnected ? "Not Configured" : isSandbox ? "Sandbox Mode" : "Production Ready"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {!isConnected
                    ? "No active API key detected. Please configure gateway credentials below."
                    : isSandbox
                    ? "Outbound emails use onboarding@resend.dev. Delivery restricted to e3qatech@gmail.com."
                    : "Outbound transactional emails are active and delivering via verified custom domain."}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsEditingCredentials(!isEditingCredentials);
                if (!fromEmailInput && config?.fromEmail) {
                  setFromEmailInput(config.fromEmail);
                }
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-all active-scale shrink-0"
            >
              {isEditingCredentials ? "Cancel" : "Edit Gateway"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-border/60 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                Sender Address
              </span>
              <p className="font-mono font-medium text-foreground mt-0.5 truncate" title={config?.fromEmail || "Default"}>
                {config?.fromEmail || "Not Set"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                API Key
              </span>
              <p className="font-mono font-medium text-foreground mt-0.5">
                {config?.maskedApiKey || "None configured"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                Configuration Source
              </span>
              <p className="font-semibold text-primary capitalize mt-0.5">
                {config?.source || "None"}
              </p>
            </div>
          </div>
        </div>

        {/* Global Master Killswitch */}
        <div className="glass-card p-6 rounded-3xl border border-border flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
              <Power className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Global Master Delivery</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Master killswitch to pause or resume all automated outgoing emails system-wide.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
            <span className="text-xs font-semibold text-foreground">
              {config?.masterEmailEnabled ? "Delivery Active" : "Delivery Paused"}
            </span>
            <Switch
              checked={Boolean(config?.masterEmailEnabled)}
              onCheckedChange={handleToggleMaster}
              disabled={saveConfigMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Gateway Configuration Editor */}
      {isEditingCredentials && (
        <form onSubmit={handleSaveCredentials} className="glass-card p-6 sm:p-7 rounded-3xl border border-primary/30 bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Update Gateway Credentials
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Transactional API Key
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter your secret key from your email delivery service.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Default Sender Address (From Email)
              </label>
              <input
                type="text"
                value={fromEmailInput}
                onChange={(e) => setFromEmailInput(e.target.value)}
                placeholder="Events & Entertainment Enterprises <notifications@eeeqa.com>"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                To send to all staff & vendors, verify your domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold">resend.com/domains ↗</a>, then enter your verified address here (e.g. <code className="font-mono text-primary font-semibold">Events & Entertainment Enterprises &lt;procurement@eeeqa.com&gt;</code>).
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingCredentials(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveConfigMutation.isPending}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all active-scale disabled:opacity-50"
            >
              {saveConfigMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating credentials...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Verify & Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Live Test Email Dispatcher & Templates Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Test Dispatcher Form */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">Live Delivery Test Dispatcher</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Send an instant verification email to test deliverability, spam score, and formatting.
            </p>

            {isSandbox && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Resend Sandbox Mode Active</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your sender is <code className="font-mono text-foreground font-semibold">onboarding@resend.dev</code>. In sandbox mode, Resend strictly allows sending test emails to the account owner (<strong className="text-foreground">e3qatech@gmail.com</strong>).
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTestRecipient("e3qatech@gmail.com");
                      setSandboxError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors"
                  >
                    Fill: e3qatech@gmail.com
                  </button>
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Verify Domain at Resend ↗</span>
                  </a>
                </div>
              </div>
            )}

            {sandboxError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Recipient Blocked by Resend Sandbox</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSandboxError(null)}
                    className="text-muted-foreground hover:text-foreground text-[11px]"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Resend blocked sending to <strong className="text-foreground font-mono">{testRecipient}</strong> because <code className="font-mono text-foreground">onboarding@resend.dev</code> is a sandbox domain that can only send to <strong className="text-foreground">e3qatech@gmail.com</strong>.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTestRecipient("e3qatech@gmail.com");
                      setSandboxError(null);
                    }}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Switch to e3qatech@gmail.com
                  </button>
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-primary underline"
                  >
                    Verify Custom Domain (eeeqa.com) ↗
                  </a>
                </div>
              </div>
            )}

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-foreground">
                    Recipient Email Address
                  </label>
                  {isSandbox && (
                    <button
                      type="button"
                      onClick={() => setTestRecipient("e3qatech@gmail.com")}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Use e3qatech@gmail.com
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    placeholder="Test Subject"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Template Scenario
                  </label>
                  <select
                    value={testTemplate}
                    onChange={(e) => setTestTemplate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="test_verification">Gateway Verification</option>
                    <option value="compliance_alert">Compliance Notice Sample</option>
                    <option value="system_update">System Update Broadcast</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Custom Body Message (Optional)
                </label>
                <textarea
                  rows={2}
                  value={testCustomMessage}
                  onChange={(e) => setTestCustomMessage(e.target.value)}
                  placeholder="Add any specific text to inspect in the rendered email..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <div className="text-[11px] text-muted-foreground font-mono">
                  {lastDispatchedInfo && (
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Dispatched at {lastDispatchedInfo.dispatchedAt}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sendTestMutation.isPending || !isConnected}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all active-scale disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  {sendTestMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Verification Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Available System Email Triggers */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-border">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-base font-bold text-foreground">Configured Automated Triggers</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            The platform automatically formats and dispatches branded emails for the following events:
          </p>

          <div className="space-y-3">
            {[
              {
                title: "Purchase Request Submitted",
                recipient: "Assigned Department Reviewers",
                desc: "Includes line item table, requester notes, and direct one-click review link.",
              },
              {
                title: "Sign-Off Decision Required",
                recipient: "Department Heads & Finance",
                desc: "High-priority alert with action buttons to review, sign off, or request changes.",
              },
              {
                title: "Purchase Order Issued",
                recipient: "Selected Vendor & Requester",
                desc: "Includes official PO PDF attachment, terms, and digital acknowledgment portal link.",
              },
              {
                title: "Vendor Onboarding & Status",
                recipient: "Vendor Contact & Procurement Admin",
                desc: "Dispatches secure tokenized links for compliance documentation upload.",
              },
            ].map((evt, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">{evt.title}</p>
                  <span className="text-[10px] font-mono text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{evt.desc}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1">
                  <span className="font-bold uppercase tracking-wider">To:</span> {evt.recipient}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
