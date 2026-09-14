"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Switch } from "@/components/ui/Switch";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  Mail,
  Bell,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  ShieldCheck,
  Send,
  Loader2,
  X,
  Sparkles,
  Info,
  Check,
  RotateCcw,
  Key
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PreferenceItem {
  id: number;
  userId: number;
  category: string;
  type: string;
  label: string;
  description: string;
  enabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => apiClient.notifications.getPreferences(),
    enabled: isOpen,
  });

  const { data: resendStatus, refetch: refetchResend } = useQuery({
    queryKey: ["resend-status"],
    queryFn: () => apiClient.admin.resend.getStatus(),
    enabled: isOpen && Boolean(isAdmin || isSuperAdmin),
  });

  const [masterEmailEnabled, setMasterEmailEnabled] = useState(false);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Resend credential inputs
  const [showResendConfig, setShowResendConfig] = useState(false);
  const [resendApiKeyInput, setResendApiKeyInput] = useState("");
  const [resendFromEmailInput, setResendFromEmailInput] = useState("PurchaseTracker <onboarding@resend.dev>");
  const [isConnectingResend, setIsConnectingResend] = useState(false);

  // Sync state when data loads
  useEffect(() => {
    if (data) {
      setMasterEmailEnabled(Boolean(data.masterEmailEnabled));
      if (Array.isArray(data.preferences)) {
        setPreferences(data.preferences);
      }
      setHasChanges(false);
    }
  }, [data]);

  useEffect(() => {
    if (resendStatus?.fromEmail) {
      setResendFromEmailInput(resendStatus.fromEmail);
    }
  }, [resendStatus]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { masterEmailEnabled: boolean; preferences: any[] }) => {
      return apiClient.notifications.updateAllPreferences(payload);
    },
    onSuccess: (updatedData) => {
      queryClient.setQueryData(["notification-preferences"], updatedData);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Notification preferences saved successfully");
      setHasChanges(false);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save preferences");
    },
  });

  const handleMasterToggle = (checked: boolean) => {
    setMasterEmailEnabled(checked);
    setHasChanges(true);
  };

  const handleEmailToggle = (type: string, checked: boolean) => {
    setPreferences((prev) =>
      prev.map((item) => (item.type === type ? { ...item, emailEnabled: checked } : item))
    );
    setHasChanges(true);
  };

  const handleInAppToggle = (type: string, checked: boolean) => {
    setPreferences((prev) =>
      prev.map((item) => (item.type === type ? { ...item, inAppEnabled: checked } : item))
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      masterEmailEnabled,
      preferences: preferences.map((p) => ({
        id: p.id,
        type: p.type,
        emailEnabled: p.emailEnabled,
        inAppEnabled: p.inAppEnabled,
      })),
    });
  };

  const handleConnectResend = async () => {
    if (!resendApiKeyInput.trim()) {
      toast.error("Please enter a valid Resend API key");
      return;
    }
    try {
      setIsConnectingResend(true);
      const res = await apiClient.admin.resend.connect({
        apiKey: resendApiKeyInput.trim(),
        fromEmail: resendFromEmailInput.trim() || undefined,
      });
      toast.success(res?.message || "Resend connected successfully!");
      setShowResendConfig(false);
      setResendApiKeyInput("");
      refetchResend();
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify Resend API key");
    } finally {
      setIsConnectingResend(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setIsSendingTest(true);
      const res = await apiClient.notifications.sendTestEmail();
      if (res?.simulated) {
        toast.info(res.message || "Simulated test email sent (Resend sandbox mode)", {
          description: "Configure RESEND_API_KEY to deliver real live emails to your inbox.",
        });
      } else {
        toast.success(res?.message || "Test email dispatched successfully! Please check your inbox.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to deliver test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "pending_approval":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "new_request":
        return <FileText className="w-4 h-4 text-sky-500" />;
      case "approval_granted":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "approval_rejected":
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case "changes_requested":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "vendor_status_change":
        return <Building className="w-4 h-4 text-purple-500" />;
      case "system_update":
        return <ShieldCheck className="w-4 h-4 text-indigo-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (!isOpen) return null;

  const userEmail = data?.userEmail || "";

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-up z-10">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Notification Preferences
                </h2>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Resend
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Manage your email and in-app alerts for workflow actions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preferences modal"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all touch-target"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Loading preferences...</p>
            </div>
          ) : isError ? (
            <div className="p-6 text-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <p className="text-sm font-semibold">Failed to load notification preferences.</p>
              <button
                onClick={() => refetch()}
                className="mt-3 px-3 py-1.5 rounded-xl bg-card border border-rose-500/30 text-xs font-bold hover:bg-rose-500/20 transition-all inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Try Again
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: MASTER EMAIL TOGGLE CARD */}
              <div
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden",
                  masterEmailEnabled
                    ? "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 shadow-xs"
                    : "bg-secondary/40 border-border/80"
                )}
              >
                <div className="flex items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">Email Notifications</span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                          masterEmailEnabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted/80 text-muted-foreground border-border"
                        )}
                      >
                        {masterEmailEnabled ? "Active" : "Off by default"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {masterEmailEnabled
                        ? "Email notifications are enabled. You will receive emails for the checked events below."
                        : "Email notifications are completely disabled. Toggle this on to receive email notifications."}
                    </p>

                    {userEmail && (
                      <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-mono text-muted-foreground bg-background/60 w-fit px-2.5 py-1 rounded-lg border border-border/60">
                        <Mail className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate max-w-[280px]">
                          {userEmail}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 sm:pt-0 shrink-0">
                    <Switch
                      checked={masterEmailEnabled}
                      onCheckedChange={handleMasterToggle}
                      aria-label="Toggle master email notifications"
                    />
                  </div>
                </div>

                {!masterEmailEnabled && (
                  <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Turn this switch ON to start receiving email alerts for approvals and requests.</span>
                  </div>
                )}
              </div>

              {/* SECTION: RESEND CONNECTION CONFIGURATION (ADMINS) */}
              {(isAdmin || isSuperAdmin) && (
                <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-secondary/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                            Resend API Connection
                          </h4>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              resendStatus?.connected
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            {resendStatus?.connected ? "Connected" : "Not Connected (Simulation)"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {resendStatus?.connected
                            ? `Active Key: ${resendStatus.maskedApiKey || "Configured"} | Sender: ${resendStatus.fromEmail}`
                            : "Enter your Resend API key (re_...) to connect and dispatch real emails."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowResendConfig(!showResendConfig)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {showResendConfig ? "Cancel" : resendStatus?.connected ? "Reconfigure" : "Connect Resend"}
                    </button>
                  </div>

                  {showResendConfig && (
                    <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Resend API Key (starts with re_)
                        </label>
                        <input
                          type="password"
                          value={resendApiKeyInput}
                          onChange={(e) => setResendApiKeyInput(e.target.value)}
                          placeholder="re_123456789_..."
                          className="w-full px-3 py-2 rounded-xl text-xs bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Sender Address (From Email)
                        </label>
                        <input
                          type="text"
                          value={resendFromEmailInput}
                          onChange={(e) => setResendFromEmailInput(e.target.value)}
                          placeholder="PurchaseTracker <onboarding@resend.dev>"
                          className="w-full px-3 py-2 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          For test domains, use <code className="font-mono">PurchaseTracker &lt;onboarding@resend.dev&gt;</code>.
                        </p>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleConnectResend}
                          disabled={isConnectingResend || !resendApiKeyInput.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 transition-all active-scale shadow-sm"
                        >
                          {isConnectingResend ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Verifying with Resend...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verify & Connect Resend</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: GRANULAR NOTIFICATION EVENT SELECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Notification Events
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Select which activities you want to receive alerts for
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider pr-1">
                    <span className="flex items-center gap-1">
                      <Bell className="w-3 h-3 text-primary" /> In-App
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-primary" /> Email
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border/30 rounded-2xl border border-border bg-card overflow-hidden">
                  {preferences.map((item) => {
                    const isEmailDisabledForThis = !masterEmailEnabled;

                    return (
                      <div
                        key={item.type}
                        className={cn(
                          "p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors",
                          !item.inAppEnabled && !item.emailEnabled && "opacity-70"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0 mt-0.5 border border-border/50">
                            {getEventIcon(item.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-bold text-foreground leading-snug truncate">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-normal line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Controls: In-App & Email Switches */}
                        <div className="flex items-center gap-6 shrink-0 pl-2">
                          {/* In-App Toggle */}
                          <div className="flex items-center justify-center w-8" title="Toggle In-App alert">
                            <Switch
                              checked={item.inAppEnabled}
                              onCheckedChange={(checked) => handleInAppToggle(item.type, checked)}
                              aria-label={`Toggle in-app notification for ${item.label}`}
                            />
                          </div>

                          {/* Email Toggle */}
                          <div
                            className={cn(
                              "flex items-center justify-center w-8 transition-opacity",
                              isEmailDisabledForThis && "opacity-40 pointer-events-none"
                            )}
                            title={
                              isEmailDisabledForThis
                                ? "Master email toggle is off. Turn on Email Notifications above to enable."
                                : `Toggle email notification for ${item.label}`
                            }
                          >
                            <Switch
                              checked={item.emailEnabled && masterEmailEnabled}
                              disabled={isEmailDisabledForThis}
                              onCheckedChange={(checked) => handleEmailToggle(item.type, checked)}
                              aria-label={`Toggle email notification for ${item.label}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: TEST EMAIL TRIGGER */}
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Verify Resend Delivery</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Send a test message to your registered email to confirm inbox delivery.
                  </p>
                </div>

                <button
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border flex items-center gap-2 transition-all active-scale shrink-0 shadow-xs"
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-primary" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border bg-secondary/20 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground font-medium">
            {hasChanges && (
              <span className="text-amber-500 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved modifications
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center gap-2 transition-all active-scale disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
