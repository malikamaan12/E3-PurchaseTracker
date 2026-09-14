"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  X, 
  User, 
  ShieldCheck, 
  Search, 
  Moon, 
  Sun, 
  Zap, 
  LogOut, 
  Building, 
  ShoppingBag, 
  PieChart, 
  ShieldAlert, 
  ChevronRight,
  ExternalLink,
  Laptop,
  RotateCw,
  Mail
} from "lucide-react";
import { NotificationPreferencesModal } from "@/components/notifications/NotificationPreferencesModal";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import { usePerformance } from "@/context/PerformanceContext";
import { usePWA } from "@/context/PWAContext";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavigationSheet({ isOpen, onClose }: NavigationSheetProps) {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { highPerformanceMode, setHighPerformanceMode } = usePerformance();
  const { refreshAppAndData, isSyncing } = usePWA();
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
      toast.success("Successfully logged out");
      onClose();
      router.push("/login");
    } catch (error: any) {
      toast.error("Logout failed: " + (error.message || "Unknown error"));
    }
  };

  const handleSearchClick = () => {
    onClose();
    setTimeout(() => {
      const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true });
      document.dispatchEvent(event);
    }, 150);
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nav-sheet-title"
    >
      <div 
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div className="relative z-10 bg-card border-t border-border rounded-t-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Handle / Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="nav-sheet-title" className="text-sm font-bold text-foreground truncate">
                {user?.username || "Guest User"}
              </h2>
              <p className="text-xs text-muted-foreground font-medium truncate">
                {user?.department || "General Access"} • <span className="capitalize font-bold text-primary">{user?.role?.replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation sheet"
            className="w-11 h-11 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors touch-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 space-y-5 custom-scrollbar pb-safe">
          {/* Quick Search Button */}
          <button
            onClick={handleSearchClick}
            aria-label="Search system"
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-secondary/60 border border-border text-foreground hover:bg-secondary transition-all touch-target"
          >
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Quick Search...</span>
            </div>
            <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-background rounded-md border border-border text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Admin Navigation (When Permitted) */}
          {isAdmin && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
                Administration
              </span>
              <Link
                href="/dashboard/admin"
                onClick={onClose}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all touch-target",
                  pathname.startsWith("/dashboard/admin")
                    ? "bg-primary/10 border-primary/30 text-primary font-bold"
                    : "bg-card border-border text-foreground hover:bg-secondary"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">Admin Console</p>
                    <p className="text-xs text-muted-foreground font-medium">System Governance, Users & Config</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </div>
          )}

          {/* Device & System Preferences */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
              Preferences & Settings
            </span>

            {/* Sync & Refresh Button */}
            <button
              onClick={() => {
                refreshAppAndData();
                onClose();
              }}
              disabled={isSyncing}
              aria-label="Refresh and sync data"
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border text-foreground hover:bg-secondary transition-all touch-target"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <RotateCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Sync & Refresh</p>
                  <p className="text-xs text-muted-foreground font-medium">Reload latest records & check updates</p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary">{isSyncing ? "Syncing..." : "Sync"}</span>
            </button>

            {/* Email Notifications Button */}
            <button
              onClick={() => setIsPreferencesModalOpen(true)}
              aria-label="Open email notification preferences"
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border text-foreground hover:bg-secondary transition-all touch-target"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Email Notifications</p>
                  <p className="text-xs text-muted-foreground font-medium">Configure Resend email alerts</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border text-foreground hover:bg-secondary transition-all touch-target"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Appearance Theme</p>
                  <p className="text-xs text-muted-foreground font-medium">Current: {isDark ? "Dark Mode" : "Light Mode"}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary">Toggle</span>
            </button>

            {/* Performance Mode Toggle */}
            <button
              onClick={() => {
                setHighPerformanceMode(!highPerformanceMode);
                toast.success(`High Performance Mode ${!highPerformanceMode ? "Enabled" : "Disabled"}`);
              }}
              aria-label={highPerformanceMode ? "Disable High Performance Mode" : "Enable High Performance Mode"}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border text-foreground hover:bg-secondary transition-all touch-target"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  highPerformanceMode ? "bg-amber-500/20 text-amber-500" : "bg-secondary text-muted-foreground"
                )}>
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">High Performance Mode</p>
                  <p className="text-xs text-muted-foreground">Reduces blur & animations on battery</p>
                </div>
              </div>
              <span className={cn("text-xs font-bold", highPerformanceMode ? "text-amber-500" : "text-muted-foreground")}>
                {highPerformanceMode ? "Active" : "Off"}
              </span>
            </button>
          </div>

          {/* Sign Out Section */}
          <div className="pt-2 border-t border-border/60">
            <button
              onClick={handleLogout}
              aria-label="Sign out of PurchaseTracker"
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all font-bold text-sm touch-target"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of System
            </button>
          </div>
        </div>
      </div>

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
      />
    </div>
  );
}
