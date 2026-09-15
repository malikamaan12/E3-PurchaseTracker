"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Eye,
  RotateCcw,
  Loader2,
  Calendar,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

interface SystemAlert {
  id: string;
  title: string;
  message: string;
  category: "system_update" | "compliance" | "maintenance" | "general";
  priority: "normal" | "important" | "urgent";
  active: boolean;
  linkUrl?: string | null;
  linkText?: string | null;
  createdAt: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}

export default function AdminAlertsManagementPage() {
  usePageTitle("System Broadcast Alerts");
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SystemAlert | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"system_update" | "compliance" | "maintenance" | "general">("system_update");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [active, setActive] = useState(true);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: alerts = [], isLoading, refetch, isFetching } = useQuery<SystemAlert[]>({
    queryKey: ["admin_alerts_list"],
    queryFn: () => apiClient.admin.alerts.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => apiClient.admin.alerts.save(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_alerts_list"] });
      queryClient.invalidateQueries({ queryKey: ["active-system-alerts"] });
      toast.success("Broadcast alert saved successfully");
      handleResetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save alert");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.admin.alerts.toggleActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_alerts_list"] });
      queryClient.invalidateQueries({ queryKey: ["active-system-alerts"] });
      toast.success("Alert status updated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.admin.alerts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_alerts_list"] });
      queryClient.invalidateQueries({ queryKey: ["active-system-alerts"] });
      toast.success("Alert removed successfully");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete alert");
    },
  });

  const handleResetForm = () => {
    setTitle("");
    setMessage("");
    setCategory("system_update");
    setPriority("normal");
    setActive(true);
    setLinkUrl("");
    setLinkText("");
    setExpiresAt("");
    setEditingAlert(null);
    setShowCreateForm(false);
  };

  const handleEdit = (alert: SystemAlert) => {
    setEditingAlert(alert);
    setTitle(alert.title);
    setMessage(alert.message);
    setCategory(alert.category);
    setPriority(alert.priority);
    setActive(alert.active);
    setLinkUrl(alert.linkUrl || "");
    setLinkText(alert.linkText || "");
    setExpiresAt(alert.expiresAt ? alert.expiresAt.substring(0, 10) : "");
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Please provide both an alert title and message");
      return;
    }

    saveMutation.mutate({
      id: editingAlert ? editingAlert.id : undefined,
      title: title.trim(),
      message: message.trim(),
      category,
      priority,
      active,
      linkUrl: linkUrl.trim() || null,
      linkText: linkText.trim() || null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  };

  // Preset quick templates
  const applyPreset = (preset: {
    title: string;
    message: string;
    category: "system_update" | "compliance" | "maintenance" | "general";
    priority: "normal" | "important" | "urgent";
    linkUrl?: string;
    linkText?: string;
  }) => {
    setTitle(preset.title);
    setMessage(preset.message);
    setCategory(preset.category);
    setPriority(preset.priority);
    setLinkUrl(preset.linkUrl || "");
    setLinkText(preset.linkText || "");
    setShowCreateForm(true);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground tracking-tight">
              System Alerts & Tickers
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
              Publish minimal, non-intrusive broadcast banners for system updates, compliance rules, and downtime
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (showCreateForm) {
                handleResetForm();
              } else {
                setShowCreateForm(true);
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all active-scale shadow-sm"
          >
            {showCreateForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Close Editor</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>New Alert</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preset Fast Selectors */}
      {!showCreateForm && (
        <div className="glass-card p-5 rounded-3xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            Quick Announcement Presets
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => applyPreset({
                title: "Procurement Compliance",
                message: "Commercial requests over QAR 50,000 require Department Head & Finance dual approval before PO issuance.",
                category: "compliance",
                priority: "important",
                linkUrl: "/dashboard/requests",
                linkText: "View Workflow"
              })}
              className="p-3 text-left rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border text-xs transition-all active-scale"
            >
              <div className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Compliance Rule</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                Dual approval threshold alert for requests.
              </p>
            </button>

            <button
              onClick={() => applyPreset({
                title: "System Maintenance",
                message: "Scheduled infrastructure maintenance tonight at 11:30 PM UTC. System will remain read-only for 15 mins.",
                category: "maintenance",
                priority: "urgent"
              })}
              className="p-3 text-left rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border text-xs transition-all active-scale"
            >
              <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Downtime / Maintenance</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                Standard maintenance window announcement.
              </p>
            </button>

            <button
              onClick={() => applyPreset({
                title: "Platform Update",
                message: "Digital Purchase Order creation and direct vendor acknowledgments are now live.",
                category: "system_update",
                priority: "normal",
                linkUrl: "/dashboard/requests",
                linkText: "Try Now"
              })}
              className="p-3 text-left rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border text-xs transition-all active-scale"
            >
              <div className="flex items-center gap-2 font-bold text-sky-600 dark:text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Feature Update</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                Announce new system capabilities and fixes.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Alert Form */}
      {showCreateForm && (
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-primary/30 bg-card shadow-xl space-y-5 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                {editingAlert ? "Edit Broadcast Alert" : "Compose Broadcast Alert"}
              </h3>
            </div>
            <button
              onClick={handleResetForm}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          {/* Live Ticker Preview */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-primary" />
              Live User Ticker Preview
            </span>
            <div className="p-2.5 rounded-xl border border-border bg-secondary/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {category.replace("_", " ")}
                </span>
                <span className="truncate text-foreground font-semibold">
                  {title || "Alert Title"}:{" "}
                  <span className="font-normal text-muted-foreground">
                    {message || "Enter alert message to see preview..."}
                  </span>
                </span>
                {linkUrl && (
                  <span className="inline-flex items-center gap-1 font-bold text-primary text-[11px] shrink-0">
                    {linkText || "Details"} <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
              <span className="text-muted-foreground hover:text-foreground p-0.5 opacity-60">
                <X className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-foreground mb-1">
                  Alert Title / Headline *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Procurement Compliance Notice"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="system_update">System Update</option>
                  <option value="compliance">Compliance Rule</option>
                  <option value="maintenance">Maintenance / Downtime</option>
                  <option value="general">General Notice</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Broadcast Message Body * (Keep concise for single-line ticker display)
              </label>
              <textarea
                required
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter the alert text that will stream or show in the top dashboard banner..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Action Link URL (Optional)
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/dashboard/requests"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Action Link Label (Optional)
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="View Policy"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Auto-Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                />
                <span className="text-xs font-semibold text-foreground">
                  Publish immediately (Active on user dashboards)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all active-scale shadow-sm disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving alert...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{editingAlert ? "Update Alert" : "Publish Broadcast"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Broadcast Alerts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Active & Past Broadcasts</h2>
          <span className="text-xs text-muted-foreground font-mono font-medium">
            {alerts.length} Total Alerts
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading system alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-foreground">No broadcast alerts found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click &quot;New Alert&quot; above to create a system announcement or compliance notice.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "p-4 sm:p-5 rounded-3xl border bg-card transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                  item.active
                    ? "border-border shadow-xs"
                    : "border-border/60 opacity-60 bg-secondary/20"
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 mt-0.5",
                    item.category === "compliance"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                      : item.category === "maintenance"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                  )}>
                    {item.category === "compliance" ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : item.category === "maintenance" ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                        {item.category.replace("_", " ")}
                      </span>
                      {item.expiresAt && (
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Expires: {new Date(item.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {item.linkUrl && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <ExternalLink className="w-3 h-3" />
                        <span>Link: {item.linkUrl}</span>
                        {item.linkText && <span className="opacity-70">({item.linkText})</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right controls: Active toggle + Edit + Delete */}
                <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: item.id, active: checked })}
                      disabled={toggleMutation.isPending}
                    />
                    <span className="text-xs font-semibold text-muted-foreground min-w-[50px]">
                      {item.active ? "Active" : "Paused"}
                    </span>
                  </div>

                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-xl text-xs font-semibold bg-secondary/60 hover:bg-secondary text-foreground transition-all"
                    title="Edit Alert"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-2 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 transition-all"
                    title="Delete Alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
