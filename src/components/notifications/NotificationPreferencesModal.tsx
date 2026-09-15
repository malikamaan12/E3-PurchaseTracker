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
  Key,
  Smartphone,
  CheckCheck
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

  const [activeTab, setActiveTab] = useState<"in_app" | "email">("in_app");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => apiClient.notifications.getPreferences(),
    enabled: isOpen,
  });

  const { data: gatewayStatus, refetch: refetchGateway } = useQuery({
    queryKey: ["resend-status"],
    queryFn: () => apiClient.admin.resend.getStatus(),
    enabled: isOpen && Boolean(isAdmin || isSuperAdmin),
  });

  const [masterEmailEnabled, setMasterEmailEnabled] = useState(false);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Email gateway configuration state
  const [showGatewayConfig, setShowGatewayConfig] = useState(false);
  const [gatewayApiKeyInput, setGatewayApiKeyInput] = useState("");
  const [gatewayFromEmailInput, setGatewayFromEmailInput] = useState("PurchaseTracker <onboarding@resend.dev>");
  const [isConnectingGateway, setIsConnectingGateway] = useState(false);

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
    if (gatewayStatus?.fromEmail) {
      setGatewayFromEmailInput(gatewayStatus.fromEmail);
    }
  }, [gatewayStatus]);

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

  const handleToggleAllInApp = (enable: boolean) => {
    setPreferences((prev) => prev.map((item) => ({ ...item, inAppEnabled: enable })));
    setHasChanges(true);
  };

  const handleToggleAllEmail = (enable: boolean) => {
    setPreferences((prev) => prev.map((item) => ({ ...item, emailEnabled: enable })));
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

  const handleConnectGateway = async () => {
    if (!gatewayApiKeyInput.trim()) {
      toast.error("Please enter a valid API key");
      return;
    }
    try {
      setIsConnectingGateway(true);
      const res = await apiClient.admin.resend.connect({
        apiKey: gatewayApiKeyInput.trim(),
        fromEmail: gatewayFromEmailInput.trim() || undefined,
      });
      toast.success("Email service gateway connected successfully!");
      setShowGatewayConfig(false);
      setGatewayApiKeyInput("");
      refetchGateway();
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify email service API key");
    } finally {
      setIsConnectingGateway(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setIsSendingTest(true);
      const res = await apiClient.notifications.sendTestEmail();
      if (res?.simulated) {
        toast.info(res.message || "Simulated test email sent (Sandbox mode)", {
          description: "Configure an active email service key to deliver live emails to external inboxes.",
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
  const inAppActiveCount = preferences.filter((p) => p.inAppEnabled).length;
  const emailActiveCount = preferences.filter((p) => p.emailEnabled && masterEmailEnabled).length;

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden animate-scale-up z-10">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Notification Preferences
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Configure your app alerts and email notifications independently
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

        {/* Section Switcher Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-card border-b border-border shrink-0">
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/60 rounded-xl border border-border/80">
            <button
              type="button"
              onClick={() => setActiveTab("in_app")}
              className={cn(
                "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all touch-target",
                activeTab === "in_app"
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>In-App Notifications</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold">
                {inAppActiveCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("email")}
              className={cn(
                "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all touch-target",
                activeTab === "email"
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mail className="w-3.5 h-3.5 text-primary" />
              <span>Email Notifications</span>
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border",
                  masterEmailEnabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {masterEmailEnabled ? `${emailActiveCount} Active` : "Off"}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
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
              {/* ════════════════════════════════════════════════════════════════════
                  SECTION 1: IN-APP NOTIFICATIONS (Dashboard Alerts & Toast Messages)
                 ════════════════════════════════════════════════════════════════════ */}
              {activeTab === "in_app" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Informative Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                          In-App Notification Alerts
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          Delivered live inside the web application and mobile dashboard via the navigation bell and popup alerts.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleAllInApp(true)}
                        className="text-[11px] font-bold text-primary hover:underline px-1.5 py-0.5 rounded"
                      >
                        All On
                      </button>
                      <span className="text-muted-foreground text-xs">•</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllInApp(false)}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                      >
                        All Off
                      </button>
                    </div>
                  </div>

                  {/* Granular In-App Events List */}
                  <div className="divide-y divide-border/40 rounded-2xl border border-border bg-card overflow-hidden">
                    {preferences.map((item) => (
                      <div
                        key={item.type}
                        className={cn(
                          "p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors",
                          !item.inAppEnabled && "opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0 mt-0.5 border border-border/50">
                            {getEventIcon(item.type)}
                          </div>
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-normal mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                            {item.inAppEnabled ? "Enabled" : "Muted"}
                          </span>
                          <Switch
                            checked={item.inAppEnabled}
                            onCheckedChange={(checked) => handleInAppToggle(item.type, checked)}
                            aria-label={`Toggle in-app alert for ${item.label}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════════════
                  SECTION 2: EMAIL NOTIFICATIONS (Corporate Mailbox Delivery)
                 ════════════════════════════════════════════════════════════════════ */}
              {activeTab === "email" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Master Email Switch Card */}
                  <div
                    className={cn(
                      "p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden",
                      masterEmailEnabled
                        ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 shadow-xs"
                        : "bg-secondary/40 border-border/80"
                    )}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">Email Notifications Master Switch</span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              masterEmailEnabled
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {masterEmailEnabled ? "Active" : "Off by Default"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {masterEmailEnabled
                            ? "Email delivery is active. You will receive email notifications for the checked events below."
                            : "Email delivery is completely disabled for your account. Toggle this on to start receiving emails."}
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
                  </div>

                  {/* Granular Email Events List */}
                  {masterEmailEnabled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Email Activity Triggers
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleAllEmail(true)}
                            className="text-[11px] font-bold text-primary hover:underline px-1.5 py-0.5 rounded"
                          >
                            All On
                          </button>
                          <span className="text-muted-foreground text-xs">•</span>
                          <button
                            type="button"
                            onClick={() => handleToggleAllEmail(false)}
                            className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                          >
                            All Off
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-border/40 rounded-2xl border border-border bg-card overflow-hidden">
                        {preferences.map((item) => (
                          <div
                            key={item.type}
                            className={cn(
                              "p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors",
                              !item.emailEnabled && "opacity-60"
                            )}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0 mt-0.5 border border-border/50">
                                {getEventIcon(item.type)}
                              </div>
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                                  {item.label}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-normal mt-0.5 leading-relaxed">
                                  Receive an email when {item.description.toLowerCase()}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                                {item.emailEnabled ? "Sending" : "Off"}
                              </span>
                              <Switch
                                checked={item.emailEnabled}
                                onCheckedChange={(checked) => handleEmailToggle(item.type, checked)}
                                aria-label={`Toggle email notification for ${item.label}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-dashed border-border bg-secondary/20 text-center">
                      <p className="text-xs text-muted-foreground font-medium">
                        Email alerts are currently paused. Switch on the Master Email Switch above to enable event-by-event email delivery.
                      </p>
                    </div>
                  )}

                  {/* Corporate Gateway Configuration (Admin Only) */}
                  {(isAdmin || isSuperAdmin) && (
                    <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-secondary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Email Service Gateway
                              </h4>
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                  gatewayStatus?.connected
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                )}
                              >
                                {gatewayStatus?.connected ? "Operational" : "Sandbox Delivery"}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {gatewayStatus?.connected
                                ? `Sender: ${gatewayStatus.fromEmail} | Active Key: ${gatewayStatus.maskedApiKey || "Configured"}`
                                : "Configure corporate email credentials to enable live dispatch."}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowGatewayConfig(!showGatewayConfig)}
                          className="text-xs font-bold text-primary hover:underline shrink-0"
                        >
                          {showGatewayConfig ? "Close" : gatewayStatus?.connected ? "Reconfigure" : "Connect Gateway"}
                        </button>
                      </div>

                      {showGatewayConfig && (
                        <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
                          <div>
                            <label className="block text-[11px] font-bold text-foreground mb-1">
                              Email Gateway API Key
                            </label>
                            <input
                              type="password"
                              value={gatewayApiKeyInput}
                              onChange={(e) => setGatewayApiKeyInput(e.target.value)}
                              placeholder="re_••••••••••••••••"
                              className="w-full px-3 py-2 rounded-xl text-xs bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-foreground mb-1">
                              Sender Address (From Email)
                            </label>
                            <input
                              type="text"
                              value={gatewayFromEmailInput}
                              onChange={(e) => setGatewayFromEmailInput(e.target.value)}
                              placeholder="PurchaseTracker <notifications@company.com>"
                              className="w-full px-3 py-2 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={handleConnectGateway}
                              disabled={isConnectingGateway || !gatewayApiKeyInput.trim()}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 transition-all active-scale shadow-sm"
                            >
                              {isConnectingGateway ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Verifying credentials...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verify & Save Gateway</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Send Test Email Card */}
                  <div className="p-4 rounded-2xl bg-secondary/30 border border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">Test Email Delivery</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Send an instant verification message to your registered email address ({userEmail || "your email"}).
                      </p>
                    </div>

                    <button
                      onClick={handleSendTestEmail}
                      disabled={isSendingTest}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border flex items-center gap-2 transition-all active-scale shrink-0 shadow-xs touch-target"
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Pinned / Sticky Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-secondary/30 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-muted-foreground font-medium">
            {hasChanges && (
              <span className="text-amber-500 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved modifications
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all touch-target"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center gap-2 transition-all active-scale disabled:opacity-50 touch-target"
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
