"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  ChevronRight,
  ChevronLeft,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISSED_STORAGE_KEY = "dismissed_system_alerts";

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  category: "system_update" | "compliance" | "maintenance" | "general";
  priority: "normal" | "important" | "urgent";
  active: boolean;
  linkUrl?: string | null;
  linkText?: string | null;
  createdAt: string;
}

export function SystemAlertTicker() {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Hydrate dismissed alerts from localStorage
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDismissedIds(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const { data: alerts = [], isLoading } = useQuery<SystemAlert[]>({
    queryKey: ["active-system-alerts"],
    queryFn: () => apiClient.alerts.getActive(),
    refetchInterval: 60000, // Background poll every minute for fresh announcements
  });

  // Filter out alerts the user already dismissed
  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  // Reset or adjust index if visible alerts change
  useEffect(() => {
    if (currentIndex >= visibleAlerts.length && visibleAlerts.length > 0) {
      setCurrentIndex(0);
    }
  }, [visibleAlerts.length, currentIndex]);

  // Subtle auto-cycle if multiple alerts exist
  useEffect(() => {
    if (visibleAlerts.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleAlerts.length);
    }, 8500);

    return () => clearInterval(timer);
  }, [visibleAlerts.length]);

  if (!isMounted || isLoading || visibleAlerts.length === 0) {
    return null;
  }

  const currentAlert = visibleAlerts[currentIndex] || visibleAlerts[0];
  if (!currentAlert) return null;

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextDismissed = [...dismissedIds, id];
    setDismissedIds(nextDismissed);

    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(nextDismissed));
    } catch (err) {
      console.warn("[SystemAlertTicker] Failed to save dismissed alert to localStorage:", err);
    }
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case "compliance":
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />,
          badge: "Compliance",
          badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          barBg: "bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/15 text-purple-950 dark:text-purple-200",
          pulseColor: "bg-purple-500",
        };
      case "maintenance":
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
          badge: "Maintenance",
          badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          barBg: "bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/15 text-amber-950 dark:text-amber-200",
          pulseColor: "bg-amber-500",
        };
      case "system_update":
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />,
          badge: "System Update",
          badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
          barBg: "bg-sky-500/5 dark:bg-sky-950/20 border-sky-500/15 text-sky-950 dark:text-sky-200",
          pulseColor: "bg-sky-500",
        };
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-primary shrink-0" />,
          badge: "Notice",
          badgeClass: "bg-primary/10 text-primary border-primary/20",
          barBg: "bg-primary/5 dark:bg-primary/10 border-primary/15 text-foreground",
          pulseColor: "bg-primary",
        };
    }
  };

  const config = getCategoryConfig(currentAlert.category);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentAlert.id}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className={cn(
          "w-full border-b transition-colors relative z-20 backdrop-blur-xs",
          config.barBg
        )}
      >
        <div className="max-w-[2000px] mx-auto px-3.5 sm:px-6 lg:px-8 py-1.5 sm:py-2 flex items-center justify-between gap-3 text-xs">
          {/* Left / Center Message Content */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Live Indicator Pulse */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.pulseColor)} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", config.pulseColor)} />
            </span>

            {/* Category Tag */}
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 hidden xs:inline-flex items-center gap-1",
              config.badgeClass
            )}>
              {config.badge}
            </span>

            {/* Message Body */}
            <div className="min-w-0 flex items-center gap-2 truncate">
              <span className="font-semibold text-foreground/90 truncate">
                {currentAlert.title ? `${currentAlert.title}: ` : ""}
                <span className="font-normal text-muted-foreground">{currentAlert.message}</span>
              </span>

              {/* Action Link if provided */}
              {currentAlert.linkUrl && (
                <Link
                  href={currentAlert.linkUrl}
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0 text-[11px]"
                >
                  <span>{currentAlert.linkText || "Details"}</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-alert page counter */}
            {visibleAlerts.length > 1 && (
              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded-md border border-border/40">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + visibleAlerts.length) % visibleAlerts.length)}
                  className="hover:text-foreground p-0.5"
                  aria-label="Previous alert"
                >
                  <ChevronLeft className="w-2.5 h-2.5" />
                </button>
                <span>{currentIndex + 1}/{visibleAlerts.length}</span>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % visibleAlerts.length)}
                  className="hover:text-foreground p-0.5"
                  aria-label="Next alert"
                >
                  <ChevronRight className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Dismiss Cross Button */}
            <button
              type="button"
              onClick={(e) => handleDismiss(currentAlert.id, e)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
