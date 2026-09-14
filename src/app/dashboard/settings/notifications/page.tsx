"use client";

import React, { useState } from "react";
import { NotificationPreferencesModal } from "@/components/notifications/NotificationPreferencesModal";
import { Mail, Bell, Settings2, Sparkles, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

export default function NotificationSettingsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: preferencesData, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => apiClient.notifications.getPreferences(),
  });

  const masterEmailEnabled = Boolean(preferencesData?.masterEmailEnabled);
  const activeEmailCount = (preferencesData?.preferences || []).filter((p: any) => p.emailEnabled && masterEmailEnabled).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center border border-border transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            Email & Notification Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your email alerts powered by Resend and workflow notifications
          </p>
        </div>
      </div>

      {/* Overview Banner Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-card via-card to-secondary/30 border border-border shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground">Resend Email Delivery</h2>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                    masterEmailEnabled
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {masterEmailEnabled ? "Active" : "Off by Default"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                {masterEmailEnabled
                  ? `Email notifications are active with ${activeEmailCount} event categories enabled. Notifications are dispatched directly to ${preferencesData?.userEmail || "your email"}.`
                  : "Email notifications are currently switched off. Turn them on to receive instant updates when requests are submitted, approved, or require your review."}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all active-scale shrink-0"
          >
            <Settings2 className="w-4 h-4" />
            <span>Configure Preferences</span>
          </button>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Pending Approvals</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Approvers get email alerts with quick-review links when requests enter their sequence.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Real-Time Status</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Requesters are notified the instant their request is approved, rejected, or updated.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Zero Noise Control</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All notifications are off by default. You select specifically what arrives in your inbox.
          </p>
        </div>
      </div>

      {/* Modal Dialog */}
      <NotificationPreferencesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
