"use client";

import {
  Bell,
  Search,
  HelpCircle,
  PlusCircle,
  Calendar,
  Sparkles,
  CheckCheck,
  Clock,
  ExternalLink,
  Loader2,
  Menu,
  FileSpreadsheet,
  Zap,
  XCircle,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  Monitor,
  Rocket,
  Scale,
  Building,
  HardHat,
  Wallet,
  Users2,
  PieChart,
  LayoutDashboard,
  ShieldAlert,
  RotateCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePerformance } from "@/context/PerformanceContext";
import { usePWA } from "@/context/PWAContext";
import { 
  resolveNotificationLink, 
  formatNotificationTitle, 
  formatNotificationMessage, 
  formatNotificationTime 
} from "@/lib/utils/notification-formatter";
import { PWASettings } from "./PWASettings";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { Sidebar } from "./Sidebar";

const NAV_ITEMS = [
  { name: "Purchases", path: "/dashboard/requests", icon: <ShoppingBag className="w-4 h-4" /> },
  { name: "Vendors", path: "/dashboard/vendors", icon: <Building className="w-4 h-4" /> },
  { name: "Analytics", path: "/dashboard/analytics", icon: <PieChart className="w-4 h-4" /> },
  { name: "Compliance", path: "/dashboard/compliance", icon: <ShieldAlert className="w-4 h-4" /> },
];

export default function TopNav() {
  const { unreadCount, isSyncing, refreshAppAndData, hasUpdate } = usePWA();
  const { highPerformanceMode, setHighPerformanceMode } = usePerformance();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { user, isAdmin, isApprover } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
      toast.success("Successfully logged out");
      router.push("/login");
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };

  const { data: notifications = [], isLoading: isLoadingNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.notifications.list({ includeRead: false }),
    enabled: isNotifOpen,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.notifications.markAllRead(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        await apiClient.notifications.markRead(notif.id);
        queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      setIsNotifOpen(false);
      const link = resolveNotificationLink(notif);
      router.push(link);
    } catch (error) {
      console.error("Failed to process notification:", error);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isInsideTrigger = notifRef.current && notifRef.current.contains(event.target as Node);
      const isInsidePortal = portalRef.current && portalRef.current.contains(event.target as Node);

      if (!isInsideTrigger && !isInsidePortal) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const userInitial = (user?.username || "U").substring(0, 1).toUpperCase();

  if (!isMounted) return null;

  return (
    <header className="min-h-[3.75rem] py-2.5 border-b border-border bg-background/98 backdrop-blur-md flex items-center justify-between px-3.5 sm:px-6 lg:px-8 sticky top-0 z-[100] transition-all pt-safe ease-spring shadow-xs">
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-8 shrink-0 min-w-0">
        {/* MOBILE HAMBURGER TRIGGER */}
        <div className="lg:hidden shrink-0">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open navigation menu"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/60 hover:bg-secondary text-foreground transition-all active-scale touch-target border border-border/50"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none bg-card shadow-2xl w-72">
              <Sidebar onItemClick={() => setIsMobileMenuOpen(false)} className="w-full h-full" />
            </SheetContent>
          </Sheet>
        </div>

        {/* E3 BRANDING LOGO */}
        <Link href="/dashboard" className="flex items-center shrink-0">
          <img src="/logo-color.png" alt="E3" className="h-7 sm:h-8 max-w-[85px] sm:max-w-[120px] object-contain dark:hidden transition-transform hover:scale-105" />
          <img src="/logo-white.png" alt="E3" className="h-7 sm:h-8 max-w-[85px] sm:max-w-[120px] object-contain hidden dark:block transition-transform hover:scale-105" />
        </Link>

        {/* MAIN NAVIGATION (DESKTOP) */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  if (pathname === item.path) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all pointer-events-auto",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Conditional Admin Tab */}
          {isAdmin && (
            <Link
              href="/dashboard/admin"
              onClick={(e) => {
                if (pathname === "/dashboard/admin") {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ml-1 border-l border-border/80 pl-3 pointer-events-auto",
                pathname.startsWith("/dashboard/admin")
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          )}
        </nav>
      </div>

      {/* RIGHT SIDE UTILITIES & USER PROFILE */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global Command Palette Trigger */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true });
            document.dispatchEvent(event);
          }}
          aria-label="Search system"
          className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-all touch-target group shadow-sm"
          title="Search (⌘K / Ctrl+K)"
        >
          <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="hidden md:inline font-medium">Search...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold bg-background rounded-md border border-border text-foreground font-mono">⌘K</kbd>
        </button>

        {/* PWA & Data Sync / Refresh Button */}
        <button
          onClick={refreshAppAndData}
          disabled={isSyncing}
          aria-label="Refresh and sync data"
          className={cn(
            "p-2 sm:p-2.5 rounded-xl border border-border bg-secondary/40 transition-all relative group hover:bg-secondary hover:text-foreground flex items-center justify-center min-h-[38px] min-w-[38px] shadow-sm touch-target",
            isSyncing ? "opacity-75 cursor-wait" : ""
          )}
          title="Refresh Data & Check for Updates"
        >
          <RotateCw className={cn("w-4 h-4 text-muted-foreground group-hover:text-foreground transition-all", isSyncing && "animate-spin text-primary")} />
          {hasUpdate && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" title="Update Available" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            className={cn(
              "p-2 sm:p-2.5 rounded-xl border border-border bg-secondary/40 transition-all relative group hover:bg-secondary hover:text-foreground flex items-center justify-center min-h-[38px] min-w-[38px] shadow-sm",
              isNotifOpen ? "bg-secondary text-foreground ring-2 ring-primary/20" : "text-muted-foreground"
            )}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* NOTIFICATION PORTAL */}
          {isNotifOpen && createPortal(
            <div className="fixed inset-0 z-[99999]">
              <div
                className="fixed inset-0 bg-black/20 md:bg-transparent"
                onClick={() => setIsNotifOpen(false)}
              />
              <div
                ref={portalRef}
                className="absolute bg-card border border-border rounded-2xl shadow-2xl overflow-hidden w-[90vw] max-w-[380px] animate-fade-scale-in z-[100000]"
                style={{
                  top: notifRef.current ? notifRef.current.getBoundingClientRect().bottom + 12 : '80px',
                  right: notifRef.current ? Math.max(16, window.innerWidth - notifRef.current.getBoundingClientRect().right) : '16px'
                }}
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Notifications</h3>
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[11px] font-bold text-primary hover:underline transition-colors uppercase tracking-wider"
                  >
                    Archive All
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {isLoadingNotifs ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-xs font-semibold text-muted-foreground opacity-60">No new notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/20">
                      {notifications.map((notif: any) => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className="w-full text-left p-4 hover:bg-secondary/50 transition-colors group flex gap-3"
                        >
                          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                             <Bell className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-xs font-bold text-foreground truncate">{formatNotificationTitle(notif)}</p>
                             <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 font-normal">{formatNotificationMessage(notif)}</p>
                             <p className="text-[11px] font-mono text-muted-foreground font-medium mt-1">
                               {formatNotificationTime(notif.createdAt)}
                             </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* User Identity & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-border/80">
          <div 
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shadow-sm shrink-0"
            title={`${user?.username} (${user?.department || 'Member'})`}
          >
            {userInitial}
          </div>

          <div className="hidden sm:block text-left max-w-[130px]">
            <p className="text-xs font-bold text-foreground leading-tight truncate">{user?.username || "User"}</p>
            <p className="text-[10px] text-muted-foreground font-medium truncate leading-tight">{user?.department || "Operations"}</p>
          </div>

          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

